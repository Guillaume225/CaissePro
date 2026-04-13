import { Controller, Get, Put, Delete, Param, Body } from '@nestjs/common';
import { ReportConfigsService } from './report-configs.service';
import { SaveReportConfigDto, BulkSaveReportConfigsDto } from './dto';
import { Permissions, CurrentUser } from '../common/decorators';
import { PERMISSIONS } from '../common/permissions';

@Controller('report-configs')
export class ReportConfigsController {
  constructor(private readonly service: ReportConfigsService) {}

  @Get()
  @Permissions(PERMISSIONS.EXPENSE_READ)
  async findAll(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.service.findAllByTenant(tenantId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Put('bulk')
  @Permissions(PERMISSIONS.EXPENSE_UPDATE)
  async bulkSave(
    @Body() dto: BulkSaveReportConfigsDto,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    const data = await this.service.bulkUpsert(tenantId, dto.configs, userId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Put(':reportId')
  @Permissions(PERMISSIONS.EXPENSE_UPDATE)
  async upsert(
    @Param('reportId') reportId: string,
    @Body() dto: SaveReportConfigDto,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    dto.reportId = reportId;
    const data = await this.service.upsert(tenantId, dto, userId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Delete(':reportId')
  @Permissions(PERMISSIONS.EXPENSE_UPDATE)
  async remove(
    @Param('reportId') reportId: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.service.remove(tenantId, reportId, userId);
    return { success: true, timestamp: new Date().toISOString() };
  }
}
