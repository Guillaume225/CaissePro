import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  FneInvoicesService,
  CreateFneInvoiceDto,
  UpdateFneInvoiceDto,
  RefundItemDto,
  ListFneInvoicesQuery,
} from './fne-invoices.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';
import { RequireFeature } from '../subscription/subscription.decorator';

@Controller('fne-invoices')
@RequireFeature('fne')
export class FneInvoicesController {
  constructor(private readonly fneInvoicesService: FneInvoicesService) {}

  @Get()
  @Permissions(FNE_PERMISSIONS.READ)
  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ListFneInvoicesQuery) {
    return this.fneInvoicesService.findAll(tenantId, query);
  }

  @Get('sticker-balance')
  @Permissions(FNE_PERMISSIONS.READ)
  getStickerBalance(@CurrentUser('tenantId') tenantId: string) {
    return this.fneInvoicesService.getLatestStickerBalance(tenantId);
  }

  @Get(':id')
  @Permissions(FNE_PERMISSIONS.READ)
  findById(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.fneInvoicesService.findById(tenantId, id);
  }

  @Post()
  @Permissions(FNE_PERMISSIONS.CREATE)
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateFneInvoiceDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.fneInvoicesService.createAndCertify(tenantId, dto, userId, companyId);
  }

  @Post('bulk-certify')
  @Permissions(FNE_PERMISSIONS.CREATE)
  bulkCertify(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: { ids: string[] },
    @CurrentUser('id') userId: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.fneInvoicesService.bulkCertify(tenantId, dto.ids, userId, companyId);
  }

  @Post('bulk-delete')
  @Permissions(FNE_PERMISSIONS.UPDATE)
  bulkRemove(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: { ids: string[] },
    @CurrentUser('id') userId: string,
  ) {
    return this.fneInvoicesService.bulkRemove(tenantId, dto.ids, userId);
  }

  @Post('import')
  @Permissions(FNE_PERMISSIONS.CREATE)
  bulkImport(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: { invoices: CreateFneInvoiceDto[] },
    @CurrentUser('id') userId: string,
  ) {
    return this.fneInvoicesService.bulkImport(tenantId, dto.invoices, userId);
  }

  @Patch(':id')
  @Permissions(FNE_PERMISSIONS.UPDATE)
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFneInvoiceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.fneInvoicesService.update(tenantId, id, dto, userId);
  }

  @Patch(':id/decision-comment')
  @Permissions(FNE_PERMISSIONS.UPDATE)
  updateDecisionComment(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { comment: string | null },
  ) {
    return this.fneInvoicesService.updateDecisionComment(tenantId, id, dto.comment ?? null);
  }

  @Post(':id/certify')
  @Permissions(FNE_PERMISSIONS.CREATE)
  certify(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.fneInvoicesService.certify(tenantId, id, userId, companyId);
  }

  @Post(':id/credit-note')
  @Permissions(FNE_PERMISSIONS.CREDIT_NOTE)
  createCreditNote(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { items: RefundItemDto[] },
    @CurrentUser('id') userId: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.fneInvoicesService.createCreditNote(tenantId, id, dto.items, userId, companyId);
  }

  @Delete(':id')
  @Permissions(FNE_PERMISSIONS.UPDATE)
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.fneInvoicesService.remove(tenantId, id, userId);
  }
}
