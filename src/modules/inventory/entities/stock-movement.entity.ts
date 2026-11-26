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

// Tipos possíveis de movimentação no histórico de estoque (ledger).
// Já inclui TRANSFER_IN e TRANSFER_OUT para suportar o módulo de transferências sem alterar o tipo depois.
export enum StockMovementType {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
  ADJUSTMENT = 'ADJUSTMENT',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
}

// Registro imutável (extrato) de toda alteração de estoque.
// Toda mudança de saldo na tabela 'inventory_items' deve gerar um registro aqui dentro da mesma transação ACID.
@Entity('stock_movements')
@Check('CHK_stock_movements_quantity_positive', '"quantity" > 0')
@Index('IDX_stock_movements_product_warehouse', ['productId', 'warehouseId'])
@Index('IDX_stock_movements_created_at', ['createdAt'])
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'product_id' })
  productId: string;

  @Column({ type: 'uuid', name: 'warehouse_id' })
  warehouseId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  // Tipo da operação realizada no estoque
  @Column({
    type: 'enum',
    enum: StockMovementType,
    enumName: 'stock_movement_type_enum',
  })
  type: StockMovementType;

  // Quantidade movimentada nesta operação (sempre > 0; a direção vem do 'type' e dos saldos)
  @Column({ type: 'integer' })
  quantity: number;

  // Saldo antes da operação (facilita auditoria sem precisar recalcular todo o histórico)
  @Column({ type: 'integer', name: 'previous_balance' })
  previousBalance: number;

  // Saldo após a operação
  @Column({ type: 'integer', name: 'new_balance' })
  newBalance: number;

  // Motivo ou observação da movimentação (ex.: "Compra NF 123", "Contagem física")
  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  // Identificador opcional de correlação (ex.: ID da transferência entre depósitos)
  @Column({ type: 'uuid', name: 'reference_id', nullable: true })
  referenceId: string | null;

  // Timestamp imutável de quando a movimentação foi gravada
  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;
}
