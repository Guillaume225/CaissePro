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

import { TenantDataSourceModule } from './tenant/tenant-datasource.module';
import { RedisModule } from './redis/redis.module';
import { AuditModule } from './audit/audit.module';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from './common/guards';
import { SubscriptionModule } from './subscription/subscription.module';
import { FeatureGuard } from './subscription/guards/feature.guard';
import { LimitGuard } from './subscription/guards/limit.guard';
import { ClientsModule } from './clients/clients.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { PaymentsModule } from './payments/payments.module';
import { ReceivablesModule } from './receivables/receivables.module';
import { CashClosingModule } from './cash-closing/cash-closing.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FneModule } from './fne/fne.module';
import { ErpModule } from './erp/erp.module';

// Master (dbo) entities only
import { AuditLog } from './audit/audit-log.entity';

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
        entities: [AuditLog],
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
    TenantDataSourceModule,
    RedisModule,
    EventsModule,
    AuditModule,
    AuthModule,
    SubscriptionModule,
    ClientsModule,
    ProductsModule,
    SalesModule,
    PaymentsModule,
    ReceivablesModule,
    CashClosingModule,
    DashboardModule,
    FneModule,
    ErpModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: FeatureGuard },
    { provide: APP_GUARD, useClass: LimitGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
