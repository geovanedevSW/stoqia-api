import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AdjustStockDto, StockChangeDto } from './dto/stock-movement.dto';
import {
  QueryInventoryDto,
  QueryMovementsDto,
} from './dto/query-inventory.dto';

// Controller REST para gestão de saldos e movimentações de estoque (/inventory).
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // POST /inventory/inbound - Registra entrada de mercadoria no depósito
  @Post('inbound')
  @HttpCode(HttpStatus.CREATED)
  inbound(@Body() dto: StockChangeDto) {
    return this.inventoryService.inbound(dto);
  }

  // POST /inventory/outbound - Registra saída de mercadoria do depósito
  @Post('outbound')
  @HttpCode(HttpStatus.CREATED)
  outbound(@Body() dto: StockChangeDto) {
    return this.inventoryService.outbound(dto);
  }

  // POST /inventory/adjust - Ajusta manualmente o saldo conforme contagem física
  @Post('adjust')
  @HttpCode(HttpStatus.CREATED)
  adjust(@Body() dto: AdjustStockDto) {
    return this.inventoryService.adjust(dto);
  }

  // GET /inventory - Lista saldos atuais com filtros opcionais (?productId=...&warehouseId=...)
  @Get()
  findAll(@Query() query: QueryInventoryDto) {
    return this.inventoryService.findAll(query);
  }

  // GET /inventory/movements - Lista histórico imutável de movimentações (declarado antes de ':id')
  @Get('movements')
  findMovements(@Query() query: QueryMovementsDto) {
    return this.inventoryService.findMovements(query);
  }

  // GET /inventory/:id - Busca detalhes de um item de estoque pelo UUID
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.inventoryService.findOne(id);
  }
}
