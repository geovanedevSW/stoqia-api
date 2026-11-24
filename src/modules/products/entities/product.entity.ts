import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// Entidade que representa a tabela 'products' no PostgreSQL.
// No padrão tradicional do NestJS, a entidade mapeia diretamente colunas, tipos e restrições.
@Entity('products')
export class Product {
  // Chave primária gerada automaticamente como UUID v4
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Nome do produto (ex.: "Smartphone Galaxy S24")
  @Column({ type: 'varchar', length: 255 })
  name: string;

  // SKU (Stock Keeping Unit): identificador único comercial.
  // A restrição unique: true no banco garante que requisições concorrentes não criem produtos duplicados.
  @Column({ type: 'varchar', length: 100, unique: true })
  sku: string;

  // Descrição detalhada (opcional)
  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Preço unitário.
  // O PostgreSQL retorna colunas decimal/numeric como string para evitar perda de precisão em ponto flutuante.
  // O transformer converte automaticamente para número no JavaScript.
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => (typeof value === 'string' ? parseFloat(value) : value),
    },
  })
  price: number;

  // Flag para controle de ativação/desativação no catálogo
  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  // Data de criação preenchida automaticamente pelo banco
  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;

  // Data da última alteração atualizada automaticamente pelo TypeORM
  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt: Date;
}
