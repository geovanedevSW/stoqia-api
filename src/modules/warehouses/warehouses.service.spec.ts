import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { WarehousesService } from './warehouses.service';
import { Warehouse } from './entities/warehouse.entity';

describe('WarehousesService', () => {
  let service: WarehousesService;
  let repository: jest.Mocked<Partial<Repository<Warehouse>>>;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousesService,
        {
          provide: getRepositoryToken(Warehouse),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<WarehousesService>(WarehousesService);
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('deve criar um depósito normalizando o código em maiúsculo', async () => {
      const dto = {
        name: 'Centro de Distribuição Principal',
        code: ' cd-sp-01 ',
        location: 'São Paulo - SP',
      };

      repository.findOne?.mockResolvedValue(null);

      const fakeCreatedWarehouse = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: dto.name,
        code: 'CD-SP-01',
        location: dto.location,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Warehouse;

      repository.create?.mockReturnValue(fakeCreatedWarehouse);
      repository.save?.mockResolvedValue(fakeCreatedWarehouse);

      const result = await service.create(dto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { code: 'CD-SP-01' },
      });
      expect(result.code).toBe('CD-SP-01');
      expect(result.name).toBe('Centro de Distribuição Principal');
    });

    it('deve lançar ConflictException se o código já existir', async () => {
      const dto = {
        name: 'Outro Galpão',
        code: 'CD-SP-01',
      };

      repository.findOne?.mockResolvedValue({ id: 'existing-id' } as Warehouse);

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('findOne', () => {
    it('deve retornar o depósito quando encontrado pelo ID', async () => {
      const fakeWarehouse = {
        id: 'uuid-valido',
        name: 'Depósito A',
        code: 'DEP-A',
      } as Warehouse;

      repository.findOne?.mockResolvedValue(fakeWarehouse);

      const result = await service.findOne('uuid-valido');
      expect(result).toEqual(fakeWarehouse);
    });

    it('deve lançar NotFoundException quando o depósito não existir', async () => {
      repository.findOne?.mockResolvedValue(null);

      await expect(service.findOne('uuid-inexistente')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deve realizar soft delete inativando o depósito (isActive = false)', async () => {
      const fakeWarehouse = {
        id: 'uuid-valido',
        name: 'Depósito A',
        isActive: true,
      } as Warehouse;

      repository.findOne?.mockResolvedValue(fakeWarehouse);
      repository.save?.mockResolvedValue({ ...fakeWarehouse, isActive: false });

      await service.remove('uuid-valido');

      expect(fakeWarehouse.isActive).toBe(false);
      expect(repository.save).toHaveBeenCalledWith(fakeWarehouse);
    });
  });
});
