import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ConsumerService } from '@/consumer/consumer.service';
import { AuditLog } from '@/entities/audit-log.entity';

describe('ConsumerService', () => {
  let service: ConsumerService;
  let repo: jest.Mocked<Partial<Repository<AuditLog>>>;

  const HMAC_SECRET = 'test-hmac-secret';

  beforeEach(async () => {
    repo = {
      save: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumerService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: repo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: unknown) => {
              const map: Record<string, unknown> = {
                'audit.hmacSecret': HMAC_SECRET,
                'rabbitmq.url': 'amqp://localhost:5672',
              };
              return map[key] ?? defaultVal;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(ConsumerService);
    // Manually set hmacSecret since onModuleInit would try to connect
    (service as unknown as { hmacSecret: string }).hmacSecret = HMAC_SECRET;
  });

  describe('buildAuditEntry', () => {
    it('should map expense.created correctly', () => {
      const entry = service.buildAuditEntry('expense.events', 'expense.created', {
        id: 'exp-123',
        userId: 'user-456',
        amount: 5000,
      });

      expect(entry.sourceService).toBe('expense-service');
      expect(entry.eventType).toBe('expense.created');
      expect(entry.action).toBe('CREATE');
      expect(entry.entityType).toBe('expense');
      expect(entry.entityId).toBe('exp-123');
      expect(entry.userId).toBe('user-456');
      expect(entry.payload).toEqual({ id: 'exp-123', userId: 'user-456', amount: 5000 });
    });

    it('should map sale.confirmed correctly', () => {
      const entry = service.buildAuditEntry('sales.events', 'sale.confirmed', {
        id: 'sale-789',
        userId: 'user-111',
      });

      expect(entry.sourceService).toBe('sales-service');
      expect(entry.eventType).toBe('sale.confirmed');
      expect(entry.action).toBe('CONFIRM');
      expect(entry.entityType).toBe('sale');
      expect(entry.entityId).toBe('sale-789');
    });

    it('should map payment.received correctly', () => {
      const entry = service.buildAuditEntry('sales.events', 'payment.received', {
        id: 'pay-001',
        userId: 'user-222',
      });

      expect(entry.action).toBe('RECEIVE');
      expect(entry.entityType).toBe('payment');
    });

    it('should handle unknown events gracefully', () => {
      const entry = service.buildAuditEntry('other.events', 'custom.action', {
        id: 'xyz',
      });

      expect(entry.sourceService).toBe('other-service');
      expect(entry.action).toBe('ACTION');
      expect(entry.entityType).toBe('custom');
      expect(entry.entityId).toBe('xyz');
    });

    it('should handle null userId and entityId', () => {
      const entry = service.buildAuditEntry('expense.events', 'budget.alert', {
        departmentId: 'dept-1',
      });

      expect(entry.userId).toBeNull();
      expect(entry.entityId).toBeNull();
      expect(entry.action).toBe('ALERT');
      expect(entry.entityType).toBe('budget');
    });

    it('should extract ipAddress from payload', () => {
      const entry = service.buildAuditEntry('expense.events', 'expense.created', {
        id: 'exp-1',
        ipAddress: '192.168.1.1',
      });

      expect(entry.ipAddress).toBe('192.168.1.1');
    });

    it('should support snake_case user_id and ip_address', () => {
      const entry = service.buildAuditEntry('expense.events', 'expense.created', {
        id: 'exp-2',
        user_id: 'user-snake',
        ip_address: '10.0.0.1',
      });

      expect(entry.userId).toBe('user-snake');
      expect(entry.ipAddress).toBe('10.0.0.1');
    });
  });

  describe('computeSignature', () => {
    it('should produce a valid HMAC-SHA256 hex string', () => {
      const entry = new AuditLog();
      entry.sourceService = 'expense-service';
      entry.eventType = 'expense.created';
      entry.userId = 'user-1';
      entry.action = 'CREATE';
      entry.entityType = 'expense';
      entry.entityId = 'exp-1';
      entry.payload = { amount: 1000 };

      const signature = service.computeSignature(entry);

      expect(signature).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(signature)).toBe(true);
    });

    it('should produce the same signature for the same data', () => {
      const entry = new AuditLog();
      entry.sourceService = 'sales-service';
      entry.eventType = 'sale.created';
      entry.userId = 'user-2';
      entry.action = 'CREATE';
      entry.entityType = 'sale';
      entry.entityId = 'sale-2';
      entry.payload = { total: 2000 };

      const sig1 = service.computeSignature(entry);
      const sig2 = service.computeSignature(entry);

      expect(sig1).toBe(sig2);
    });

    it('should produce different signatures for different data', () => {
      const entry1 = new AuditLog();
      entry1.sourceService = 'expense-service';
      entry1.eventType = 'expense.created';
      entry1.userId = 'user-1';
      entry1.action = 'CREATE';
      entry1.entityType = 'expense';
      entry1.entityId = 'exp-1';
      entry1.payload = { amount: 1000 };

      const entry2 = new AuditLog();
      entry2.sourceService = 'expense-service';
      entry2.eventType = 'expense.approved';
      entry2.userId = 'user-1';
      entry2.action = 'APPROVE';
      entry2.entityType = 'expense';
      entry2.entityId = 'exp-1';
      entry2.payload = { amount: 1000 };

      expect(service.computeSignature(entry1)).not.toBe(service.computeSignature(entry2));
    });

    it('should match manual HMAC computation', () => {
      const entry = new AuditLog();
      entry.sourceService = 'test-service';
      entry.eventType = 'test.event';
      entry.userId = null;
      entry.action = 'TEST';
      entry.entityType = 'test';
      entry.entityId = null;
      entry.payload = null;

      const canonical = JSON.stringify({
        sourceService: 'test-service',
        eventType: 'test.event',
        userId: null,
        action: 'TEST',
        entityType: 'test',
        entityId: null,
        payload: null,
      });

      const expected = crypto.createHmac('sha256', HMAC_SECRET).update(canonical).digest('hex');

      expect(service.computeSignature(entry)).toBe(expected);
    });
  });

  describe('handleMessage', () => {
    it('should process a valid message and ack', async () => {
      const ack = jest.fn();
      (service as unknown as { channel: { ack: jest.Mock; nack: jest.Mock } }).channel = {
        ack,
        nack: jest.fn(),
      };

      const msg = {
        fields: { routingKey: 'expense.created', exchange: 'expense.events' },
        content: Buffer.from(JSON.stringify({ id: 'exp-100', userId: 'user-1' })),
      } as unknown as import('amqplib').ConsumeMessage;

      await service.handleMessage(msg);

      expect(repo.save).toHaveBeenCalledTimes(1);
      const savedEntry = (repo.save as jest.Mock).mock.calls[0][0];
      expect(savedEntry.sourceService).toBe('expense-service');
      expect(savedEntry.eventType).toBe('expense.created');
      expect(savedEntry.action).toBe('CREATE');
      expect(savedEntry.signature).toHaveLength(64);
      expect(ack).toHaveBeenCalledWith(msg);
    });

    it('should nack on malformed JSON', async () => {
      const nack = jest.fn();
      (service as unknown as { channel: { ack: jest.Mock; nack: jest.Mock } }).channel = {
        ack: jest.fn(),
        nack,
      };

      const msg = {
        fields: { routingKey: 'expense.created', exchange: 'expense.events' },
        content: Buffer.from('not-valid-json'),
      } as unknown as import('amqplib').ConsumeMessage;

      await service.handleMessage(msg);

      expect(repo.save).not.toHaveBeenCalled();
      expect(nack).toHaveBeenCalledWith(msg, false, false);
    });

    it('should ignore null messages', async () => {
      await service.handleMessage(null);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
