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
  FneProductsService,
  CreateFneProductDto,
  UpdateFneProductDto,
  ListFneProductsQuery,
} from './fne-products.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';

@Controller('fne-products')
export class FneProductsController {
  constructor(private readonly fneProductsService: FneProductsService) {}

  @Get()
  @Permissions(FNE_PERMISSIONS.READ)
  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ListFneProductsQuery) {
    return this.fneProductsService.findAll(tenantId, query);
  }

  @Get(':id')
  @Permissions(FNE_PERMISSIONS.READ)
  findById(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.fneProductsService.findById(tenantId, id);
  }

  @Post()
  @Permissions(FNE_PERMISSIONS.CREATE)
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateFneProductDto) {
    return this.fneProductsService.create(tenantId, dto);
  }

  @Put(':id')
  @Permissions(FNE_PERMISSIONS.CREATE)
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFneProductDto,
  ) {
    return this.fneProductsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Permissions(FNE_PERMISSIONS.CREATE)
  delete(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.fneProductsService.delete(tenantId, id);
  }
}
