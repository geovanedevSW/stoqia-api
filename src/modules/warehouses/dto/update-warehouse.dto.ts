import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// DTO para atualização parcial de um depósito existente.
export class UpdateWarehouseDto {
  @IsOptional()
  @IsString({ message: 'O nome do depósito deve ser um texto.' })
  @MaxLength(255, { message: 'O nome do depósito deve ter no máximo 255 caracteres.' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'A localização deve ser um texto.' })
  @MaxLength(255, { message: 'A localização deve ter no máximo 255 caracteres.' })
  location?: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive deve ser um valor booleano.' })
  isActive?: boolean;
}
