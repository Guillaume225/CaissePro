import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '@/entities/notification.entity';
import { NotificationType, NotificationChannel } from '@/common/enums';
import { NotificationsGateway } from './notifications.gateway';
import { EmailService } from '@/channels/email/email.service';
import { SmsProvider, SMS_PROVIDER } from '@/channels/sms/sms-provider.interface';
import { ListNotificationsQueryDto } from './dto';

export interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  channels: NotificationChannel[];
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly gateway: NotificationsGateway,
    private readonly emailService: EmailService,
    @Inject(SMS_PROVIDER)
    private readonly smsProvider: SmsProvider,
  ) {}

  /* ------------------------------------------------------------------ */
  /*  Create (from consumer)                                            */
  /* ------------------------------------------------------------------ */

  async create(input: CreateNotificationInput): Promise<Notification> {
    const notification = this.notificationRepo.create({
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      message: input.message,
      channels: input.channels,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
      read: false,
    });

    return this.notificationRepo.save(notification);
  }

  /* ------------------------------------------------------------------ */
  /*  WebSocket push                                                    */
  /* ------------------------------------------------------------------ */

  async pushToWebSocket(recipientId: string, notification: Notification): Promise<void> {
    this.gateway.sendToUser(recipientId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      entityType: notification.entityType,
      entityId: notification.entityId,
      createdAt: notification.createdAt,
    });

    const count = await this.getUnreadCount(recipientId);
    this.gateway.sendUnreadCount(recipientId, count);
  }

  /* ------------------------------------------------------------------ */
  /*  Email                                                             */
  /* ------------------------------------------------------------------ */

  async sendEmail(
    to: string,
    type: NotificationType,
    subject: string,
    textContent: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.emailService.send(to, type, subject, textContent, data);
  }

  /* ------------------------------------------------------------------ */
  /*  SMS                                                               */
  /* ------------------------------------------------------------------ */

  async sendSms(to: string, message: string): Promise<void> {
    await this.smsProvider.send(to, message);
  }

  /* ------------------------------------------------------------------ */
  /*  Query endpoints                                                   */
  /* ------------------------------------------------------------------ */

  async findAll(
    recipientId: string,
    query: ListNotificationsQueryDto,
  ): Promise<PaginatedResult<Notification>> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;

    const qb = this.notificationRepo.createQueryBuilder('n');
    qb.where('n.recipientId = :recipientId', { recipientId });

    if (query.type) {
      qb.andWhere('n.type = :type', { type: query.type });
    }
    if (query.read !== undefined) {
      qb.andWhere('n.read = :read', { read: query.read });
    }

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';
    const allowedSort = ['createdAt', 'type', 'read'];
    const safeSortBy = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(`n.${safeSortBy}`, sortOrder as 'ASC' | 'DESC');

    qb.skip((page - 1) * perPage).take(perPage);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, perPage, totalPages: Math.ceil(total / perPage) };
  }

  async getUnreadCount(recipientId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { recipientId, read: false },
    });
  }

  async markAsRead(id: string, recipientId: string): Promise<Notification | null> {
    const notification = await this.notificationRepo.findOne({
      where: { id, recipientId },
    });
    if (!notification) return null;

    notification.read = true;
    notification.readAt = new Date();
    return this.notificationRepo.save(notification);
  }

  async markAllAsRead(recipientId: string): Promise<number> {
    const result = await this.notificationRepo.update(
      { recipientId, read: false },
      { read: true, readAt: new Date() },
    );
    return result.affected ?? 0;
  }
}
