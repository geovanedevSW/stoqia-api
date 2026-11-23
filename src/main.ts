import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule, ObserveInstrument } from './app.module';

// Ponto de entrada da aplicação.
// Aqui a gente inicializa o NestJS, sobe o servidor HTTP e configura os recursos globais.
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  // O ValidationPipe global intercepta todas as requisições HTTP que chegam na API.
  // - whitelist: remove qualquer campo que o cliente mandar e que não esteja no DTO (protege contra envio de dados indevidos).
  // - forbidNonWhitelisted: se mandarem campos desconhecidos, recusa a requisição na hora com status 400.
  // - transform: converte tipos automaticamente para o tipo declarado no DTO (ex: texto '10' vira número 10).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Stoqia API rodando na porta ${port}`);
}

void bootstrap();
