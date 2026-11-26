import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

// Campos comuns para qualquer operação de movimentação de estoque.
export class StockMovementBaseDto {
  @IsUUID('4', { message: 'O ID do produto deve ser um UUID v4 válido.' })
  productId: string;

  @IsUUID('4', { message: 'O ID do depósito deve ser um UUID v4 válido.' })
  warehouseId: string;
}

// DTO utilizado para entradas (inbound) e saídas (outbound) de mercadorias.
export class StockChangeDto extends StockMovementBaseDto {
  @IsInt({ message: 'A quantidade deve ser um número inteiro.' })
  @Min(1, { message: 'A quantidade movimentada deve ser de pelo menos 1 unidade.' })
  quantity: number;

  @IsOptional()
  @IsString({ message: 'O motivo deve ser um texto.' })
  @MaxLength(255, { message: 'O motivo deve ter no máximo 255 caracteres.' })
  reason?: string;
}

// DTO utilizado para ajuste manual de inventário (define o novo saldo contado).
// O motivo é obrigatório para garantir rastreabilidade em auditorias.
export class AdjustStockDto extends StockMovementBaseDto {
  @IsInt({ message: 'A quantidade deve ser um número inteiro.' })
  @Min(0, { message: 'O saldo ajustado não pode ser negativo.' })
  quantity: number;

  @IsNotEmpty({ message: 'O motivo do ajuste de estoque é obrigatório.' })
  @IsString({ message: 'O motivo deve ser um texto.' })
  @MaxLength(255, { message: 'O motivo deve ter no máximo 255 caracteres.' })
  reason: string;
}
