import { Controller, Get, Patch, Body, Query } from '@nestjs/common';
import { AdminQueryService, EntityType } from './admin-query.service';
import { Roles, CurrentUser } from '../common/decorators';

@Controller('admin-query')
@Roles('ADMIN')
export class AdminQueryController {
  constructor(private readonly service: AdminQueryService) {}

  @Get('search')
  search(
    @Query('entity') entity: EntityType,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.service.search(
      entity,
      search,
      status,
      page ? parseInt(page, 10) : 1,
      perPage ? parseInt(perPage, 10) : 50,
    );
  }

  @Patch('update-status')
  updateStatus(
    @Body() dto: { entity: EntityType; ids: string[]; newStatus: string; reason?: string },
    @CurrentUser() user: Record<string, string>,
  ) {
    return this.service.updateStatus(
      dto.entity,
      dto.ids,
      dto.newStatus,
      user?.id || user?.userId,
      dto.reason,
    );
  }
}
