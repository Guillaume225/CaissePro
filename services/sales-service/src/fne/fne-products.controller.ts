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
import { FneProductsService, CreateFneProductDto, UpdateFneProductDto, ListFneProductsQuery } from './fne-products.service';
import { Permissions } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';

@Controller('fne-products')
export class FneProductsController {
  constructor(private readonly fneProductsService: FneProductsService) {}

  @Get()
  @Permissions(FNE_PERMISSIONS.READ)
  findAll(@Query() query: ListFneProductsQuery) {
    return this.fneProductsService.findAll(query);
  }

  @Get(':id')
  @Permissions(FNE_PERMISSIONS.READ)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.fneProductsService.findById(id);
  }

  @Post()
  @Permissions(FNE_PERMISSIONS.CREATE)
  create(@Body() dto: CreateFneProductDto) {
    return this.fneProductsService.create(dto);
  }

  @Put(':id')
  @Permissions(FNE_PERMISSIONS.CREATE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFneProductDto) {
    return this.fneProductsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions(FNE_PERMISSIONS.CREATE)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.fneProductsService.delete(id);
  }
}
