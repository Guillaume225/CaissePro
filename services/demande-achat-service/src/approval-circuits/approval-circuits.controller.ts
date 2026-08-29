import { Controller, Get, Post, Put, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { Permissions, CurrentUser } from '../common/decorators';
import { DA_PERMISSIONS } from '../common/permissions';
import { ApprovalCircuitsService } from './approval-circuits.service';
import { CreateApprovalCircuitDto } from './dto';

@Controller('approval-circuits')
export class ApprovalCircuitsController {
  constructor(private readonly service: ApprovalCircuitsService) {}

  @Get()
  @Permissions(DA_PERMISSIONS.READ)
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Post()
  @Permissions(DA_PERMISSIONS.CONFIGURE)
  create(
    @Body() dto: CreateApprovalCircuitDto,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.service.create(dto, tenantId);
  }

  @Put(':id')
  @Permissions(DA_PERMISSIONS.CONFIGURE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body()
    dto: {
      name?: string;
      minAmount?: number;
      maxAmount?: number;
      isActive?: boolean;
      steps?: { level?: number; role: string; approverId?: string }[];
    },
  ) {
    return this.service.update(id, tenantId, dto);
  }

  @Delete(':id')
  @Permissions(DA_PERMISSIONS.CONFIGURE)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.service.remove(id, tenantId);
  }
}
