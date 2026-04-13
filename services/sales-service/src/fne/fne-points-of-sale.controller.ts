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
import { Permissions } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';

@Controller('fne-points-of-sale')
export class FnePointsOfSaleController {
  constructor(private readonly service: FnePointsOfSaleService) {}

  @Get()
  @Permissions(FNE_PERMISSIONS.READ)
  findAll(@Query() query: ListFnePointsOfSaleQuery) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permissions(FNE_PERMISSIONS.READ)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Permissions(FNE_PERMISSIONS.CREATE)
  create(@Body() dto: CreateFnePointOfSaleDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Permissions(FNE_PERMISSIONS.CREATE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFnePointOfSaleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions(FNE_PERMISSIONS.CREATE)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(id);
  }
}
