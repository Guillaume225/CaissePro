import { Module } from '@nestjs/common';
import { AdminQueryController } from './admin-query.controller';
import { AdminQueryService } from './admin-query.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [AdminQueryController],
  providers: [AdminQueryService],
})
export class AdminQueryModule {}
