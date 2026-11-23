import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Teste unitário do controller.
// Não sobe servidor web nem acessa banco de dados. Apenas testa a classe de forma isolada e rápida.
describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    // Cria um módulo de teste simulando o container do NestJS apenas com as peças necessárias
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('deve retornar "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
