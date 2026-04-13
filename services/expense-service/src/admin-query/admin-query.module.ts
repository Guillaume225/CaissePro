import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminQueryController } from './admin-query.controller';
import { AdminQueryService } from './admin-query.service';
import { Expense } from '../entities/expense.entity';
import { CashDay } from '../entities/cash-day.entity';
import { Advance } from '../entities/advance.entity';
import { DisbursementRequest } from '../entities/disbursement-request.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense, CashDay, Advance, DisbursementRequest]),
    AuditModule,
  ],
  controllers: [AdminQueryController],
  providers: [AdminQueryService],
})
export class AdminQueryModule {}
