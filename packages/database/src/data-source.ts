import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { InitialMigration1711600000000 } from './migrations/1711600000000-InitialMigration';
import { AddMultiTenancy1711700000000 } from './migrations/1711700000000-AddMultiTenancy';
import { AddCashDayTables1712000000000 } from './migrations/1712000000000-AddCashDayTables';
import { AddDisbursementAndValidation1712100000000 } from './migrations/1712100000000-AddDisbursementAndValidation';
import { AddReportConfigs1712200000000 } from './migrations/1712200000000-AddReportConfigs';
import { AddEmployees1712300000000 } from './migrations/1712300000000-AddEmployees';

export const AppDataSource = new DataSource({
  type: 'mssql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  username: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Toi&MoiSaFait1',
  database: process.env.DB_NAME || 'caisseflow',
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
  entities: [__dirname + '/entities/**/*.{ts,js}'],
  migrations: [InitialMigration1711600000000, AddMultiTenancy1711700000000, AddCashDayTables1712000000000, AddDisbursementAndValidation1712100000000, AddReportConfigs1712200000000, AddEmployees1712300000000],
  options: { encrypt: false, trustServerCertificate: true },
});
