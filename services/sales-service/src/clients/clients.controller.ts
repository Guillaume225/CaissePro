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
  findAll(@Query() query: ListClientsQueryDto) {
    return this.clientsService.findAll(query);
  }

  @Get(':id')
  @Permissions(CLIENT_PERMISSIONS.READ)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findById(id);
  }

  @Get(':id/statement')
  @Permissions(CLIENT_PERMISSIONS.READ)
  getStatement(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.getStatement(id);
  }

  @Post()
  @Permissions(CLIENT_PERMISSIONS.CREATE)
  create(@Body() dto: CreateClientDto, @CurrentUser('id') userId: string) {
    return this.clientsService.create(dto, userId);
  }

  @Patch(':id')
  @Permissions(CLIENT_PERMISSIONS.UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.clientsService.update(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(CLIENT_PERMISSIONS.DELETE)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.clientsService.remove(id, userId);
  }
}
