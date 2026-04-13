import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController, PermissionsController, AuditLogsController } from './admin.controller';
import { AuditLog } from '../audit/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [SettingsController, PermissionsController, AuditLogsController],
})
export class AdminModule {}
