import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  FnePointsOfSaleService,
  CreateFnePointOfSaleDto,
  UpdateFnePointOfSaleDto,
  ListFnePointsOfSaleQuery,
} from './fne-points-of-sale.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';

@Controller('fne-points-of-sale')
export class FnePointsOfSaleController {
  constructor(private readonly service: FnePointsOfSaleService) {}

  @Get()
  @Permissions(FNE_PERMISSIONS.READ)
  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ListFnePointsOfSaleQuery) {
    return this.service.findAll(tenantId, query);
  }

  @Get(':id')
  @Permissions(FNE_PERMISSIONS.READ)
  findById(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(tenantId, id);
  }

  @Post()
  @Permissions(FNE_PERMISSIONS.CREATE)
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateFnePointOfSaleDto) {
    return this.service.create(tenantId, dto);
  }

  @Put(':id')
  @Permissions(FNE_PERMISSIONS.CREATE)
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFnePointOfSaleDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Permissions(FNE_PERMISSIONS.CREATE)
  delete(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(tenantId, id);
  }
}
