import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsController } from '@/notifications/notifications.controller';
import { NotificationsService } from '@/notifications/notifications.service';
import '@/common/enums';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: jest.Mocked<Partial<NotificationsService>>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        perPage: 20,
        totalPages: 0,
      }),
      getUnreadCount: jest.fn().mockResolvedValue(3),
      markAsRead: jest.fn().mockResolvedValue({
        id: 'notif-1',
        read: true,
        readAt: new Date(),
      }),
      markAllAsRead: jest.fn().mockResolvedValue(5),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: service }],
    }).compile();

    controller = module.get(NotificationsController);
  });

  describe('findAll', () => {
    it('should call service.findAll with userId and query', async () => {
      const query = { page: 1, perPage: 10 };
      await controller.findAll('user-1', query);
      expect(service.findAll).toHaveBeenCalledWith('user-1', query);
    });

    it('should return paginated result', async () => {
      const result = await controller.findAll('user-1', {});
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
    });
  });

  describe('unreadCount', () => {
    it('should return count object', async () => {
      const result = await controller.unreadCount('user-1');
      expect(service.getUnreadCount).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('readAll', () => {
    it('should return affected count', async () => {
      const result = await controller.readAll('user-1');
      expect(service.markAllAsRead).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ affected: 5 });
    });
  });

  describe('markAsRead', () => {
    it('should return the updated notification', async () => {
      const result = await controller.markAsRead('notif-1', 'user-1');
      expect(service.markAsRead).toHaveBeenCalledWith('notif-1', 'user-1');
      expect(result).toHaveProperty('read', true);
    });

    it('should throw NotFoundException when notification not found', async () => {
      (service.markAsRead as jest.Mock).mockResolvedValueOnce(null);

      await expect(controller.markAsRead('notif-999', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
