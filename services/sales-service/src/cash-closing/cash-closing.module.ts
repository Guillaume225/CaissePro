import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashDay } from '../entities/cash-day.entity';
import { Payment } from '../entities/payment.entity';
import { AuditModule } from '../audit/audit.module';
import { ErpModule } from '../erp/erp.module';
import { CashClosingService } from './cash-closing.service';
import { CashClosingController } from './cash-closing.controller';
import { CashClosingRequiredGuard } from './guards/cash-closing-required.guard';

@Module({
  imports: [TypeOrmModule.forFeature([CashDay, Payment]), AuditModule, ErpModule],
  controllers: [CashClosingController],
  providers: [CashClosingService, CashClosingRequiredGuard],
  exports: [CashClosingService, CashClosingRequiredGuard],
})
export class CashClosingModule {}
