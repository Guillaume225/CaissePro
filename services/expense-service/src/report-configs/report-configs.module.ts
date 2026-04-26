import { Module } from '@nestjs/common';
import { ReportConfigsService } from './report-configs.service';
import { ReportConfigsController } from './report-configs.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ReportConfigsController],
  providers: [ReportConfigsService],
  exports: [ReportConfigsService],
})
export class ReportConfigsModule {}
