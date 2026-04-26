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
  FneClientsService,
  CreateFneClientDto,
  UpdateFneClientDto,
  ListFneClientsQuery,
} from './fne-clients.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { FNE_PERMISSIONS } from '../common/permissions';

@Controller('fne-clients')
export class FneClientsController {
  constructor(private readonly fneClientsService: FneClientsService) {}

  @Get()
  @Permissions(FNE_PERMISSIONS.READ)
  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ListFneClientsQuery) {
    return this.fneClientsService.findAll(tenantId, query);
  }

  @Get(':id')
  @Permissions(FNE_PERMISSIONS.READ)
  findById(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.fneClientsService.findById(tenantId, id);
  }

  @Post()
  @Permissions(FNE_PERMISSIONS.CREATE)
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateFneClientDto) {
    return this.fneClientsService.create(tenantId, dto);
  }

  @Put(':id')
  @Permissions(FNE_PERMISSIONS.CREATE)
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFneClientDto,
  ) {
    return this.fneClientsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Permissions(FNE_PERMISSIONS.CREATE)
  delete(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.fneClientsService.delete(tenantId, id);
  }
}
