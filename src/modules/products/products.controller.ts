import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

// Controller REST para o gerenciamento de produtos.
// Expõe as rotas HTTP sob o prefixo /products e delega as operações para o ProductsService.
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // POST /products - Cadastra um novo produto
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  // GET /products - Lista todos os produtos
  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  // GET /products/:id - Busca um produto específico pelo UUID
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.productsService.findOne(id);
  }

  // PATCH /products/:id - Atualiza dados parciais de um produto
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  // DELETE /products/:id - Inativa o produto (Soft Delete)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.productsService.remove(id);
  }
}
