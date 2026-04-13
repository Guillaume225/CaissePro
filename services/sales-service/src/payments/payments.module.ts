import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../entities/payment.entity';
import { Sale } from '../entities/sale.entity';
import { Receivable } from '../entities/receivable.entity';
import { AuditModule } from '../audit/audit.module';
import { CashClosingModule } from '../cash-closing/cash-closing.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Sale, Receivable]), AuditModule, CashClosingModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
