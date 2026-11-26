import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from '../products/products.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { InventoryItem } from './entities/inventory-item.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

// Módulo de controle de saldo em estoque e histórico auditável de movimentações.
// Importa ProductsModule e WarehousesModule para validar que produto e depósito existem e estão ativos.
@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryItem, StockMovement]),
    ProductsModule,
    WarehousesModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService, TypeOrmModule],
})
export class InventoryModule {}
