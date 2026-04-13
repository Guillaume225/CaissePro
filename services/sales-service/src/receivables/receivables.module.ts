import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Receivable } from '../entities/receivable.entity';
import { AuditModule } from '../audit/audit.module';
import { ReceivablesService } from './receivables.service';
import { ReceivablesController } from './receivables.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Receivable]), AuditModule],
  controllers: [ReceivablesController],
  providers: [ReceivablesService],
  exports: [ReceivablesService],
})
export class ReceivablesModule {}
