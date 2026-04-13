import { Controller, Get, Post, Put, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { Permissions } from '../common/decorators';
import { ApprovalCircuitsService } from './approval-circuits.service';

@Controller('approval-circuits')
export class ApprovalCircuitsController {
  constructor(private readonly service: ApprovalCircuitsService) {}

  @Get()
  @Permissions('expense.read')
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Permissions('expense.approve_l1')
  create(@Body() dto: { name: string; minAmount?: number; maxAmount?: number; steps?: { level?: number; role: string; approverId?: string }[] }) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Permissions('expense.approve_l1')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { name?: string; minAmount?: number; maxAmount?: number; isActive?: boolean; steps?: { level?: number; role: string; approverId?: string }[] },
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions('expense.approve_l1')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
