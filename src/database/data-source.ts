import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import path from 'path';
import { Product } from '../modules/products/entities/product.entity';

// Carregamos o dotenv aqui porque quando rodamos migrations pelo terminal,
// a CLI do TypeORM executa esse arquivo direto no Node, sem passar pelo NestJS.
config();

// Configuração da conexão com o PostgreSQL.
// Ela é usada tanto pela aplicação rodando quanto pela CLI do TypeORM (para criar e rodar migrations).
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'stoqia_user',
  password: process.env.DB_PASSWORD ?? 'stoqia_pass',
  database: process.env.DB_NAME ?? 'stoqia_db',

  // Entidades registradas explicitamente. Isso evita que o Node tente carregar
  // arquivos .ts como se fossem .js em tempo de execução via glob.
  entities: [Product],

  // Migrations carregadas a partir da pasta atual (__dirname).
  // Em desenvolvimento aponta para src/database/migrations, e em produção para dist/database/migrations.
  migrations: [path.join(__dirname, 'migrations/*{.ts,.js}')],

  // synchronize fica sempre como false. Em projetos reais nunca usamos true,
  // porque se você renomear ou apagar uma propriedade na entidade, o TypeORM apaga a coluna
  // do banco e você perde dados. Toda alteração no banco deve ser feita por migrations.
  synchronize: false,

  // Mostra as queries SQL rodando no terminal durante o desenvolvimento
  logging: process.env.NODE_ENV === 'development',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
