import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { PurchaseRequest } from '../entities/purchase-request.entity';
import { PurchaseRequestLine } from '../entities/purchase-request-line.entity';
import { PurchaseRequestAttachment } from '../entities/purchase-request-attachment.entity';
import { PurchaseRequestApproval } from '../entities/purchase-request-approval.entity';
import { PurchaseRequestHistory } from '../entities/purchase-request-history.entity';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { PurchaseRequestApprovalCircuit } from '../approval-circuits/purchase-request-approval-circuit.entity';
import { PurchaseRequestApprovalCircuitStep } from '../approval-circuits/purchase-request-approval-circuit-step.entity';

export function tenantSchema(tenantId: string): string {
  return `t_${tenantId.replace(/-/g, '_')}`;
}

const TENANT_ENTITIES = [
  PurchaseRequest,
  PurchaseRequestLine,
  PurchaseRequestAttachment,
  PurchaseRequestApproval,
  PurchaseRequestHistory,
  User,
  Role,
  PurchaseRequestApprovalCircuit,
  PurchaseRequestApprovalCircuitStep,
];

/**
 * Per-tenant DataSource pool with `synchronize: true`.
 *
 * There is no uniform migration mechanism for services added after initial
 * tenant provisioning (see hr-service's TenantDataSourceService for the
 * precedent). `synchronize: true` lazily auto-creates/alters this service's
 * tables the first time getDataSource(tenantId) is called for a given
 * tenant — works for both brand-new and already-provisioned tenants with
 * zero extra plumbing.
 */
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
      synchronize: true,
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
