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
import { FneClientsService, CreateFneClientDto, UpdateFneClientDto, ListFneClientsQuery } from './fne-clients.service';
import { Permissions } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';

@Controller('fne-clients')
export class FneClientsController {
  constructor(private readonly fneClientsService: FneClientsService) {}

  @Get()
  @Permissions(FNE_PERMISSIONS.READ)
  findAll(@Query() query: ListFneClientsQuery) {
    return this.fneClientsService.findAll(query);
  }

  @Get(':id')
  @Permissions(FNE_PERMISSIONS.READ)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.fneClientsService.findById(id);
  }

  @Post()
  @Permissions(FNE_PERMISSIONS.CREATE)
  create(@Body() dto: CreateFneClientDto) {
    return this.fneClientsService.create(dto);
  }

  @Put(':id')
  @Permissions(FNE_PERMISSIONS.CREATE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFneClientDto) {
    return this.fneClientsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions(FNE_PERMISSIONS.CREATE)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.fneClientsService.delete(id);
  }
}
