import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { CLIENT_PERMISSIONS } from '../common/permissions';
import { CreateClientDto, UpdateClientDto, ListClientsQueryDto } from './dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @Permissions(CLIENT_PERMISSIONS.READ)
  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ListClientsQueryDto) {
    return this.clientsService.findAll(tenantId, query);
  }

  @Get(':id')
  @Permissions(CLIENT_PERMISSIONS.READ)
  findById(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findById(tenantId, id);
  }

  @Get(':id/statement')
  @Permissions(CLIENT_PERMISSIONS.READ)
  getStatement(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.getStatement(tenantId, id);
  }

  @Post()
  @Permissions(CLIENT_PERMISSIONS.CREATE)
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateClientDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.clientsService.create(tenantId, dto, userId);
  }

  @Patch(':id')
  @Permissions(CLIENT_PERMISSIONS.UPDATE)
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.clientsService.update(tenantId, id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(CLIENT_PERMISSIONS.DELETE)
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.clientsService.remove(tenantId, id, userId);
  }
}
