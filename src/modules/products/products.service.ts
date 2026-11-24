import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

// Service responsável pelas regras de negócio e manipulação dos produtos no banco.
// No padrão NestJS, os services concentram a lógica da aplicação e injetam os repositórios do TypeORM.
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  // Cria um novo produto garantindo que o SKU seja padronizado e único
  async create(dto: CreateProductDto): Promise<Product> {
    const normalizedSku = dto.sku.trim().toUpperCase();

    // Validação de unicidade do SKU a nível de aplicação
    const existing = await this.productRepository.findOne({
      where: { sku: normalizedSku },
    });

    if (existing) {
      throw new ConflictException(
        `Já existe um produto cadastrado com o SKU '${normalizedSku}'.`,
      );
    }

    const product = this.productRepository.create({
      ...dto,
      sku: normalizedSku,
    });

    return this.productRepository.save(product);
  }

  // Lista todos os produtos ordenados pelos mais recentes
  async findAll(): Promise<Product[]> {
    return this.productRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  // Busca um produto pelo ID (UUID) ou lança erro 404 se não existir
  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Produto com ID '${id}' não foi encontrado.`);
    }

    return product;
  }

  // Busca auxiliar por SKU
  async findBySku(sku: string): Promise<Product | null> {
    return this.productRepository.findOne({
      where: { sku: sku.trim().toUpperCase() },
    });
  }

  // Atualiza dados de um produto existente
  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);

    Object.assign(product, dto);

    return this.productRepository.save(product);
  }

  // Inativação lógica (soft delete). Em sistemas de estoque, nunca apagamos
  // um produto fisicamente se ele tiver histórico de movimentações.
  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    product.isActive = false;
    await this.productRepository.save(product);
  }
}
