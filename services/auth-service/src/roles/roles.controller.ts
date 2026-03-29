import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './dto';
import { CurrentUser, Permissions } from '../common/decorators';
import { PERMISSIONS } from '../common/permissions';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions(PERMISSIONS.ROLE_READ)
  async findAll() {
    const data = await this.rolesService.findAll();
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ROLE_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.rolesService.findById(id);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post()
  @Permissions(PERMISSIONS.ROLE_CREATE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateRoleDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || '';
    const data = await this.rolesService.create(dto, actorId, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ROLE_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || '';
    const data = await this.rolesService.update(id, dto, actorId, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }
}
