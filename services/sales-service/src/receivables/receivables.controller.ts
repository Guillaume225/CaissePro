import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ReceivablesService } from './receivables.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { RECEIVABLE_PERMISSIONS } from '../common/permissions';
import { ListReceivablesQueryDto } from './dto';

@Controller('receivables')
export class ReceivablesController {
  constructor(private readonly receivablesService: ReceivablesService) {}

  @Get('aging-report')
  @Permissions(RECEIVABLE_PERMISSIONS.READ)
  getAgingReport(@CurrentUser('tenantId') tenantId: string) {
    return this.receivablesService.getAgingReport(tenantId);
  }

  @Get()
  @Permissions(RECEIVABLE_PERMISSIONS.READ)
  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ListReceivablesQueryDto) {
    return this.receivablesService.findAll(tenantId, query);
  }

  @Get(':id')
  @Permissions(RECEIVABLE_PERMISSIONS.READ)
  findById(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.receivablesService.findById(tenantId, id);
  }
}
