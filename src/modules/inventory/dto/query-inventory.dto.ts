import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { StockMovementType } from '../entities/stock-movement.entity';

// Filtros opcionais para consulta de saldos em estoque (GET /inventory).
export class QueryInventoryDto {
  @IsOptional()
  @IsUUID('4', { message: 'O filtro productId deve ser um UUID v4 válido.' })
  productId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'O filtro warehouseId deve ser um UUID v4 válido.' })
  warehouseId?: string;
}

// Filtros opcionais para consulta do histórico de movimentações (GET /inventory/movements).
export class QueryMovementsDto extends QueryInventoryDto {
  @IsOptional()
  @IsEnum(StockMovementType, {
    message:
      'O filtro type deve ser INBOUND, OUTBOUND, ADJUSTMENT, TRANSFER_IN ou TRANSFER_OUT.',
  })
  type?: StockMovementType;
}
