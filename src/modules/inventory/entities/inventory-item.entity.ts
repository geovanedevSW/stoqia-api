import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Check,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';

// Entidade que guarda o saldo atual de um produto em um depósito específico.
// A chave única composta (product_id, warehouse_id) garante apenas uma linha de saldo
// por combinação de produto + depósito, evitando duplicidades em requisições concorrentes.
@Entity('inventory_items')
@Unique('UQ_inventory_product_warehouse', ['productId', 'warehouseId'])
@Check('CHK_inventory_quantity_non_negative', '"quantity" >= 0')
export class InventoryItem {
  // Identificador único gerado automaticamente como UUID v4
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'product_id' })
  productId: string;

  @Column({ type: 'uuid', name: 'warehouse_id' })
  warehouseId: string;

  // Relacionamento com o produto do catálogo (impede remoção física se houver estoque)
  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  // Relacionamento com o depósito físico (impede remoção física se houver estoque)
  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  // Quantidade física disponível no depósito.
  // A constraint CHECK ("quantity" >= 0) no PostgreSQL funciona como defesa extra contra saldo negativo.
  @Column({ type: 'integer', default: 0 })
  quantity: number;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt: Date;
}
