import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Company } from '../entities/company.entity';
import { Department } from '../entities/department.entity';
import { Service } from '../entities/service.entity';

export function tenantSchema(tenantId: string): string {
  return `t_${tenantId.replace(/-/g, '_')}`;
}

const TENANT_ENTITIES = [User, Role, Company, Department, Service];

@Injectable()
export class TenantDataSourceService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantDataSourceService.name);
  private readonly pool = new Map<string, DataSource>();

  constructor(private readonly configService: ConfigService) {}

  async getDataSource(tenantId: string): Promise<DataSource> {
    const cached = this.pool.get(tenantId);
    if (cached) return cached;
    return this.initDataSource(tenantId);
  }

  async synchronizeSchema(tenantId: string): Promise<void> {
    const ds = await this.getDataSource(tenantId);
    await ds.synchronize();
    this.logger.log(`[SCHEMA-SYNC] tenant=${tenantId} schema=${tenantSchema(tenantId)}`);
  }

  private async initDataSource(tenantId: string): Promise<DataSource> {
    const schema = tenantSchema(tenantId);
    const ds = new DataSource({
      type: 'mssql',
      host: this.configService.get<string>('database.host')!,
      port: this.configService.get<number>('database.port')!,
      username: this.configService.get<string>('database.username')!,
      password: this.configService.get<string>('database.password')!,
      database: this.configService.get<string>('database.database')!,
      schema,
      entities: TENANT_ENTITIES,
      synchronize: false,
      options: { encrypt: false, trustServerCertificate: true },
    });

    await ds.initialize();
    this.pool.set(tenantId, ds);
    this.logger.log(`[DATASOURCE-INIT] tenant=${tenantId} schema=${schema}`);
    return ds;
  }

  async onModuleDestroy(): Promise<void> {
    const destroys = [...this.pool.values()].map((ds) => ds.destroy());
    await Promise.all(destroys);
  }
}
