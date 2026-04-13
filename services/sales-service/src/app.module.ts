import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import {
  databaseConfig,
  redisConfig,
  jwtConfig,
  appConfig,
  rabbitmqConfig,
  salesConfig,
  cashClosingConfig,
  fneConfig,
} from './config';

import { RedisModule } from './redis/redis.module';
import { AuditModule } from './audit/audit.module';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from './common/guards';
import { ClientsModule } from './clients/clients.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { PaymentsModule } from './payments/payments.module';
import { ReceivablesModule } from './receivables/receivables.module';
import { CashClosingModule } from './cash-closing/cash-closing.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FneModule } from './fne/fne.module';

// Entities
import { Client } from './entities/client.entity';
import { Product } from './entities/product.entity';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { Payment } from './entities/payment.entity';
import { Receivable } from './entities/receivable.entity';
import { CashDay } from './entities/cash-day.entity';
import { CashMovement } from './entities/cash-movement.entity';
import { AuditLog } from './audit/audit-log.entity';
import { FneInvoice } from './entities/fne-invoice.entity';
import { FneInvoiceItem } from './entities/fne-invoice-item.entity';
import { FneApiLog } from './entities/fne-api-log.entity';
import { FneClient } from './entities/fne-client.entity';
import { FneProduct } from './entities/fne-product.entity';
import { FnePointOfSale } from './entities/fne-point-of-sale.entity';
import { FneEstablishment } from './entities/fne-establishment.entity';
import { FneSetting } from './entities/fne-setting.entity';
import { FneAccountingEntry } from './entities/fne-accounting-entry.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        redisConfig,
        jwtConfig,
        appConfig,
        rabbitmqConfig,
        salesConfig,
        cashClosingConfig,
        fneConfig,
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        type: 'mssql' as const,
        host: cfg.get<string>('database.host'),
        port: cfg.get<number>('database.port'),
        username: cfg.get<string>('database.username'),
        password: cfg.get<string>('database.password'),
        database: cfg.get<string>('database.database'),
        entities: [
          Client,
          Product,
          Sale,
          SaleItem,
          Payment,
          Receivable,
          CashDay,
          CashMovement,
          AuditLog,
          FneInvoice,
          FneInvoiceItem,
          FneApiLog,
          FneClient,
          FneProduct,
          FnePointOfSale,
          FneEstablishment,
          FneSetting,
          FneAccountingEntry,
        ],
        synchronize: false,
        logging: cfg.get<string>('app.nodeEnv') === 'development',
        options: { encrypt: false, trustServerCertificate: true },
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        throttlers: [
          {
            ttl: cfg.get<number>('app.throttleTtl') || 60,
            limit: cfg.get<number>('app.throttleLimit') || 100,
          },
        ],
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    RedisModule,
    EventsModule,
    AuditModule,
    AuthModule,
    ClientsModule,
    ProductsModule,
    SalesModule,
    PaymentsModule,
    ReceivablesModule,
    CashClosingModule,
    DashboardModule,
    FneModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
