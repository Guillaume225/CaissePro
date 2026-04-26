import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Client } from '../entities/client.entity';
import { Product } from '../entities/product.entity';
import { Sale } from '../entities/sale.entity';
import { SaleItem } from '../entities/sale-item.entity';
import { Payment } from '../entities/payment.entity';
import { Receivable } from '../entities/receivable.entity';
import { CashDay } from '../entities/cash-day.entity';
import { CashMovement } from '../entities/cash-movement.entity';
import { FneInvoice } from '../entities/fne-invoice.entity';
import { FneInvoiceItem } from '../entities/fne-invoice-item.entity';
import { FneApiLog } from '../entities/fne-api-log.entity';
import { FneClient } from '../entities/fne-client.entity';
import { FneProduct } from '../entities/fne-product.entity';
import { FnePointOfSale } from '../entities/fne-point-of-sale.entity';
import { FneEstablishment } from '../entities/fne-establishment.entity';
import { FneSetting } from '../entities/fne-setting.entity';
import { FneAccountingEntry } from '../entities/fne-accounting-entry.entity';
import { ErpSetting } from '../entities/erp-setting.entity';

export function tenantSchema(tenantId: string): string {
  return `t_${tenantId.replace(/-/g, '_')}`;
}

const TENANT_ENTITIES = [
  Client,
  Product,
  Sale,
  SaleItem,
  Payment,
  Receivable,
  CashDay,
  CashMovement,
  FneInvoice,
  FneInvoiceItem,
  FneApiLog,
  FneClient,
  FneProduct,
  FnePointOfSale,
  FneEstablishment,
  FneSetting,
  FneAccountingEntry,
  ErpSetting,
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
