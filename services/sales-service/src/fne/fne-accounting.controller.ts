import { Controller, Get, Post, Delete, Param, Body, Query, ParseUUIDPipe } from '@nestjs/common';
import {
  FneAccountingService,
  GenerateEntriesDto,
  ListFneAccountingQuery,
} from './fne-accounting.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';

@Controller('fne-accounting')
export class FneAccountingController {
  constructor(private readonly fneAccountingService: FneAccountingService) {}

  @Get()
  @Permissions(FNE_PERMISSIONS.READ)
  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ListFneAccountingQuery) {
    return this.fneAccountingService.findAll(tenantId, query);
  }

  @Post('generate')
  @Permissions(FNE_PERMISSIONS.CREATE)
  generate(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: GenerateEntriesDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.fneAccountingService.generate(tenantId, dto, userId);
  }

  @Post('processed-ids')
  @Permissions(FNE_PERMISSIONS.READ)
  getProcessedIds(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: { invoiceIds: string[] },
  ) {
    return this.fneAccountingService.getProcessedInvoiceIds(tenantId, dto.invoiceIds);
  }

  @Delete(':invoiceId')
  @Permissions(FNE_PERMISSIONS.UPDATE)
  deleteByInvoice(
    @CurrentUser('tenantId') tenantId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.fneAccountingService.deleteByInvoice(tenantId, invoiceId);
  }

  @Delete()
  @Permissions(FNE_PERMISSIONS.UPDATE)
  deleteAll(@CurrentUser('tenantId') tenantId: string) {
    return this.fneAccountingService.deleteAll(tenantId);
  }
}
