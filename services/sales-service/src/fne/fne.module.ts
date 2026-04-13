import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FneInvoice } from '../entities/fne-invoice.entity';
import { FneInvoiceItem } from '../entities/fne-invoice-item.entity';
import { FneApiLog } from '../entities/fne-api-log.entity';
import { FneClient } from '../entities/fne-client.entity';
import { FneProduct } from '../entities/fne-product.entity';
import { FnePointOfSale } from '../entities/fne-point-of-sale.entity';
import { FneEstablishment } from '../entities/fne-establishment.entity';
import { FneSetting } from '../entities/fne-setting.entity';
import { FneAccountingEntry } from '../entities/fne-accounting-entry.entity';
import { FneApiService } from './fne-api.service';
import { FneInvoicesService } from './fne-invoices.service';
import { FneInvoicesController } from './fne-invoices.controller';
import { FneClientsService } from './fne-clients.service';
import { FneClientsController } from './fne-clients.controller';
import { FneProductsService } from './fne-products.service';
import { FneProductsController } from './fne-products.controller';
import { FnePointsOfSaleService } from './fne-points-of-sale.service';
import { FnePointsOfSaleController } from './fne-points-of-sale.controller';
import { FneEstablishmentsService } from './fne-establishments.service';
import { FneEstablishmentsController } from './fne-establishments.controller';
import { FneSettingsService } from './fne-settings.service';
import { FneSettingsController } from './fne-settings.controller';
import { FneAccountingService } from './fne-accounting.service';
import { FneAccountingController } from './fne-accounting.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FneInvoice,
      FneInvoiceItem,
      FneApiLog,
      FneClient,
      FneProduct,
      FnePointOfSale,
      FneEstablishment,
      FneSetting,
      FneAccountingEntry,
    ]),
    AuditModule,
  ],
  controllers: [
    FneInvoicesController,
    FneClientsController,
    FneProductsController,
    FnePointsOfSaleController,
    FneEstablishmentsController,
    FneSettingsController,
    FneAccountingController,
  ],
  providers: [
    FneApiService,
    FneInvoicesService,
    FneClientsService,
    FneProductsService,
    FnePointsOfSaleService,
    FneEstablishmentsService,
    FneSettingsService,
    FneAccountingService,
  ],
  exports: [
    FneInvoicesService,
    FneClientsService,
    FneProductsService,
    FnePointsOfSaleService,
    FneEstablishmentsService,
    FneSettingsService,
    FneAccountingService,
  ],
})
export class FneModule {}
