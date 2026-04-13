import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.svc.findAll(user.id, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: any) {
    return this.svc.unreadCount(user.id);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: any) {
    return this.svc.markAllAsRead(user.id);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.markAsRead(id, user.id);
  }
}
