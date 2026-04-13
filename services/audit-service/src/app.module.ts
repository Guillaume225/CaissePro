import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

import {
  databaseConfig,
  redisConfig,
  jwtConfig,
  appConfig,
  rabbitmqConfig,
  auditConfig,
} from '@/config';
import { RedisModule } from '@/redis/redis.module';
import { AuthModule } from '@/auth/auth.module';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard, PermissionsGuard } from '@/common/guards';
import { AuditLog } from '@/entities/audit-log.entity';
import { ConsumerModule } from '@/consumer/consumer.module';
import { AuditLogsModule } from '@/audit-logs/audit-logs.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, jwtConfig, appConfig, rabbitmqConfig, auditConfig],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mssql' as const,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),
        entities: [AuditLog],
        synchronize: config.get<string>('app.env') !== 'production',
        logging: config.get<string>('app.env') === 'development',
        options: { encrypt: false, trustServerCertificate: true },
      }),
    }),

    // Rate limiting
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // Scheduled tasks (retention cron)
    ScheduleModule.forRoot(),

    // Infrastructure
    RedisModule,
    AuthModule,

    // Feature modules
    ConsumerModule,
    AuditLogsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
