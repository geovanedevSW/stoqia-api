import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

// DTO para atualização parcial de dados do produto.
// Todos os campos são opcionais, permitindo atualizar apenas o que for enviado no PATCH.
export class UpdateProductDto {
  @IsOptional()
  @IsString({ message: 'O nome do produto deve ser um texto.' })
  @MaxLength(255, { message: 'O nome do produto deve ter no máximo 255 caracteres.' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'A descrição deve ser um texto.' })
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'O preço deve ser um número com até 2 casas decimais.' })
  @IsPositive({ message: 'O preço do produto deve ser maior que zero.' })
  price?: number;

  @IsOptional()
  @IsBoolean({ message: 'isActive deve ser um valor booleano.' })
  isActive?: boolean;
}
