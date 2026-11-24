import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse } from './entities/warehouse.entity';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

// Service responsável pelas regras de negócio e manipulação dos depósitos.
@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
  ) {}

  // Cria um novo depósito garantindo código padronizado e único
  async create(dto: CreateWarehouseDto): Promise<Warehouse> {
    const normalizedCode = dto.code.trim().toUpperCase();

    const existing = await this.warehouseRepository.findOne({
      where: { code: normalizedCode },
    });

    if (existing) {
      throw new ConflictException(
        `Já existe um depósito cadastrado com o código '${normalizedCode}'.`,
      );
    }

    const warehouse = this.warehouseRepository.create({
      ...dto,
      code: normalizedCode,
    });

    return this.warehouseRepository.save(warehouse);
  }

  // Lista todos os depósitos
  async findAll(): Promise<Warehouse[]> {
    return this.warehouseRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  // Busca depósito por ID (UUID)
  async findOne(id: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException(`Depósito com ID '${id}' não foi encontrado.`);
    }

    return warehouse;
  }

  // Busca auxiliar por código
  async findByCode(code: string): Promise<Warehouse | null> {
    return this.warehouseRepository.findOne({
      where: { code: code.trim().toUpperCase() },
    });
  }

  // Atualiza dados de um depósito existente
  async update(id: string, dto: UpdateWarehouseDto): Promise<Warehouse> {
    const warehouse = await this.findOne(id);
    Object.assign(warehouse, dto);
    return this.warehouseRepository.save(warehouse);
  }

  // Inativação lógica (soft delete) para preservar histórico de movimentações
  async remove(id: string): Promise<void> {
    const warehouse = await this.findOne(id);
    warehouse.isActive = false;
    await this.warehouseRepository.save(warehouse);
  }
}
