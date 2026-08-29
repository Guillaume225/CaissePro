import { Controller, Get, Post, Patch, Delete, Param, Query, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators';
import { RegisterDeviceTokenDto } from './dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: { id: string }, @Query() query: { type?: string; isRead?: string }) {
    return this.svc.findAll(user.id, query);
  }

  @Post('device-tokens')
  @HttpCode(HttpStatus.OK)
  registerDeviceToken(@CurrentUser() user: { id: string }, @Body() dto: RegisterDeviceTokenDto) {
    return this.svc.registerDeviceToken(user.id, dto.platform, dto.token);
  }

  @Delete('device-tokens/:token')
  @HttpCode(HttpStatus.OK)
  unregisterDeviceToken(@CurrentUser() user: { id: string }, @Param('token') token: string) {
    return this.svc.unregisterDeviceToken(user.id, token);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: { id: string }) {
    return this.svc.unreadCount(user.id);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: { id: string }) {
    return this.svc.markAllAsRead(user.id);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.svc.markAsRead(id, user.id);
  }
}
