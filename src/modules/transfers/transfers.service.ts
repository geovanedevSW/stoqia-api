import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { ProductsService } from '../products/products.service';
import { Product } from '../products/entities/product.entity';
import { WarehousesService } from '../warehouses/warehouses.service';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import {
  StockMovement,
  StockMovementType,
} from '../inventory/entities/stock-movement.entity';
import { Transfer, TransferStatus } from './entities/transfer.entity';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { QueryTransfersDto } from './dto/query-transfers.dto';

export interface TransferOperationResult {
  transfer: Transfer;
  movements: StockMovement[];
  idempotentReplay: boolean;
}

// Service responsável por transferências seguras entre depósitos.
// Usa transações ACID + lock pessimista (SELECT ... FOR UPDATE) em ordem determinística
// para impedir saldo negativo em concorrência e evitar deadlocks em transferências cruzadas.
@Injectable()
export class TransfersService {
  constructor(
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
    @InjectRepository(StockMovement)
    private readonly movementRepository: Repository<StockMovement>,
    private readonly dataSource: DataSource,
    private readonly productsService: ProductsService,
    private readonly warehousesService: WarehousesService,
  ) {}

  // Executa uma transferência entre sourceWarehouseId e destinationWarehouseId.
  async create(
    dto: CreateTransferDto,
    headerIdempotencyKey?: string,
  ): Promise<TransferOperationResult> {
    if (dto.sourceWarehouseId === dto.destinationWarehouseId) {
      throw new BadRequestException(
        'O depósito de origem e o depósito de destino devem ser diferentes.',
      );
    }

    const idempotencyKey = this.resolveIdempotencyKey(
      dto.idempotencyKey,
      headerIdempotencyKey,
    );

    const { product, sourceWarehouse, destinationWarehouse } =
      await this.ensureActiveEntities(
        dto.productId,
        dto.sourceWarehouseId,
        dto.destinationWarehouseId,
      );

    // Atalho fora da transação para retries sequenciais com a mesma chave.
    if (idempotencyKey) {
      const existingReplay = await this.findReplayIfExists(
        null,
        idempotencyKey,
        dto,
      );
      if (existingReplay) {
        return existingReplay;
      }
    }

    const normalizedReason = dto.reason?.trim() || null;

    try {
      return await this.dataSource.transaction(
        async (manager: EntityManager) => {
          // Garante que a linha de estoque do destino exista antes de travar os registros,
          // evitando erro de chave duplicada caso duas transferências cheguem juntas para um destino novo.
          // Se a transferência falhar (ex.: saldo insuficiente na origem), o rollback apaga essa linha.
          await manager
            .createQueryBuilder()
            .insert()
            .into(InventoryItem)
            .values({
              productId: dto.productId,
              warehouseId: dto.destinationWarehouseId,
              quantity: 0,
            })
            .orIgnore()
            .execute();

          // Ordenação determinística dos depósitos pelo UUID para prevenir deadlocks:
          // se uma transação faz A -> B e outra faz B -> A ao mesmo tempo, ambas travam A antes de B.
          const [firstWarehouseId, secondWarehouseId] =
            dto.sourceWarehouseId < dto.destinationWarehouseId
              ? [dto.sourceWarehouseId, dto.destinationWarehouseId]
              : [dto.destinationWarehouseId, dto.sourceWarehouseId];

          const firstItem = await manager.findOne(InventoryItem, {
            where: {
              productId: dto.productId,
              warehouseId: firstWarehouseId,
            },
            lock: { mode: 'pessimistic_write' },
          });

          const secondItem = await manager.findOne(InventoryItem, {
            where: {
              productId: dto.productId,
              warehouseId: secondWarehouseId,
            },
            lock: { mode: 'pessimistic_write' },
          });

          // Revalida a chave de idempotência já com os locks em mãos:
          // se outra requisição idêntica acabou de concluir enquanto esperávamos o lock, devolvemos o replay.
          if (idempotencyKey) {
            const concurrentReplay = await this.findReplayIfExists(
              manager,
              idempotencyKey,
              dto,
            );
            if (concurrentReplay) {
              return concurrentReplay;
            }
          }

          const itemsByWarehouse = new Map<string, InventoryItem | null>([
            [firstWarehouseId, firstItem],
            [secondWarehouseId, secondItem],
          ]);

          const sourceItem =
            itemsByWarehouse.get(dto.sourceWarehouseId) ?? null;
          const destinationItem =
            itemsByWarehouse.get(dto.destinationWarehouseId) ?? null;

          const sourcePreviousBalance = sourceItem ? sourceItem.quantity : 0;
          if (sourcePreviousBalance < dto.quantity) {
            throw new ConflictException(
              `Estoque insuficiente para transferir '${product.name}' do depósito '${sourceWarehouse.code}'. Disponível: ${sourcePreviousBalance}, solicitado: ${dto.quantity}.`,
            );
          }

          if (!sourceItem || !destinationItem) {
            throw new InternalServerErrorException(
              'Falha ao carregar linhas bloqueadas de estoque para transferência.',
            );
          }

          const sourceNewBalance = sourcePreviousBalance - dto.quantity;
          const destinationPreviousBalance = destinationItem.quantity;
          const destinationNewBalance =
            destinationPreviousBalance + dto.quantity;

          sourceItem.quantity = sourceNewBalance;
          destinationItem.quantity = destinationNewBalance;

          await manager.save(InventoryItem, sourceItem);
          await manager.save(InventoryItem, destinationItem);

          const transfer = manager.create(Transfer, {
            productId: dto.productId,
            sourceWarehouseId: dto.sourceWarehouseId,
            destinationWarehouseId: dto.destinationWarehouseId,
            quantity: dto.quantity,
            status: TransferStatus.COMPLETED,
            reason: normalizedReason,
            idempotencyKey,
          });
          const savedTransfer = await manager.save(Transfer, transfer);

          const defaultTransferReason = `Transferência ${sourceWarehouse.code} -> ${destinationWarehouse.code}`;
          const movementReason = normalizedReason ?? defaultTransferReason;

          const outboundMovement = manager.create(StockMovement, {
            productId: dto.productId,
            warehouseId: dto.sourceWarehouseId,
            type: StockMovementType.TRANSFER_OUT,
            quantity: dto.quantity,
            previousBalance: sourcePreviousBalance,
            newBalance: sourceNewBalance,
            reason: movementReason,
            referenceId: savedTransfer.id,
          });

          const inboundMovement = manager.create(StockMovement, {
            productId: dto.productId,
            warehouseId: dto.destinationWarehouseId,
            type: StockMovementType.TRANSFER_IN,
            quantity: dto.quantity,
            previousBalance: destinationPreviousBalance,
            newBalance: destinationNewBalance,
            reason: movementReason,
            referenceId: savedTransfer.id,
          });

          const savedOutbound = await manager.save(
            StockMovement,
            outboundMovement,
          );
          const savedInbound = await manager.save(
            StockMovement,
            inboundMovement,
          );

          return {
            transfer: savedTransfer,
            movements: [savedOutbound, savedInbound],
            idempotentReplay: false,
          };
        },
      );
    } catch (error) {
      // Caso duas requisições concorrentes com a mesma idempotencyKey tenham escapado de locks distintos,
      // o índice único do banco rejeita a segunda (23505) e retornamos o replay da vencedora.
      if (idempotencyKey && this.isUniqueViolationOnIdempotencyKey(error)) {
        const winnerReplay = await this.findReplayIfExists(
          null,
          idempotencyKey,
          dto,
        );
        if (winnerReplay) {
          return winnerReplay;
        }
      }

      throw error;
    }
  }

