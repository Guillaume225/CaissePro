import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import {
  databaseConfig,
  redisConfig,
  jwtConfig,
  appConfig,
  rabbitmqConfig,
  uploadConfig,
} from './config';

import { RedisModule } from './redis/redis.module';
import { AuditModule } from './audit/audit.module';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from './common/guards';
import { CategoriesModule } from './categories/categories.module';
import { ExpensesModule } from './expenses/expenses.module';
import { BudgetsModule } from './budgets/budgets.module';
import { AdvancesModule } from './advances/advances.module';

// Entities
import { Expense } from './entities/expense.entity';
import { ExpenseCategory } from './entities/expense-category.entity';
import { ExpenseApproval } from './entities/expense-approval.entity';
import { ExpenseAttachment } from './entities/expense-attachment.entity';
import { Budget } from './entities/budget.entity';
import { Advance } from './entities/advance.entity';
import { AuditLog } from './audit/audit-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, jwtConfig, appConfig, rabbitmqConfig, uploadConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres' as const,
        host: cfg.get<string>('database.host'),
        port: cfg.get<number>('database.port'),
        username: cfg.get<string>('database.username'),
        password: cfg.get<string>('database.password'),
        database: cfg.get<string>('database.name'),
        entities: [
          Expense,
          ExpenseCategory,
          ExpenseApproval,
          ExpenseAttachment,
          Budget,
          Advance,
          AuditLog,
        ],
        synchronize: cfg.get<string>('app.nodeEnv') !== 'production',
        logging: cfg.get<string>('app.nodeEnv') === 'development',
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
    RedisModule,
    EventsModule,
    AuditModule,
    AuthModule,
    CategoriesModule,
    ExpensesModule,
    BudgetsModule,
    AdvancesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
