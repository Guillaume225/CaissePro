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
  workflowConfig,
  rabbitmqConfig,
  uploadConfig,
  cashClosingConfig,
} from './config';

import { RedisModule } from './redis/redis.module';
import { AuditModule } from './audit/audit.module';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from './common/guards';
import { CategoriesModule } from './categories/categories.module';
import { ExpensesModule } from './expenses/expenses.module';
import { AdvancesModule } from './advances/advances.module';
import { CashClosingModule } from './cash-closing/cash-closing.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ApprovalCircuitsModule } from './approval-circuits/approval-circuits.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DisbursementRequestsModule } from './disbursement-requests/disbursement-requests.module';
import { AdminQueryModule } from './admin-query/admin-query.module';
import { ReportConfigsModule } from './report-configs/report-configs.module';

// Entities
import { Expense } from './entities/expense.entity';
import { ExpenseCategory } from './entities/expense-category.entity';
import { ExpenseApproval } from './entities/expense-approval.entity';
import { ExpenseAttachment } from './entities/expense-attachment.entity';
import { Advance } from './entities/advance.entity';
import { CashDay } from './entities/cash-day.entity';
import { CashMovement } from './entities/cash-movement.entity';
import { DisbursementRequest } from './entities/disbursement-request.entity';
import { AuditLog } from './audit/audit-log.entity';
import { User } from './entities/user.entity';
import { ReportConfiguration } from './report-configs/report-config.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        redisConfig,
        jwtConfig,
        appConfig,
        workflowConfig,
        rabbitmqConfig,
        uploadConfig,
        cashClosingConfig,
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
          Expense,
          ExpenseCategory,
          ExpenseApproval,
          ExpenseAttachment,
          Advance,
          CashDay,
          CashMovement,
          DisbursementRequest,
          AuditLog,
          User,
          ReportConfiguration,
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
    CategoriesModule,
    ExpensesModule,
    AdvancesModule,
    CashClosingModule,
    DashboardModule,
    ApprovalCircuitsModule,
    NotificationsModule,
    DisbursementRequestsModule,
    AdminQueryModule,
    ReportConfigsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
