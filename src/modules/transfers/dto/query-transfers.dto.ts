import { IsOptional, IsUUID } from 'class-validator';

// Filtros opcionais para consulta de transferências (GET /transfers).
export class QueryTransfersDto {
  @IsOptional()
  @IsUUID('4', { message: 'O filtro productId deve ser um UUID v4 válido.' })
  productId?: string;

  @IsOptional()
  @IsUUID('4', {
    message: 'O filtro sourceWarehouseId deve ser um UUID v4 válido.',
  })
  sourceWarehouseId?: string;

  @IsOptional()
  @IsUUID('4', {
    message: 'O filtro destinationWarehouseId deve ser um UUID v4 válido.',
  })
  destinationWarehouseId?: string;
}
