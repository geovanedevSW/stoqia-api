import {
  BadRequestException,
  ConflictException,
  Injectable,
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
import { InventoryItem } from './entities/inventory-item.entity';
import {
  StockMovement,
  StockMovementType,
} from './entities/stock-movement.entity';
import { AdjustStockDto, StockChangeDto } from './dto/stock-movement.dto';
import {
  QueryInventoryDto,
  QueryMovementsDto,
} from './dto/query-inventory.dto';

export interface StockOperationResult {
  inventory: InventoryItem;
  movement: StockMovement;
}

// Service responsável por controlar o saldo em estoque e registrar cada movimentação.
// Todas as alterações de saldo rodam dentro de transações ACID com lock pessimista (FOR UPDATE)
// para evitar race conditions e saldos negativos mesmo sob concorrência.
@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(StockMovement)
    private readonly movementRepository: Repository<StockMovement>,
    private readonly dataSource: DataSource,
    private readonly productsService: ProductsService,
    private readonly warehousesService: WarehousesService,
  ) {}

  // Registra uma entrada de estoque (compra, devolução, carga inicial).
  async inbound(dto: StockChangeDto): Promise<StockOperationResult> {
    return this.applyStockChange({
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      type: StockMovementType.INBOUND,
      reason: dto.reason,
      createIfMissing: true,
      calculate: (previousBalance) => ({
        newBalance: previousBalance + dto.quantity,
        movementQuantity: dto.quantity,
      }),
    });
  }

  // Registra uma saída de estoque (venda, expedição, baixa).
  // Bloqueia a linha do saldo durante a transação e rejeita com 409 Conflict se não houver unidades suficientes.
  async outbound(dto: StockChangeDto): Promise<StockOperationResult> {
    return this.applyStockChange({
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      type: StockMovementType.OUTBOUND,
      reason: dto.reason,
      createIfMissing: false,
      calculate: (previousBalance, product, warehouse) => {
        if (previousBalance < dto.quantity) {
          throw new ConflictException(
            `Estoque insuficiente para o produto '${product.name}' no depósito '${warehouse.code}'. Disponível: ${previousBalance}, solicitado: ${dto.quantity}.`,
          );
        }

        return {
          newBalance: previousBalance - dto.quantity,
          movementQuantity: dto.quantity,
        };
      },
    });
  }

  // Ajusta manualmente o saldo do estoque para a quantidade contada fisicamente.
  async adjust(dto: AdjustStockDto): Promise<StockOperationResult> {
    const trimmedReason = dto.reason.trim();
    if (!trimmedReason) {
      throw new BadRequestException(
        'O motivo do ajuste de estoque é obrigatório.',
      );
    }

    return this.applyStockChange({
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      type: StockMovementType.ADJUSTMENT,
      reason: trimmedReason,
      createIfMissing: true,
      calculate: (previousBalance) => {
        if (dto.quantity === previousBalance) {
          throw new BadRequestException(
            `O saldo atual já é ${previousBalance} unidade(s); nenhum ajuste necessário.`,
          );
        }

        return {
          newBalance: dto.quantity,
          movementQuantity: Math.abs(dto.quantity - previousBalance),
        };
      },
    });
  }

  // Lista saldos atuais de estoque, permitindo filtrar por produto e/ou depósito.
  async findAll(query: QueryInventoryDto = {}): Promise<InventoryItem[]> {
    const where: FindOptionsWhere<InventoryItem> = {};

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    return this.inventoryRepository.find({
      where,
      relations: { product: true, warehouse: true },
      order: { updatedAt: 'DESC' },
    });
  }

  // Busca um registro de saldo específico pelo UUID.
  async findOne(id: string): Promise<InventoryItem> {
    const item = await this.inventoryRepository.findOne({
      where: { id },
      relations: { product: true, warehouse: true },
    });

    if (!item) {
      throw new NotFoundException(
        `Registro de estoque com ID '${id}' não foi encontrado.`,
      );
    }

    return item;
  }

  // Lista o histórico auditável de movimentações (extrato), do mais recente para o mais antigo.
  async findMovements(
    query: QueryMovementsDto = {},
  ): Promise<StockMovement[]> {
    const where: FindOptionsWhere<StockMovement> = {};

    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }
    if (query.type) {
      where.type = query.type;
    }

    return this.movementRepository.find({
      where,
      relations: { product: true, warehouse: true },
      order: { createdAt: 'DESC' },
    });
  }

  // Fluxo transacional reutilizável: valida produto/depósito ativos, trava a linha
  // com SELECT ... FOR UPDATE, calcula o novo saldo e grava o histórico na mesma transação.
  private async applyStockChange(params: {
    productId: string;
    warehouseId: string;
    type: StockMovementType;
    reason?: string;
    createIfMissing: boolean;
    calculate: (
      previousBalance: number,
      product: Product,
      warehouse: Warehouse,
    ) => { newBalance: number; movementQuantity: number };
  }): Promise<StockOperationResult> {
    const { product, warehouse } =
      await this.ensureActiveProductAndWarehouse(
        params.productId,
        params.warehouseId,
      );

    const normalizedReason = params.reason?.trim() || null;

    return this.dataSource.transaction(async (manager: EntityManager) => {
      if (params.createIfMissing) {
        // Garante que a linha exista sem erro de corrida caso duas entradas
        // cheguem ao mesmo tempo para um produto/depósito ainda sem saldo.
        await manager
          .createQueryBuilder()
          .insert()
          .into(InventoryItem)
          .values({
            productId: params.productId,
            warehouseId: params.warehouseId,
            quantity: 0,
          })
          .orIgnore()
          .execute();
      }

      // Adquire lock exclusivo (SELECT ... FOR UPDATE) até o fim da transação.
      const lockedItem = await manager.findOne(InventoryItem, {
        where: {
          productId: params.productId,
          warehouseId: params.warehouseId,
        },
        lock: { mode: 'pessimistic_write' },
      });

      const previousBalance = lockedItem ? lockedItem.quantity : 0;
      const { newBalance, movementQuantity } = params.calculate(
        previousBalance,
        product,
        warehouse,
      );

      const itemToSave =
        lockedItem ??
        manager.create(InventoryItem, {
          productId: params.productId,
          warehouseId: params.warehouseId,
          quantity: 0,
        });

      itemToSave.quantity = newBalance;
      const savedInventory = await manager.save(InventoryItem, itemToSave);

      const movement = manager.create(StockMovement, {
        productId: params.productId,
        warehouseId: params.warehouseId,
        type: params.type,
        quantity: movementQuantity,
        previousBalance,
        newBalance,
        reason: normalizedReason,
        referenceId: null,
      });

      const savedMovement = await manager.save(StockMovement, movement);

      return {
        inventory: savedInventory,
        movement: savedMovement,
      };
    });
  }

  // Garante que o produto e o depósito existem e estão ativos antes de alterar estoque.
  private async ensureActiveProductAndWarehouse(
    productId: string,
    warehouseId: string,
  ): Promise<{ product: Product; warehouse: Warehouse }> {
    const [product, warehouse] = await Promise.all([
      this.productsService.findOne(productId),
      this.warehousesService.findOne(warehouseId),
    ]);

    if (!product.isActive) {
      throw new BadRequestException(
        `O produto '${product.name}' está inativo e não pode ser movimentado.`,
      );
    }

    if (!warehouse.isActive) {
      throw new BadRequestException(
        `O depósito '${warehouse.code}' está inativo e não pode receber movimentações.`,
      );
    }

    return { product, warehouse };
  }
}
