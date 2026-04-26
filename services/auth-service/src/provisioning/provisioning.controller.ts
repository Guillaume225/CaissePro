import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ProvisioningService } from './provisioning.service';
import { ProvisionTenantDto, DeprovisionTenantDto } from './dto';
import { Public } from '../common/decorators';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';

@Controller('provisioning')
@Public()
@UseGuards(InternalSecretGuard)
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async provision(@Body() dto: ProvisionTenantDto) {
    const result = await this.provisioningService.provision(dto);
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async deprovision(@Body() dto: DeprovisionTenantDto) {
    await this.provisioningService.deprovision(dto.externalTenantId);
    return { success: true, data: { message: 'Tenant désactivé' }, timestamp: new Date().toISOString() };
  }
}
