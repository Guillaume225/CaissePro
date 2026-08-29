import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { databaseConfig, redisConfig, jwtConfig, appConfig, rabbitmqConfig, uploadConfig } from './config';

import { TenantDataSourceModule } from './tenant/tenant-datasource.module';
import { RedisModule } from './redis/redis.module';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from './common/guards';
import { ApprovalCircuitsModule } from './approval-circuits/approval-circuits.module';
import { PurchaseRequestsModule } from './purchase-requests/purchase-requests.module';
import { PurchasingModule } from './purchasing/purchasing.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, jwtConfig, appConfig, rabbitmqConfig, uploadConfig],
    }),
    // No master (dbo)-schema entities are owned by this service — all data
    // lives in the per-tenant schema managed by TenantDataSourceService.
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        type: 'mssql' as const,
        host: cfg.get<string>('database.host'),
        port: cfg.get<number>('database.port'),
        username: cfg.get<string>('database.username'),
        password: cfg.get<string>('database.password'),
        database: cfg.get<string>('database.database'),
        entities: [],
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
    TenantDataSourceModule,
    RedisModule,
    EventsModule,
    AuthModule,
    ApprovalCircuitsModule,
    PurchaseRequestsModule,
    PurchasingModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
