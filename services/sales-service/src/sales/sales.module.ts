import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale } from '../entities/sale.entity';
import { SaleItem } from '../entities/sale-item.entity';
import { Product } from '../entities/product.entity';
import { Client } from '../entities/client.entity';
import { Receivable } from '../entities/receivable.entity';
import { AuditModule } from '../audit/audit.module';
import { CashClosingModule } from '../cash-closing/cash-closing.module';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SaleItem, Product, Client, Receivable]),
    AuditModule,
    CashClosingModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
