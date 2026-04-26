import { Controller, Get, Post, Put, Query, Body } from '@nestjs/common';
import {
  FneSettingsService,
  CreateFneSettingDto,
  UpdateFneSettingDto,
} from './fne-settings.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';

@Controller('fne-settings')
export class FneSettingsController {
  constructor(private readonly service: FneSettingsService) {}

  @Get()
  @Permissions(FNE_PERMISSIONS.READ)
  findByCompany(
    @CurrentUser('tenantId') tenantId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.service.findByCompany(tenantId, companyId);
  }

  @Post()
  @Permissions(FNE_PERMISSIONS.CREATE)
  upsert(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateFneSettingDto) {
    return this.service.upsert(tenantId, dto);
  }

  @Put()
  @Permissions(FNE_PERMISSIONS.CREATE)
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Query('companyId') companyId: string,
    @Body() dto: UpdateFneSettingDto,
  ) {
    return this.service.update(tenantId, companyId, dto);
  }
}
