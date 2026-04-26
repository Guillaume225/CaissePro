import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ErpSettingsService, UpsertErpSettingDto } from './erp-settings.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';

@Controller('erp-settings')
export class ErpSettingsController {
  constructor(private readonly erpSettingsService: ErpSettingsService) {}

  @Get()
  @Permissions(FNE_PERMISSIONS.READ)
  findByCompany(
    @CurrentUser('tenantId') tenantId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.erpSettingsService.findByCompany(tenantId, companyId);
  }

  @Post()
  @Permissions(FNE_PERMISSIONS.CREATE)
  upsert(@CurrentUser('tenantId') tenantId: string, @Body() dto: UpsertErpSettingDto) {
    return this.erpSettingsService.upsert(tenantId, dto);
  }

  @Post('test')
  @Permissions(FNE_PERMISSIONS.READ)
  testConnection(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: { companyId: string },
  ) {
    return this.erpSettingsService.testConnection(tenantId, dto.companyId);
  }
}
