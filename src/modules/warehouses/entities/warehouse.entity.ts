import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// Entidade que representa a tabela 'warehouses' (depósitos/locais físicos) no PostgreSQL.
@Entity('warehouses')
export class Warehouse {
  // Identificador único (UUID) gerado automaticamente pelo banco
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Nome do depósito (ex.: "Centro de Distribuição São Paulo", "Depósito A")
  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Código único de identificação logística (ex.: "WH-A", "CD-SP-01").
  // Possui índice único no banco para impedir depósitos duplicados.
  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  // Localização ou endereço físico (opcional, ex.: "São Paulo - SP")
  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string | null;

  // Controle de ativação do galpão (soft delete)
  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt: Date;
}
