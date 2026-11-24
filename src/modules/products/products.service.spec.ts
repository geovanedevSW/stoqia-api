import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

describe('ProductsService', () => {
  let service: ProductsService;
  let repository: jest.Mocked<Partial<Repository<Product>>>;

  beforeEach(async () => {
    // Mockamos o repositório do TypeORM para testar as regras do serviço
    // sem precisar de conexão com banco de dados real durante os testes unitários.
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('deve criar um produto com sucesso normalizando o SKU', async () => {
      const dto = {
        name: 'Smartphone Pro',
        sku: ' sm-pro-01 ',
        price: 3999.0,
      };

      // Simula que o SKU ainda não existe no banco
      repository.findOne?.mockResolvedValue(null);

      const fakeCreatedProduct = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: dto.name,
        sku: 'SM-PRO-01',
        description: null,
        price: dto.price,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Product;

      repository.create?.mockReturnValue(fakeCreatedProduct);
      repository.save?.mockResolvedValue(fakeCreatedProduct);

      const result = await service.create(dto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { sku: 'SM-PRO-01' },
      });
      expect(result.sku).toBe('SM-PRO-01');
      expect(result.name).toBe('Smartphone Pro');
    });

    it('deve lançar ConflictException se o SKU já estiver em uso', async () => {
      const dto = {
        name: 'Outro Smartphone',
        sku: 'SM-PRO-01',
        price: 2999.0,
      };

      // Simula que o SKU já existe
      repository.findOne?.mockResolvedValue({ id: 'existing-id' } as Product);

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('findOne', () => {
    it('deve retornar o produto quando encontrado pelo ID', async () => {
      const fakeProduct = {
        id: 'uuid-valido',
        name: 'Produto Teste',
      } as Product;

      repository.findOne?.mockResolvedValue(fakeProduct);

      const result = await service.findOne('uuid-valido');
      expect(result).toEqual(fakeProduct);
    });

    it('deve lançar NotFoundException quando o produto não existir', async () => {
      repository.findOne?.mockResolvedValue(null);

      await expect(service.findOne('uuid-inexistente')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deve realizar soft delete desativando o produto (isActive = false)', async () => {
      const fakeProduct = {
        id: 'uuid-valido',
        name: 'Produto Ativo',
        isActive: true,
      } as Product;

      repository.findOne?.mockResolvedValue(fakeProduct);
      repository.save?.mockResolvedValue({ ...fakeProduct, isActive: false });

      await service.remove('uuid-valido');

      expect(fakeProduct.isActive).toBe(false);
      expect(repository.save).toHaveBeenCalledWith(fakeProduct);
    });
  });
});
