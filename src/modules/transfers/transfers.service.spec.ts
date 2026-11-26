import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TransfersService } from './transfers.service';
import { Transfer, TransferStatus } from './entities/transfer.entity';
import {
  StockMovement,
  StockMovementType,
} from '../inventory/entities/stock-movement.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { ProductsService } from '../products/products.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { Product } from '../products/entities/product.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';

describe('TransfersService', () => {
  let service: TransfersService;
  let transferRepository: jest.Mocked<Partial<Repository<Transfer>>>;
  let movementRepository: jest.Mocked<Partial<Repository<StockMovement>>>;
  let productsService: { findOne: jest.Mock<(id: string) => Promise<Product>> };
  let warehousesService: {
    findOne: jest.Mock<(id: string) => Promise<Warehouse>>;
  };
  let mockQueryBuilder: {
    insert: jest.Mock;
    into: jest.Mock;
    values: jest.Mock;
    orIgnore: jest.Mock;
    execute: jest.Mock;
  };
  let mockManager: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let mockDataSource: { transaction: jest.Mock };

  const productId = '11111111-1111-4111-8111-111111111111';
  const warehouseAId = '22222222-2222-4222-8222-222222222222';
  const warehouseBId = '33333333-3333-4333-8333-333333333333';

  const activeProduct = {
    id: productId,
    name: 'Smartphone Galaxy S24',
    sku: 'SM-GAL-S24',
    isActive: true,
  } as Product;

  const warehousesById: Record<string, Warehouse> = {
    [warehouseAId]: {
      id: warehouseAId,
      name: 'Depósito A',
      code: 'DEP-A',
      isActive: true,
    } as Warehouse,
    [warehouseBId]: {
      id: warehouseBId,
      name: 'Depósito B',
      code: 'DEP-B',
      isActive: true,
    } as Warehouse,
  };

  beforeEach(async () => {
    transferRepository = {
      find: jest.fn(),
      findOne: jest.fn(async () => null),
    };

    movementRepository = {
      find: jest.fn(async () => []),
    };

    productsService = {
      findOne: jest.fn(async () => activeProduct),
    };

    warehousesService = {
      findOne: jest.fn(async (id: string) => warehousesById[id]),
    };

    mockQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn(async () => ({ identifiers: [] })),
    };

    mockManager = {
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
      findOne: jest.fn(),
      find: jest.fn(async () => []),
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (entityClass, entity: Record<string, unknown>) => {
        if (entityClass === Transfer) {
          return { id: 'transfer-uuid-1', ...entity };
        }
        return entity;
      }),
    };

    mockDataSource = {
      transaction: jest.fn(
        async (callback: (manager: typeof mockManager) => unknown) =>
          callback(mockManager),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        {
          provide: getRepositoryToken(Transfer),
          useValue: transferRepository,
        },
        {
          provide: getRepositoryToken(StockMovement),
          useValue: movementRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ProductsService,
          useValue: productsService,
        },
        {
          provide: WarehousesService,
          useValue: warehousesService,
        },
      ],
    }).compile();

    service = module.get<TransfersService>(TransfersService);
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('deve transferir unidades, adquirir locks em ordem determinística e gravar TRANSFER_OUT e TRANSFER_IN com mesmo referenceId', async () => {
      const itemA = {
        id: 'inv-a',
        productId,
        warehouseId: warehouseAId,
        quantity: 10,
      } as InventoryItem;

      const itemB = {
        id: 'inv-b',
        productId,
        warehouseId: warehouseBId,
        quantity: 2,
      } as InventoryItem;

      // Ordem determinística: warehouseAId ('2222...') < warehouseBId ('3333...')
      mockManager.findOne
        .mockResolvedValueOnce(itemA)
        .mockResolvedValueOnce(itemB);

      const result = await service.create({
        productId,
        sourceWarehouseId: warehouseAId,
        destinationWarehouseId: warehouseBId,
        quantity: 3,
        reason: 'Reposição filial',
      });

      expect(mockQueryBuilder.orIgnore).toHaveBeenCalled();
      expect(mockManager.findOne).toHaveBeenNthCalledWith(1, InventoryItem, {
        where: { productId, warehouseId: warehouseAId },
        lock: { mode: 'pessimistic_write' },
      });
      expect(mockManager.findOne).toHaveBeenNthCalledWith(2, InventoryItem, {
        where: { productId, warehouseId: warehouseBId },
        lock: { mode: 'pessimistic_write' },
      });

      expect(itemA.quantity).toBe(7);
      expect(itemB.quantity).toBe(5);
      expect(result.idempotentReplay).toBe(false);
      expect(result.transfer).toMatchObject({
        id: 'transfer-uuid-1',
        quantity: 3,
        status: TransferStatus.COMPLETED,
        reason: 'Reposição filial',
      });
      expect(result.movements).toHaveLength(2);
      expect(result.movements[0]).toMatchObject({
        type: StockMovementType.TRANSFER_OUT,
        warehouseId: warehouseAId,
        quantity: 3,
        previousBalance: 10,
        newBalance: 7,
        referenceId: 'transfer-uuid-1',
      });
      expect(result.movements[1]).toMatchObject({
        type: StockMovementType.TRANSFER_IN,
        warehouseId: warehouseBId,
        quantity: 3,
        previousBalance: 2,
        newBalance: 5,
        referenceId: 'transfer-uuid-1',
      });
    });

    it('deve travar primeiro o menor UUID mesmo na transferência reversa (B -> A) para prevenir deadlocks', async () => {
      const itemA = {
        id: 'inv-a',
        productId,
        warehouseId: warehouseAId,
        quantity: 1,
      } as InventoryItem;

      const itemB = {
        id: 'inv-b',
        productId,
        warehouseId: warehouseBId,
        quantity: 5,
      } as InventoryItem;

      mockManager.findOne
        .mockResolvedValueOnce(itemA)
        .mockResolvedValueOnce(itemB);

      await service.create({
        productId,
        sourceWarehouseId: warehouseBId,
        destinationWarehouseId: warehouseAId,
        quantity: 2,
      });

      // Mesmo indo de B -> A, o lock precisa ocorrer primeiro em A e depois em B
      expect(mockManager.findOne).toHaveBeenNthCalledWith(1, InventoryItem, {
        where: { productId, warehouseId: warehouseAId },
        lock: { mode: 'pessimistic_write' },
      });
      expect(mockManager.findOne).toHaveBeenNthCalledWith(2, InventoryItem, {
        where: { productId, warehouseId: warehouseBId },
        lock: { mode: 'pessimistic_write' },
      });
      expect(itemB.quantity).toBe(3);
      expect(itemA.quantity).toBe(3);
    });

    it('deve lançar BadRequestException quando origem e destino forem iguais', async () => {
      await expect(
        service.create({
          productId,
          sourceWarehouseId: warehouseAId,
          destinationWarehouseId: warehouseAId,
          quantity: 1,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('deve lançar ConflictException quando a origem não tiver saldo suficiente', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({
          id: 'inv-a',
          productId,
          warehouseId: warehouseAId,
          quantity: 1,
        } as InventoryItem)
        .mockResolvedValueOnce({
          id: 'inv-b',
          productId,
          warehouseId: warehouseBId,
          quantity: 0,
        } as InventoryItem);

      await expect(
        service.create({
          productId,
          sourceWarehouseId: warehouseAId,
          destinationWarehouseId: warehouseBId,
          quantity: 2,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('deve retornar replay idempotente sem debitar estoque novamente quando a chave já existir com mesmo payload', async () => {
      const existingTransfer = {
        id: 'transfer-existente',
        productId,
        sourceWarehouseId: warehouseAId,
        destinationWarehouseId: warehouseBId,
        quantity: 2,
        status: TransferStatus.COMPLETED,
        idempotencyKey: 'idem-001',
      } as Transfer;

      const existingMovements = [
        { id: 'mov-1', referenceId: 'transfer-existente' },
        { id: 'mov-2', referenceId: 'transfer-existente' },
      ] as StockMovement[];

      transferRepository.findOne?.mockResolvedValue(existingTransfer);
      movementRepository.find?.mockResolvedValue(existingMovements);

      const result = await service.create(
        {
          productId,
          sourceWarehouseId: warehouseAId,
          destinationWarehouseId: warehouseBId,
          quantity: 2,
        },
        'idem-001',
      );

      expect(result.idempotentReplay).toBe(true);
      expect(result.transfer).toEqual(existingTransfer);
      expect(result.movements).toEqual(existingMovements);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('deve lançar ConflictException quando a mesma chave de idempotência for reutilizada com parâmetros diferentes', async () => {
      transferRepository.findOne?.mockResolvedValue({
        id: 'transfer-existente',
        productId,
        sourceWarehouseId: warehouseAId,
        destinationWarehouseId: warehouseBId,
        quantity: 2,
        idempotencyKey: 'idem-001',
      } as Transfer);

      await expect(
        service.create(
          {
            productId,
            sourceWarehouseId: warehouseAId,
            destinationWarehouseId: warehouseBId,
            quantity: 5,
          },
          'idem-001',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('consultas', () => {
    it('deve listar transferências filtrando por produto e depósito de origem', async () => {
      const transfers = [{ id: 't-1', productId }] as Transfer[];
      transferRepository.find?.mockResolvedValue(transfers);

      const result = await service.findAll({
        productId,
        sourceWarehouseId: warehouseAId,
      });

      expect(transferRepository.find).toHaveBeenCalledWith({
        where: { productId, sourceWarehouseId: warehouseAId },
        relations: {
          product: true,
          sourceWarehouse: true,
          destinationWarehouse: true,
        },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(transfers);
    });

    it('deve lançar NotFoundException ao buscar transferência inexistente', async () => {
      transferRepository.findOne?.mockResolvedValue(null);

      await expect(service.findOne('uuid-inexistente')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
