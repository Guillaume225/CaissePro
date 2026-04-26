import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, ListUsersQueryDto } from './dto';
import { CurrentUser, Permissions } from '../common/decorators';
import { PERMISSIONS } from '../common/permissions';
import { RequireLimit } from '../subscription/subscription.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const data = await this.usersService.getMe(userId, tenantId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get()
  @Permissions(PERMISSIONS.USER_READ)
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ListUsersQueryDto,
  ) {
    const result = await this.usersService.findAll(tenantId, query);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @Permissions(PERMISSIONS.USER_READ)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const data = await this.usersService.findById(id, tenantId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post()
  @Permissions(PERMISSIONS.USER_CREATE)
  @RequireLimit('max_users')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser('tenantId') tenantId: string,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || '';
    const data = await this.usersService.create(dto, tenantId, actorId, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.USER_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser('tenantId') tenantId: string,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || '';
    const data = await this.usersService.update(id, dto, tenantId, actorId, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.USER_DELETE)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
    @CurrentUser('tenantId') tenantId: string,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || '';
    await this.usersService.softDelete(id, tenantId, actorId, ip);
    return {
      success: true,
      data: { message: 'User deleted successfully' },
      timestamp: new Date().toISOString(),
    };
  }
}
