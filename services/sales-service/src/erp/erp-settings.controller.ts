import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ErpSettingsService, UpsertErpSettingDto } from './erp-settings.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';

@Controller('erp-settings')
export class ErpSettingsController {
  constructor(private readonly erpSettingsService: ErpSettingsService) {}

  @Get()
  @Permissions(FNE_PERMISSIONS.READ)
  findByCompany(@Query('companyId') companyId: string) {
    return this.erpSettingsService.findByCompany(companyId);
  }

  @Post()
  @Permissions(FNE_PERMISSIONS.CREATE)
  upsert(@Body() dto: UpsertErpSettingDto) {
    return this.erpSettingsService.upsert(dto);
  }

  @Post('test')
  @Permissions(FNE_PERMISSIONS.READ)
  testConnection(@Body() dto: { companyId: string }) {
    return this.erpSettingsService.testConnection(dto.companyId);
  }
}
