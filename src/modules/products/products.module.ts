import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './entities/product.entity';

// Módulo do NestJS que encapsula toda a funcionalidade de Produtos.
// Registra o repositório do TypeORM, o controller e o service.
// Exporta o ProductsService e o TypeOrmModule para que futuros módulos (como estoque e transferências)
// possam consultar produtos facilmente.
@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService, TypeOrmModule],
})
export class ProductsModule {}
