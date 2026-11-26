import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Check,
  Index,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';

// Status da transferência entre depósitos.
export enum TransferStatus {
  COMPLETED = 'COMPLETED',
}

// Entidade que registra uma transferência atômica de estoque entre dois depósitos.
// Garante unicidade por chave de idempotência e impede origem == destino no próprio banco.
@Entity('transfers')
@Check('CHK_transfers_quantity_positive', '"quantity" > 0')
@Check(
  'CHK_transfers_distinct_warehouses',
  '"source_warehouse_id" <> "destination_warehouse_id"',
)
@Index('IDX_transfers_product_id', ['productId'])
@Index('IDX_transfers_source_warehouse_id', ['sourceWarehouseId'])
@Index('IDX_transfers_destination_warehouse_id', ['destinationWarehouseId'])
@Index('IDX_transfers_created_at', ['createdAt'])
export class Transfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'product_id' })
  productId: string;

  @Column({ type: 'uuid', name: 'source_warehouse_id' })
  sourceWarehouseId: string;

  @Column({ type: 'uuid', name: 'destination_warehouse_id' })
  destinationWarehouseId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'source_warehouse_id' })
  sourceWarehouse: Warehouse;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destination_warehouse_id' })
  destinationWarehouse: Warehouse;

  // Quantidade transferida (sempre > 0)
  @Column({ type: 'integer' })
  quantity: number;

  @Column({
    type: 'enum',
    enum: TransferStatus,
    enumName: 'transfer_status_enum',
    default: TransferStatus.COMPLETED,
  })
  status: TransferStatus;

  // Observação opcional sobre o motivo logístico da transferência
  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  // Chave opcional enviada pelo cliente (header Idempotency-Key ou body)
  // para impedir transferências duplicadas em caso de retry de rede.
  @Column({
    type: 'varchar',
    length: 128,
    name: 'idempotency_key',
    nullable: true,
    unique: true,
  })
  idempotencyKey: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;
}
