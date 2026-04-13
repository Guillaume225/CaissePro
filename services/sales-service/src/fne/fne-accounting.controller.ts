import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FneAccountingService, GenerateEntriesDto, ListFneAccountingQuery } from './fne-accounting.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';

@Controller('fne-accounting')
export class FneAccountingController {
  constructor(private readonly fneAccountingService: FneAccountingService) {}

  @Get()
  @Permissions(FNE_PERMISSIONS.READ)
  findAll(@Query() query: ListFneAccountingQuery) {
    return this.fneAccountingService.findAll(query);
  }

  @Post('generate')
  @Permissions(FNE_PERMISSIONS.CREATE)
  generate(
    @Body() dto: GenerateEntriesDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.fneAccountingService.generate(dto, userId);
  }

  @Post('processed-ids')
  @Permissions(FNE_PERMISSIONS.READ)
  getProcessedIds(@Body() dto: { invoiceIds: string[] }) {
    return this.fneAccountingService.getProcessedInvoiceIds(dto.invoiceIds);
  }

  @Delete(':invoiceId')
  @Permissions(FNE_PERMISSIONS.UPDATE)
  deleteByInvoice(@Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.fneAccountingService.deleteByInvoice(invoiceId);
  }

  @Delete()
  @Permissions(FNE_PERMISSIONS.UPDATE)
  deleteAll() {
    return this.fneAccountingService.deleteAll();
  }
}
