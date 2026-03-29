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
import { CurrentUser, Roles, Permissions } from '../common/decorators';
import { PERMISSIONS } from '../common/permissions';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser('id') userId: string) {
    const data = await this.usersService.findById(userId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get()
  @Permissions(PERMISSIONS.USER_READ)
  async findAll(@Query() query: ListUsersQueryDto) {
    const result = await this.usersService.findAll(query);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @Permissions(PERMISSIONS.USER_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.usersService.findById(id);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post()
  @Permissions(PERMISSIONS.USER_CREATE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || '';
    const data = await this.usersService.create(dto, actorId, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.USER_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || '';
    const data = await this.usersService.update(id, dto, actorId, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.USER_DELETE)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || '';
    await this.usersService.softDelete(id, actorId, ip);
    return {
      success: true,
      data: { message: 'User deleted successfully' },
      timestamp: new Date().toISOString(),
    };
  }
}
