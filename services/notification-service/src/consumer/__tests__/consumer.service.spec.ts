import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConsumerService } from '@/consumer/consumer.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { NotificationType, NotificationChannel } from '@/common/enums';
import { ROUTING_RULES } from '@/consumer/routing-rules';

describe('ConsumerService', () => {
  let service: ConsumerService;
  let notificationsService: jest.Mocked<Partial<NotificationsService>>;

  beforeEach(async () => {
    notificationsService = {
      create: jest.fn().mockResolvedValue({
        id: 'notif-1',
        recipientId: 'user-1',
        type: NotificationType.EXPENSE_TO_VALIDATE,
        title: 'Test',
        message: 'Test message',
        channels: [NotificationChannel.IN_APP],
        createdAt: new Date(),
      }),
      pushToWebSocket: jest.fn().mockResolvedValue(undefined),
      sendEmail: jest.fn().mockResolvedValue(undefined),
      sendSms: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumerService,
        { provide: NotificationsService, useValue: notificationsService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: unknown) => {
              const map: Record<string, unknown> = {
                'rabbitmq.url': 'amqp://localhost:5672',
              };
              return map[key] ?? defaultVal;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(ConsumerService);
  });

  describe('renderTemplate', () => {
    it('should render Handlebars template', () => {
      const result = service.renderTemplate('Hello {{name}}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should return template on error', () => {
      const result = service.renderTemplate('{{#if}}broken', {});
      // Handlebars will throw, returns original
      expect(typeof result).toBe('string');
    });
  });

  describe('dispatch', () => {
    it('should create in-app notification and push WebSocket', async () => {
      const rule = ROUTING_RULES['expense.submitted'];
      const payload = {
        id: 'exp-1',
        reference: 'DEP-001',
        amount: 5000,
        submitterName: 'Jean',
        approverIds: ['user-mgr-1'],
      };

      await service.dispatch(rule, payload);

      expect(notificationsService.create).toHaveBeenCalledTimes(1);
      const createArg = (notificationsService.create as jest.Mock).mock.calls[0][0];
      expect(createArg.recipientId).toBe('user-mgr-1');
      expect(createArg.type).toBe(NotificationType.EXPENSE_TO_VALIDATE);
      expect(createArg.entityType).toBe('expense');
      expect(createArg.entityId).toBe('exp-1');
      expect(notificationsService.pushToWebSocket).toHaveBeenCalled();
    });

    it('should dispatch to multiple recipients', async () => {
      const rule = ROUTING_RULES['budget.alert'];
      const payload = {
        budgetId: 'bgt-1',
        budgetName: 'IT Budget',
        percentage: 90,
        consumed: 900000,
        total: 1000000,
        recipientIds: ['user-1', 'user-2', 'user-3'],
      };

      await service.dispatch(rule, payload);

      expect(notificationsService.create).toHaveBeenCalledTimes(3);
    });

    it('should send email when channel includes EMAIL and email is provided', async () => {
      const rule = ROUTING_RULES['expense.approved'];
      const payload = {
        id: 'exp-1',
        reference: 'DEP-001',
        amount: 5000,
        approverName: 'Boss',
        submitterId: 'user-1',
        recipientEmail: 'user@test.com',
      };

      await service.dispatch(rule, payload);

      expect(notificationsService.sendEmail).toHaveBeenCalledWith(
        'user@test.com',
        NotificationType.EXPENSE_APPROVED,
        expect.any(String),
        expect.any(String),
        payload,
      );
    });

    it('should send SMS when channel includes SMS and phone is provided', async () => {
      const rule = ROUTING_RULES['budget.alert'];
      const payload = {
        budgetId: 'bgt-1',
        budgetName: 'IT',
        percentage: 100,
        consumed: 1000000,
        total: 1000000,
        recipientIds: ['user-1'],
        recipientPhone: '+237600000000',
      };

      await service.dispatch(rule, payload);

      expect(notificationsService.sendSms).toHaveBeenCalledWith(
        '+237600000000',
        expect.any(String),
      );
    });

    it('should skip when no recipients', async () => {
      const rule = ROUTING_RULES['expense.submitted'];
      const payload = { id: 'exp-1', approverIds: [] };

      await service.dispatch(rule, payload);

      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  describe('handleMessage', () => {
    it('should process a known routing key', async () => {
      const ack = jest.fn();
      (service as any).channel = { ack, nack: jest.fn() };

      const msg = {
        fields: { routingKey: 'expense.submitted', exchange: 'expense.events' },
        content: Buffer.from(JSON.stringify({
          id: 'exp-1',
          reference: 'DEP-001',
          approverIds: ['user-1'],
        })),
      } as any;

      await service.handleMessage(msg);

      expect(ack).toHaveBeenCalledWith(msg);
      expect(notificationsService.create).toHaveBeenCalled();
    });

    it('should ack unknown routing keys without creating notifications', async () => {
      const ack = jest.fn();
      (service as any).channel = { ack, nack: jest.fn() };

      const msg = {
        fields: { routingKey: 'unknown.event', exchange: 'expense.events' },
        content: Buffer.from(JSON.stringify({ id: 'x' })),
      } as any;

      await service.handleMessage(msg);

      expect(ack).toHaveBeenCalledWith(msg);
      expect(notificationsService.create).not.toHaveBeenCalled();
    });

    it('should nack on malformed JSON', async () => {
      const nack = jest.fn();
      (service as any).channel = { ack: jest.fn(), nack };

      const msg = {
        fields: { routingKey: 'expense.submitted', exchange: 'expense.events' },
        content: Buffer.from('not-json'),
      } as any;

      await service.handleMessage(msg);

      expect(nack).toHaveBeenCalledWith(msg, false, false);
    });

    it('should ignore null messages', async () => {
      await service.handleMessage(null);
      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });
});