  // Lista transferências realizadas, com filtros opcionais.
  async findAll(query: QueryTransfersDto = {}): Promise<Transfer[]> {
    const where: FindOptionsWhere<Transfer> = {};

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.sourceWarehouseId) {
      where.sourceWarehouseId = query.sourceWarehouseId;
    }
    if (query.destinationWarehouseId) {
      where.destinationWarehouseId = query.destinationWarehouseId;
    }

    return this.transferRepository.find({
      where,
      relations: {
        product: true,
        sourceWarehouse: true,
        destinationWarehouse: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  // Busca detalhes de uma transferência pelo UUID.
  async findOne(id: string): Promise<Transfer> {
    const transfer = await this.transferRepository.findOne({
      where: { id },
      relations: {
        product: true,
        sourceWarehouse: true,
        destinationWarehouse: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException(
        `Transferência com ID '${id}' não foi encontrada.`,
      );
    }

    return transfer;
  }

  private resolveIdempotencyKey(
    bodyKey?: string,
    headerKey?: string,
  ): string | null {
    const normalizedBody = bodyKey?.trim() || null;
    const normalizedHeader = headerKey?.trim() || null;

    if (
      normalizedBody &&
      normalizedHeader &&
      normalizedBody !== normalizedHeader
    ) {
      throw new BadRequestException(
        'A chave de idempotência no cabeçalho Idempotency-Key difere da informada no corpo da requisição.',
      );
    }

    const key = normalizedHeader ?? normalizedBody;
    if (key && key.length > 128) {
      throw new BadRequestException(
        'A chave de idempotência deve ter no máximo 128 caracteres.',
      );
    }

    return key;
  }

  private async ensureActiveEntities(
    productId: string,
    sourceWarehouseId: string,
    destinationWarehouseId: string,
  ): Promise<{
    product: Product;
    sourceWarehouse: Warehouse;
    destinationWarehouse: Warehouse;
  }> {
    const [product, sourceWarehouse, destinationWarehouse] = await Promise.all([
      this.productsService.findOne(productId),
      this.warehousesService.findOne(sourceWarehouseId),
      this.warehousesService.findOne(destinationWarehouseId),
    ]);

    if (!product.isActive) {
      throw new BadRequestException(
        `O produto '${product.name}' está inativo e não pode ser transferido.`,
      );
    }

    if (!sourceWarehouse.isActive) {
      throw new BadRequestException(
        `O depósito de origem '${sourceWarehouse.code}' está inativo.`,
      );
    }

    if (!destinationWarehouse.isActive) {
      throw new BadRequestException(
        `O depósito de destino '${destinationWarehouse.code}' está inativo.`,
      );
    }

    return { product, sourceWarehouse, destinationWarehouse };
  }

  private async findReplayIfExists(
    manager: EntityManager | null,
    idempotencyKey: string,
    dto: CreateTransferDto,
  ): Promise<TransferOperationResult | null> {
    const existing = manager
      ? await manager.findOne(Transfer, { where: { idempotencyKey } })
      : await this.transferRepository.findOne({ where: { idempotencyKey } });

    if (!existing) {
      return null;
    }

    const sameParameters =
      existing.productId === dto.productId &&
      existing.sourceWarehouseId === dto.sourceWarehouseId &&
      existing.destinationWarehouseId === dto.destinationWarehouseId &&
      existing.quantity === dto.quantity;

    if (!sameParameters) {
      throw new ConflictException(
        `A chave de idempotência '${idempotencyKey}' já foi utilizada em outra transferência com parâmetros diferentes.`,
      );
    }

    const movements = manager
      ? await manager.find(StockMovement, {
          where: { referenceId: existing.id },
          order: { createdAt: 'ASC' },
        })
      : await this.movementRepository.find({
          where: { referenceId: existing.id },
          order: { createdAt: 'ASC' },
        });

    return {
      transfer: existing,
      movements,
      idempotentReplay: true,
    };
  }

  private isUniqueViolationOnIdempotencyKey(error: unknown): boolean {
    const pgError = error as {
      code?: string;
      constraint?: string;
      driverError?: { code?: string; constraint?: string };
    };
    const code = pgError?.driverError?.code ?? pgError?.code;
    const constraint = pgError?.driverError?.constraint ?? pgError?.constraint;

    return code === '23505' && constraint === 'UQ_transfers_idempotency_key';
  }
}
