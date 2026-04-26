import { Controller, Get, Post, Put, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { Permissions, CurrentUser } from '../common/decorators';
import { ApprovalCircuitsService } from './approval-circuits.service';
import { CreateApprovalCircuitDto } from './dto';

@Controller('approval-circuits')
export class ApprovalCircuitsController {
  constructor(private readonly service: ApprovalCircuitsService) {}

  @Get()
  @Permissions('expense.read')
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Post()
  @Permissions('expense.approve_l1')
  create(
    @Body() dto: CreateApprovalCircuitDto,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.service.create(dto, tenantId);
  }

  @Put(':id')
  @Permissions('expense.approve_l1')
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
  @Permissions('expense.approve_l1')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.service.remove(id, tenantId);
  }
}
