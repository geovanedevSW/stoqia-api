import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

// DTO para solicitar uma transferência atômica de estoque entre dois depósitos.
export class CreateTransferDto {
  @IsUUID('4', { message: 'O ID do produto deve ser um UUID v4 válido.' })
  productId: string;

  @IsUUID('4', {
    message: 'O ID do depósito de origem deve ser um UUID v4 válido.',
  })
  sourceWarehouseId: string;

  @IsUUID('4', {
    message: 'O ID do depósito de destino deve ser um UUID v4 válido.',
  })
  destinationWarehouseId: string;

  @IsInt({ message: 'A quantidade deve ser um número inteiro.' })
  @Min(1, {
    message: 'A quantidade transferida deve ser de pelo menos 1 unidade.',
  })
  quantity: number;

  @IsOptional()
  @IsString({ message: 'O motivo deve ser um texto.' })
  @MaxLength(255, { message: 'O motivo deve ter no máximo 255 caracteres.' })
  reason?: string;

  // Chave opcional (alternativa ao header Idempotency-Key) para retries seguros.
  @IsOptional()
  @IsString({ message: 'A chave de idempotência deve ser um texto.' })
  @MaxLength(128, {
    message: 'A chave de idempotência deve ter no máximo 128 caracteres.',
  })
  idempotencyKey?: string;
}
