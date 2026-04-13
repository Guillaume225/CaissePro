import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators';
import { NotificationsService } from './notifications.service';
import { ListNotificationsQueryDto } from './dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /api/v1/notifications — Mes notifications (paginées)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@CurrentUser('id') userId: string, @Query() query: ListNotificationsQueryDto) {
    return this.notificationsService.findAll(userId, query);
  }

  /**
   * GET /api/v1/notifications/unread-count — Compteur non lues
   */
  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  async unreadCount(@CurrentUser('id') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  /**
   * PATCH /api/v1/notifications/read-all — Tout marquer comme lu
   */
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async readAll(@CurrentUser('id') userId: string) {
    const affected = await this.notificationsService.markAllAsRead(userId);
    return { affected };
  }

  /**
   * PATCH /api/v1/notifications/:id/read — Marquer comme lue
   */
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const notification = await this.notificationsService.markAsRead(id, userId);
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return notification;
  }
}
