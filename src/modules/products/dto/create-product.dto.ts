import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

// DTO (Data Transfer Object) de criação de produto.
// Utiliza os decorators do class-validator para validar a entrada antes de chegar ao controller.
export class CreateProductDto {
  @IsNotEmpty({ message: 'O nome do produto é obrigatório.' })
  @IsString({ message: 'O nome do produto deve ser um texto.' })
  @MaxLength(255, { message: 'O nome do produto deve ter no máximo 255 caracteres.' })
  name: string;

  @IsNotEmpty({ message: 'O SKU do produto é obrigatório.' })
  @IsString({ message: 'O SKU do produto deve ser um texto.' })
  @MaxLength(100, { message: 'O SKU deve ter no máximo 100 caracteres.' })
  sku: string;

  @IsOptional()
  @IsString({ message: 'A descrição deve ser um texto.' })
  description?: string;

  @IsNotEmpty({ message: 'O preço do produto é obrigatório.' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'O preço deve ser um número com até 2 casas decimais.' })
  @IsPositive({ message: 'O preço do produto deve ser maior que zero.' })
  price: number;
}
