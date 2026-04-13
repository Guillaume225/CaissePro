import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Expense } from '../entities/expense.entity';
import { ExpenseApproval } from '../entities/expense-approval.entity';
import { ExpenseAttachment } from '../entities/expense-attachment.entity';
import { ExpenseCategory } from '../entities/expense-category.entity';
import { CashDay } from '../entities/cash-day.entity';
import { DisbursementRequest } from '../entities/disbursement-request.entity';
import { User } from '../entities/user.entity';
import { AuditModule } from '../audit/audit.module';
import { CashClosingModule } from '../cash-closing/cash-closing.module';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Expense,
      ExpenseApproval,
      ExpenseAttachment,
      ExpenseCategory,
      CashDay,
      User,
      DisbursementRequest,
    ]),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        dest: cfg.get<string>('upload.dir') || './uploads',
        limits: {
          fileSize: cfg.get<number>('upload.maxFileSize') || 10 * 1024 * 1024,
        },
      }),
      inject: [ConfigService],
    }),
    AuditModule,
    CashClosingModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
