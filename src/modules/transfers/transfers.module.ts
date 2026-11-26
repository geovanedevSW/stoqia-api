import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from '../products/products.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
import { Transfer } from './entities/transfer.entity';
import { TransfersService } from './transfers.service';
import { TransfersController } from './transfers.controller';

// Módulo responsável pelas transferências concorrentes e atômicas entre depósitos.
@Module({
  imports: [
    TypeOrmModule.forFeature([Transfer, InventoryItem, StockMovement]),
    ProductsModule,
    WarehousesModule,
  ],
  controllers: [TransfersController],
  providers: [TransfersService],
  exports: [TransfersService, TypeOrmModule],
})
export class TransfersModule {}
