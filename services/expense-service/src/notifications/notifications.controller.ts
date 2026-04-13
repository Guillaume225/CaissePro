import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: { id: string }, @Query() query: { type?: string; isRead?: string }) {
    return this.svc.findAll(user.id, query);
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
