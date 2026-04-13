import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SelectQueryBuilder } from 'typeorm';
import { NotificationsService } from '@/notifications/notifications.service';
import { Notification } from '@/entities/notification.entity';
import { NotificationsGateway } from '@/notifications/notifications.gateway';
import { EmailService } from '@/channels/email/email.service';
import { SMS_PROVIDER } from '@/channels/sms/sms-provider.interface';
import { NotificationType, NotificationChannel } from '@/common/enums';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let qb: jest.Mocked<Partial<SelectQueryBuilder<Notification>>>;
  let repo: Record<string, jest.Mock>;
  let gateway: jest.Mocked<Partial<NotificationsGateway>>;
  let emailService: jest.Mocked<Partial<EmailService>>;
  let smsProvider: { send: jest.Mock };

  function makeNotification(overrides: Partial<Notification> = {}): Notification {
    const n = new Notification();
    n.id = 'notif-1';
    n.recipientId = 'user-1';
    n.type = NotificationType.EXPENSE_TO_VALIDATE;
    n.title = 'Test';
    n.message = 'Test message';
    n.channels = [NotificationChannel.IN_APP];
    n.read = false;
    n.readAt = null;
    n.entityType = 'expense';
    n.entityId = 'exp-1';
    n.metadata = null;
    n.createdAt = new Date('2024-01-15T10:00:00Z');
    n.updatedAt = new Date('2024-01-15T10:00:00Z');
    Object.assign(n, overrides);
    return n;
  }

  beforeEach(async () => {
    qb = {
      where: jest.fn().mockReturnThis() as jest.Mocked<SelectQueryBuilder<Notification>>['where'],
      andWhere: jest.fn().mockReturnThis() as jest.Mocked<
        SelectQueryBuilder<Notification>
      >['andWhere'],
      orderBy: jest.fn().mockReturnThis() as jest.Mocked<
        SelectQueryBuilder<Notification>
      >['orderBy'],
      skip: jest.fn().mockReturnThis() as jest.Mocked<SelectQueryBuilder<Notification>>['skip'],
      take: jest.fn().mockReturnThis() as jest.Mocked<SelectQueryBuilder<Notification>>['take'],
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]) as jest.Mocked<
        SelectQueryBuilder<Notification>
      >['getManyAndCount'],
    };

    repo = {
      create: jest.fn((data: Partial<Notification>) => ({ ...makeNotification(), ...data })),
      save: jest.fn((entity: Notification) => Promise.resolve(entity)),
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    gateway = {
      sendToUser: jest.fn(),
      sendUnreadCount: jest.fn(),
    };

    emailService = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    smsProvider = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: repo },
        { provide: NotificationsGateway, useValue: gateway },
        { provide: EmailService, useValue: emailService },
        { provide: SMS_PROVIDER, useValue: smsProvider },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  /* ------------------------------------------------------------------ */
  /*  create                                                            */
  /* ------------------------------------------------------------------ */

  describe('create', () => {
    it('should create and save a notification', async () => {
      const input = {
        recipientId: 'user-1',
        type: NotificationType.EXPENSE_APPROVED,
        title: 'Approved',
        message: 'Your expense was approved',
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        entityType: 'expense',
        entityId: 'exp-1',
        metadata: { amount: 5000 },
      };

      const result = await service.create(input);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user-1',
          type: NotificationType.EXPENSE_APPROVED,
          read: false,
        }),
      );
      expect(repo.save).toHaveBeenCalled();
      expect(result.recipientId).toBe('user-1');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  pushToWebSocket                                                   */
  /* ------------------------------------------------------------------ */

  describe('pushToWebSocket', () => {
    it('should send notification + unread count via gateway', async () => {
      const notif = makeNotification();
      repo.count.mockResolvedValueOnce(5);

      await service.pushToWebSocket('user-1', notif);

      expect(gateway.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          id: 'notif-1',
          type: NotificationType.EXPENSE_TO_VALIDATE,
        }),
      );
      expect(gateway.sendUnreadCount).toHaveBeenCalledWith('user-1', 5);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  sendEmail                                                         */
  /* ------------------------------------------------------------------ */

  describe('sendEmail', () => {
    it('should delegate to email service', async () => {
      await service.sendEmail('user@test.com', NotificationType.BUDGET_ALERT, 'Alert', 'text', {});
      expect(emailService.send).toHaveBeenCalledWith(
        'user@test.com',
        NotificationType.BUDGET_ALERT,
        'Alert',
        'text',
        {},
      );
    });
  });

  /* ------------------------------------------------------------------ */
  /*  sendSms                                                           */
  /* ------------------------------------------------------------------ */

  describe('sendSms', () => {
    it('should delegate to SMS provider', async () => {
      await service.sendSms('+237600000000', 'Hello SMS');
      expect(smsProvider.send).toHaveBeenCalledWith('+237600000000', 'Hello SMS');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  findAll                                                           */
  /* ------------------------------------------------------------------ */

  describe('findAll', () => {
    it('should return paginated results filtered by recipientId', async () => {
      const notifications = [makeNotification()];
      (qb.getManyAndCount as jest.Mock).mockResolvedValueOnce([notifications, 1]);

      const result = await service.findAll('user-1', {});

      expect(qb.where).toHaveBeenCalledWith('n.recipientId = :recipientId', {
        recipientId: 'user-1',
      });
      expect(result.data).toEqual(notifications);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(20);
    });

    it('should apply page and perPage', async () => {
      (qb.getManyAndCount as jest.Mock).mockResolvedValueOnce([[], 50]);

      const result = await service.findAll('user-1', { page: 3, perPage: 10 });

      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result.totalPages).toBe(5);
    });

    it('should apply type filter', async () => {
      (qb.getManyAndCount as jest.Mock).mockResolvedValueOnce([[], 0]);

      await service.findAll('user-1', { type: NotificationType.BUDGET_ALERT });

      expect(qb.andWhere).toHaveBeenCalledWith('n.type = :type', {
        type: NotificationType.BUDGET_ALERT,
      });
    });

    it('should apply read filter', async () => {
      (qb.getManyAndCount as jest.Mock).mockResolvedValueOnce([[], 0]);

      await service.findAll('user-1', { read: false });

      expect(qb.andWhere).toHaveBeenCalledWith('n.read = :read', { read: false });
    });

    it('should sanitize sortBy', async () => {
      (qb.getManyAndCount as jest.Mock).mockResolvedValueOnce([[], 0]);

      await service.findAll('user-1', { sortBy: 'DROP TABLE' });

      expect(qb.orderBy).toHaveBeenCalledWith('n.createdAt', 'DESC');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  getUnreadCount                                                    */
  /* ------------------------------------------------------------------ */

  describe('getUnreadCount', () => {
    it('should count unread notifications for user', async () => {
      repo.count.mockResolvedValueOnce(7);

      const count = await service.getUnreadCount('user-1');

      expect(repo.count).toHaveBeenCalledWith({
        where: { recipientId: 'user-1', read: false },
      });
      expect(count).toBe(7);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  markAsRead                                                        */
  /* ------------------------------------------------------------------ */

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notif = makeNotification();
      repo.findOne.mockResolvedValueOnce(notif);

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'notif-1', recipientId: 'user-1' },
      });
      expect(result?.read).toBe(true);
      expect(result?.readAt).toBeInstanceOf(Date);
    });

    it('should return null if notification not found', async () => {
      repo.findOne.mockResolvedValueOnce(null);

      const result = await service.markAsRead('notif-999', 'user-1');

      expect(result).toBeNull();
    });

    it('should return null if notification belongs to another user', async () => {
      repo.findOne.mockResolvedValueOnce(null);

      const result = await service.markAsRead('notif-1', 'other-user');

      expect(result).toBeNull();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  markAllAsRead                                                     */
  /* ------------------------------------------------------------------ */

  describe('markAllAsRead', () => {
    it('should update all unread for user', async () => {
      repo.update.mockResolvedValueOnce({ affected: 5 });

      const count = await service.markAllAsRead('user-1');

      expect(repo.update).toHaveBeenCalledWith(
        { recipientId: 'user-1', read: false },
        expect.objectContaining({ read: true }),
      );
      expect(count).toBe(5);
    });

    it('should return 0 if none to update', async () => {
      repo.update.mockResolvedValueOnce({ affected: 0 });

      const count = await service.markAllAsRead('user-1');

      expect(count).toBe(0);
    });
  });
});
