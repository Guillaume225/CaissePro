import { Controller, Get, Post, Patch, Param, Body, Query, ParseUUIDPipe } from '@nestjs/common';
import { AdvancesService } from './advances.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { EXPENSE_PERMISSIONS } from '../common/permissions';
import { CreateAdvanceDto, UpdateAdvanceDto, JustifyAdvanceDto, ListAdvancesQueryDto } from './dto';

@Controller('advances')
export class AdvancesController {
  constructor(private readonly advancesService: AdvancesService) {}

  @Get()
  @Permissions(EXPENSE_PERMISSIONS.READ)
  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ListAdvancesQueryDto) {
    return this.advancesService.findAll(tenantId, query);
  }

  @Get(':id')
  @Permissions(EXPENSE_PERMISSIONS.READ)
  findById(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.advancesService.findById(tenantId, id);
  }

  @Post()
  @Permissions(EXPENSE_PERMISSIONS.CREATE)
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateAdvanceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.advancesService.create(tenantId, dto, userId);
  }

  @Patch(':id')
  @Permissions(EXPENSE_PERMISSIONS.UPDATE)
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdvanceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.advancesService.update(tenantId, id, dto, userId);
  }

  @Post(':id/justify')
  @Permissions(EXPENSE_PERMISSIONS.UPDATE)
  justify(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JustifyAdvanceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.advancesService.justify(tenantId, id, dto, userId);
  }
}
