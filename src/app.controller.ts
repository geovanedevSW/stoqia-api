import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

// O Controller é a camada de apresentação.
// Ele só deve escutar as requisições HTTP, repassar para os serviços e devolver a resposta.
// Regras de negócio ou consultas diretas ao banco não devem ficar aqui.
@Controller()
export class AppController {
  // Injeção de dependência pelo construtor:
  // Em vez de fazer new AppService(), deixamos o NestJS entregar a instância pronta.
  // Isso deixa o código desacoplado e muito fácil de testar com mocks.
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
