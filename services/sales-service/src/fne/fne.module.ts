import { Module } from '@nestjs/common';
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
import { ErpModule } from '../erp/erp.module';

@Module({
  imports: [AuditModule, ErpModule],
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
