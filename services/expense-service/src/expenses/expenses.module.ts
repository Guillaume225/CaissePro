import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Expense } from '../entities/expense.entity';
import { ExpenseApproval } from '../entities/expense-approval.entity';
import { ExpenseAttachment } from '../entities/expense-attachment.entity';
import { ExpenseCategory } from '../entities/expense-category.entity';
import { AuditModule } from '../audit/audit.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense, ExpenseApproval, ExpenseAttachment, ExpenseCategory]),
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
    BudgetsModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
