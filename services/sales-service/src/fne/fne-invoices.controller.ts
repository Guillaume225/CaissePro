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
import { FneInvoicesService, CreateFneInvoiceDto, UpdateFneInvoiceDto, RefundItemDto, ListFneInvoicesQuery } from './fne-invoices.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';

@Controller('fne-invoices')
export class FneInvoicesController {
  constructor(private readonly fneInvoicesService: FneInvoicesService) {}

  @Get()
  @Permissions(FNE_PERMISSIONS.READ)
  findAll(@Query() query: ListFneInvoicesQuery) {
    return this.fneInvoicesService.findAll(query);
  }

  @Get('sticker-balance')
  @Permissions(FNE_PERMISSIONS.READ)
  getStickerBalance() {
    return this.fneInvoicesService.getLatestStickerBalance();
  }

  @Get(':id')
  @Permissions(FNE_PERMISSIONS.READ)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.fneInvoicesService.findById(id);
  }

  @Post()
  @Permissions(FNE_PERMISSIONS.CREATE)
  create(
    @Body() dto: CreateFneInvoiceDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.fneInvoicesService.createAndCertify(dto, userId, companyId);
  }

  @Post('bulk-certify')
  @Permissions(FNE_PERMISSIONS.CREATE)
  bulkCertify(
    @Body() dto: { ids: string[] },
    @CurrentUser('id') userId: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.fneInvoicesService.bulkCertify(dto.ids, userId, companyId);
  }

  @Post('bulk-delete')
  @Permissions(FNE_PERMISSIONS.UPDATE)
  bulkRemove(
    @Body() dto: { ids: string[] },
    @CurrentUser('id') userId: string,
  ) {
    return this.fneInvoicesService.bulkRemove(dto.ids, userId);
  }

  @Post('import')
  @Permissions(FNE_PERMISSIONS.CREATE)
  bulkImport(
    @Body() dto: { invoices: CreateFneInvoiceDto[] },
    @CurrentUser('id') userId: string,
  ) {
    return this.fneInvoicesService.bulkImport(dto.invoices, userId);
  }

  @Patch(':id')
  @Permissions(FNE_PERMISSIONS.UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFneInvoiceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.fneInvoicesService.update(id, dto, userId);
  }

  @Patch(':id/decision-comment')
  @Permissions(FNE_PERMISSIONS.UPDATE)
  updateDecisionComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { comment: string | null },
  ) {
    return this.fneInvoicesService.updateDecisionComment(id, dto.comment ?? null);
  }

  @Post(':id/certify')
  @Permissions(FNE_PERMISSIONS.CREATE)
  certify(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.fneInvoicesService.certify(id, userId, companyId);
  }

  @Post(':id/credit-note')
  @Permissions(FNE_PERMISSIONS.CREDIT_NOTE)
  createCreditNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { items: RefundItemDto[] },
    @CurrentUser('id') userId: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.fneInvoicesService.createCreditNote(id, dto.items, userId, companyId);
  }

  @Delete(':id')
  @Permissions(FNE_PERMISSIONS.UPDATE)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.fneInvoicesService.remove(id, userId);
  }
}
