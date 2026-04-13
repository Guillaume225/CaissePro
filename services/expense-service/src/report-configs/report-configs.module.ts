import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportConfiguration } from './report-config.entity';
import { ReportConfigsService } from './report-configs.service';
import { ReportConfigsController } from './report-configs.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([ReportConfiguration]), AuditModule],
  controllers: [ReportConfigsController],
  providers: [ReportConfigsService],
  exports: [ReportConfigsService],
})
export class ReportConfigsModule {}
