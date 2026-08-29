import { Controller, Get, Post, Put, Patch, Query, Body } from '@nestjs/common';
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

  @Get('active')
  @Permissions(FNE_PERMISSIONS.READ)
  findActive(@CurrentUser('tenantId') tenantId: string) {
    return this.service.findActive(tenantId);
  }

  @Post()
  @Permissions(FNE_PERMISSIONS.CREATE)
  upsert(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateFneSettingDto) {
    return this.service.upsert(tenantId, dto);
  }

  @Patch('credit-note-sense')
  @Permissions(FNE_PERMISSIONS.CREATE)
  updateCreditNoteSense(
    @CurrentUser('tenantId') tenantId: string,
    @Body('enabled') enabled: boolean,
  ) {
    return this.service.updateCreditNoteSense(tenantId, enabled);
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
