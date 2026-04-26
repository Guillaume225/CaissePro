import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ErpModule } from '../erp/erp.module';
import { CashClosingService } from './cash-closing.service';
import { CashClosingController } from './cash-closing.controller';
import { CashClosingRequiredGuard } from './guards/cash-closing-required.guard';

@Module({
  imports: [AuditModule, ErpModule],
  controllers: [CashClosingController],
  providers: [CashClosingService, CashClosingRequiredGuard],
  exports: [CashClosingService, CashClosingRequiredGuard],
})
export class CashClosingModule {}
