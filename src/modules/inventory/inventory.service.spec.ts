import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InventoryService } from './inventory.service';
import { InventoryItem } from './entities/inventory-item.entity';
import {
  StockMovement,
  StockMovementType,
} from './entities/stock-movement.entity';
import { ProductsService } from '../products/products.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { Product } from '../products/entities/product.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';

describe('InventoryService', () => {
  let service: InventoryService;
  let inventoryRepository: jest.Mocked<Partial<Repository<InventoryItem>>>;
  let movementRepository: jest.Mocked<Partial<Repository<StockMovement>>>;
  let productsService: { findOne: jest.Mock<(id: string) => Promise<Product>> };
  let warehousesService: {
    findOne: jest.Mock<(id: string) => Promise<Warehouse>>;
  };
  let mockManager: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let mockQueryBuilder: {
    insert: jest.Mock;
    into: jest.Mock;
    values: jest.Mock;
    orIgnore: jest.Mock;
    execute: jest.Mock;
  };
  let mockDataSource: { transaction: jest.Mock };

  const productId = '11111111-1111-4111-8111-111111111111';
  const warehouseId = '22222222-2222-4222-8222-222222222222';

  const activeProduct = {
    id: productId,
    name: 'Smartphone Galaxy S24',
    sku: 'SM-GAL-S24',
    isActive: true,
  } as Product;

  const inactiveProduct = {
    id: productId,
    name: 'Smartphone Galaxy S24',
    sku: 'SM-GAL-S24',
    isActive: false,
  } as Product;

  const activeWarehouse = {
    id: warehouseId,
    name: 'Depósito A',
    code: 'DEP-A',
    isActive: true,
  } as Warehouse;

  const inactiveWarehouse = {
    id: warehouseId,
    name: 'Depósito A',
    code: 'DEP-A',
    isActive: false,
  } as Warehouse;

  beforeEach(async () => {
    inventoryRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    movementRepository = {
      find: jest.fn(),
    };

    productsService = {
      findOne: jest.fn(async () => activeProduct),
    };

    warehousesService = {
      findOne: jest.fn(async () => activeWarehouse),
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
      create: jest.fn((_entity, data) => data),
      save: jest.fn(async (_entity, entity) => entity),
    };

    mockDataSource = {
      transaction: jest.fn(async (callback: (manager: typeof mockManager) => unknown) =>
        callback(mockManager),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: getRepositoryToken(InventoryItem),
          useValue: inventoryRepository,
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

    service = module.get<InventoryService>(InventoryService);
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('inbound', () => {
    it('deve criar saldo inicial com upsert/orIgnore, adquirir lock pessimista e gravar movimentação INBOUND', async () => {
      const lockedItem = {
        id: 'inv-1',
        productId,
        warehouseId,
        quantity: 0,
      } as InventoryItem;

      mockManager.findOne.mockResolvedValue(lockedItem);

      const result = await service.inbound({
        productId,
        warehouseId,
        quantity: 5,
        reason: ' Carga inicial ',
      });

      expect(mockQueryBuilder.orIgnore).toHaveBeenCalled();
      expect(mockManager.findOne).toHaveBeenCalledWith(InventoryItem, {
        where: { productId, warehouseId },
        lock: { mode: 'pessimistic_write' },
      });
      expect(result.inventory.quantity).toBe(5);
      expect(result.movement).toMatchObject({
        productId,
        warehouseId,
        type: StockMovementType.INBOUND,
        quantity: 5,
        previousBalance: 0,
        newBalance: 5,
        reason: 'Carga inicial',
      });
    });

    it('deve somar ao saldo existente em nova entrada', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 'inv-1',
        productId,
        warehouseId,
        quantity: 5,
      } as InventoryItem);

      const result = await service.inbound({
        productId,
        warehouseId,
        quantity: 3,
      });

      expect(result.inventory.quantity).toBe(8);
      expect(result.movement.previousBalance).toBe(5);
      expect(result.movement.newBalance).toBe(8);
    });
  });

  describe('outbound', () => {
    it('deve debitar o saldo e gravar movimentação OUTBOUND quando houver estoque suficiente', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 'inv-1',
        productId,
        warehouseId,
        quantity: 5,
      } as InventoryItem);

      const result = await service.outbound({
        productId,
        warehouseId,
        quantity: 2,
        reason: 'Pedido #101',
      });

      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
      expect(result.inventory.quantity).toBe(3);
      expect(result.movement).toMatchObject({
        type: StockMovementType.OUTBOUND,
        quantity: 2,
        previousBalance: 5,
        newBalance: 3,
        reason: 'Pedido #101',
      });
    });

    it('deve lançar ConflictException quando o saldo for insuficiente', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 'inv-1',
        productId,
        warehouseId,
        quantity: 1,
      } as InventoryItem);

      await expect(
        service.outbound({
          productId,
          warehouseId,
          quantity: 2,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('deve lançar ConflictException quando não existir saldo cadastrado para o produto no depósito', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.outbound({
          productId,
          warehouseId,
          quantity: 1,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(mockManager.save).not.toHaveBeenCalled();
    });
  });

  describe('adjust', () => {
    it('deve ajustar o saldo e registrar a diferença absoluta no histórico', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 'inv-1',
        productId,
        warehouseId,
        quantity: 7,
      } as InventoryItem);

      const result = await service.adjust({
        productId,
        warehouseId,
        quantity: 5,
        reason: 'Contagem física mensal',
      });

      expect(result.inventory.quantity).toBe(5);
      expect(result.movement).toMatchObject({
        type: StockMovementType.ADJUSTMENT,
        quantity: 2,
        previousBalance: 7,
        newBalance: 5,
        reason: 'Contagem física mensal',
      });
    });

    it('deve lançar BadRequestException se o novo saldo for igual ao atual', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 'inv-1',
        productId,
        warehouseId,
        quantity: 5,
      } as InventoryItem);

      await expect(
        service.adjust({
          productId,
          warehouseId,
          quantity: 5,
          reason: 'Contagem repetida',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('deve lançar BadRequestException se o motivo do ajuste for apenas espaços', async () => {
      await expect(
        service.adjust({
          productId,
          warehouseId,
          quantity: 5,
          reason: '   ',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('validações de produto e depósito ativos', () => {
    it('deve impedir movimentação se o produto estiver inativo', async () => {
      productsService.findOne.mockResolvedValue(inactiveProduct);

      await expect(
        service.inbound({ productId, warehouseId, quantity: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('deve impedir movimentação se o depósito estiver inativo', async () => {
      warehousesService.findOne.mockResolvedValue(inactiveWarehouse);

      await expect(
        service.inbound({ productId, warehouseId, quantity: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('consultas', () => {
    it('deve listar saldos filtrando por productId e warehouseId', async () => {
      const items = [{ id: 'inv-1', productId, warehouseId, quantity: 10 }] as InventoryItem[];
      inventoryRepository.find?.mockResolvedValue(items);

      const result = await service.findAll({ productId, warehouseId });

      expect(inventoryRepository.find).toHaveBeenCalledWith({
        where: { productId, warehouseId },
        relations: { product: true, warehouse: true },
        order: { updatedAt: 'DESC' },
      });
      expect(result).toEqual(items);
    });

    it('deve lançar NotFoundException ao buscar saldo por ID inexistente', async () => {
      inventoryRepository.findOne?.mockResolvedValue(null);

      await expect(service.findOne('uuid-inexistente')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deve listar movimentações filtrando por tipo', async () => {
      const movements = [{ id: 'mov-1', type: StockMovementType.INBOUND }] as StockMovement[];
      movementRepository.find?.mockResolvedValue(movements);

      const result = await service.findMovements({
        productId,
        type: StockMovementType.INBOUND,
      });

      expect(movementRepository.find).toHaveBeenCalledWith({
        where: { productId, type: StockMovementType.INBOUND },
        relations: { product: true, warehouse: true },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(movements);
    });
  });
});
