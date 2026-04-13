import { Controller, Get, Post, Put, Query, Body } from '@nestjs/common';
import {
  FneSettingsService,
  CreateFneSettingDto,
  UpdateFneSettingDto,
} from './fne-settings.service';
import { Permissions } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';

@Controller('fne-settings')
export class FneSettingsController {
  constructor(private readonly service: FneSettingsService) {}

  @Get()
  @Permissions(FNE_PERMISSIONS.READ)
  findByCompany(@Query('companyId') companyId: string) {
    return this.service.findByCompany(companyId);
  }

  @Post()
  @Permissions(FNE_PERMISSIONS.CREATE)
  upsert(@Body() dto: CreateFneSettingDto) {
    return this.service.upsert(dto);
  }

  @Put()
  @Permissions(FNE_PERMISSIONS.CREATE)
  update(@Query('companyId') companyId: string, @Body() dto: UpdateFneSettingDto) {
    return this.service.update(companyId, dto);
  }
}
