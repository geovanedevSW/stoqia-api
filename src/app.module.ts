import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { dataSourceOptions } from './database/data-source';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

// Módulo raiz da aplicação.
// No NestJS, os módulos servem para organizar e juntar as peças do sistema:
// imports (outros módulos), controllers (rotas HTTP) e providers (serviços e repositórios).
@Module({
  imports: [
    // Carrega as variáveis do arquivo .env. O isGlobal deixa o ConfigService disponível no projeto todo.
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Conecta no PostgreSQL usando as opções que configuramos no data-source.ts
    TypeOrmModule.forRoot(dataSourceOptions),

    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'stoqia-api',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
