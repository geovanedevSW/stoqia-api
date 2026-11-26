import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { QueryTransfersDto } from './dto/query-transfers.dto';

// Controller REST para transferências atômicas entre depósitos (/transfers).
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  // POST /transfers - Transfere estoque entre depósitos com proteção contra concorrência
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateTransferDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transfersService.create(dto, idempotencyKey);
  }

  // GET /transfers - Lista transferências com filtros opcionais
  @Get()
  findAll(@Query() query: QueryTransfersDto) {
    return this.transfersService.findAll(query);
  }

  // GET /transfers/:id - Busca detalhes de uma transferência pelo UUID
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.transfersService.findOne(id);
  }
}
