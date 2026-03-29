import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { InitialMigration1711600000000 } from './migrations/1711600000000-InitialMigration';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'caisseflow',
  password: process.env.POSTGRES_PASSWORD || 'caisseflow',
  database: process.env.POSTGRES_DB || 'caisseflow',
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
  entities: [__dirname + '/entities/**/*.{ts,js}'],
  migrations: [InitialMigration1711600000000],
});
