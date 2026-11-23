import { Injectable } from '@nestjs/common';

// O decorator @Injectable() diz para o NestJS que essa classe pode ser gerenciada
// pelo container de injeção de dependência e entregue para quem precisar dela (como controllers).
@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
