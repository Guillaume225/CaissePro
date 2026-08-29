import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Expense } from '../entities/expense.entity';
import { ExpenseCategory } from '../entities/expense-category.entity';
import { ExpenseApproval } from '../entities/expense-approval.entity';
import { ExpenseAttachment } from '../entities/expense-attachment.entity';
import { Advance } from '../entities/advance.entity';
import { CashDay } from '../entities/cash-day.entity';
import { CashMovement } from '../entities/cash-movement.entity';
import { DisbursementRequest } from '../entities/disbursement-request.entity';
import { User } from '../entities/user.entity';
import { ReportConfiguration } from '../report-configs/report-config.entity';
import { ApprovalCircuit } from '../approval-circuits/approval-circuit.entity';
import { ApprovalCircuitStep } from '../approval-circuits/approval-circuit-step.entity';

export function tenantSchema(tenantId: string): string {
  return `t_${tenantId.replace(/-/g, '_')}`;
}

const TENANT_ENTITIES = [
  Expense,
  ExpenseCategory,
  ExpenseApproval,
  ExpenseAttachment,
  Advance,
  CashDay,
  CashMovement,
  DisbursementRequest,
  User,
  ReportConfiguration,
  ApprovalCircuit,
  ApprovalCircuitStep,
];

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
