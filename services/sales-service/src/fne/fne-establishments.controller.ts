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
import { FneEstablishmentsService, CreateFneEstablishmentDto, UpdateFneEstablishmentDto, ListFneEstablishmentsQuery } from './fne-establishments.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';

@Controller('fne-establishments')
export class FneEstablishmentsController {
  constructor(private readonly service: FneEstablishmentsService) {}

  @Get()
  @Permissions(FNE_PERMISSIONS.READ)
  findAll(@Query() query: ListFneEstablishmentsQuery, @CurrentUser('companyId') companyId: string) {
    return this.service.findAll(query, companyId);
  }

  @Get(':id')
  @Permissions(FNE_PERMISSIONS.READ)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Permissions(FNE_PERMISSIONS.CREATE)
  create(@Body() dto: CreateFneEstablishmentDto, @CurrentUser('companyId') companyId: string) {
    return this.service.create(dto, companyId);
  }

  @Put(':id')
  @Permissions(FNE_PERMISSIONS.CREATE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFneEstablishmentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions(FNE_PERMISSIONS.CREATE)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(id);
  }
}
