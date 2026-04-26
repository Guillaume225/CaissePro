import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CashClosingModule } from '../cash-closing/cash-closing.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [AuditModule, CashClosingModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
