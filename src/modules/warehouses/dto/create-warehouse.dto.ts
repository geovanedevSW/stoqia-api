import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// DTO para criação de um novo depósito.
export class CreateWarehouseDto {
  @IsNotEmpty({ message: 'O nome do depósito é obrigatório.' })
  @IsString({ message: 'O nome do depósito deve ser um texto.' })
  @MaxLength(255, { message: 'O nome do depósito deve ter no máximo 255 caracteres.' })
  name: string;

  @IsNotEmpty({ message: 'O código do depósito é obrigatório.' })
  @IsString({ message: 'O código do depósito deve ser um texto.' })
  @MaxLength(50, { message: 'O código do depósito deve ter no máximo 50 caracteres.' })
  code: string;

  @IsOptional()
  @IsString({ message: 'A localização deve ser um texto.' })
  @MaxLength(255, { message: 'A localização deve ter no máximo 255 caracteres.' })
  location?: string;
}
