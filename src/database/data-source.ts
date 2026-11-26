import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import path from 'path';
import { Product } from '../modules/products/entities/product.entity';
import { Warehouse } from '../modules/warehouses/entities/warehouse.entity';
import { InventoryItem } from '../modules/inventory/entities/inventory-item.entity';
import { StockMovement } from '../modules/inventory/entities/stock-movement.entity';
import { Transfer } from '../modules/transfers/entities/transfer.entity';

// Carregamos o dotenv aqui porque quando rodamos migrations pelo terminal,
// a CLI do TypeORM executa esse arquivo direto no Node, sem passar pelo NestJS.
config();

// Configuração da conexão com o PostgreSQL.
// Ela é usada tanto pela aplicação rodando quanto pela CLI do TypeORM (para criar e rodar migrations).
const migrationsDir =
  typeof __dirname !== 'undefined'
    ? path.join(__dirname, 'migrations')
    : path.resolve(process.cwd(), 'src/database/migrations');

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'stoqia_user',
  password: process.env.DB_PASSWORD ?? 'stoqia_pass',
  database: process.env.DB_NAME ?? 'stoqia_db',

  // Entidades registradas explicitamente. Isso evita que o Node tente carregar
  // arquivos .ts como se fossem .js em tempo de execução via glob.
  entities: [Product, Warehouse, InventoryItem, StockMovement, Transfer],

  // Migrations carregadas a partir da pasta atual (__dirname em CJS ou fallback em ESM para testes E2E).
  migrations: [path.join(migrationsDir, '*{.ts,.js}')],

  // synchronize fica sempre como false. Em projetos reais nunca usamos true,
  // porque se você renomear ou apagar uma propriedade na entidade, o TypeORM apaga a coluna
  // do banco e você perde dados. Toda alteração no banco deve ser feita por migrations.
  synchronize: false,

  // Mostra as queries SQL rodando no terminal durante o desenvolvimento
  logging: process.env.NODE_ENV === 'development',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
