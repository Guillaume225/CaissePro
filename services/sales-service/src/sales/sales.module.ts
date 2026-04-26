import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CashClosingModule } from '../cash-closing/cash-closing.module';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';

@Module({
  imports: [AuditModule, CashClosingModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
