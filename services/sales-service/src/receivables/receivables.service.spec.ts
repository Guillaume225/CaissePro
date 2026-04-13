import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ReceivablesService } from './receivables.service';
import { Receivable } from '../entities/receivable.entity';
import { AgingBucket } from '../entities/enums';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../events/events.service';

describe('ReceivablesService', () => {
  let service: ReceivablesService;

  const mockReceivable: Partial<Receivable> = {
    id: 'r1',
    saleId: 's1',
    clientId: 'c1',
    totalAmount: 11800,
    paidAmount: 5000,
    outstandingAmount: 6800,
    dueDate: '2025-01-15',
    agingBucket: AgingBucket.CURRENT,
    isSettled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepo = {
    createQueryBuilder: jest.fn().mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockReceivable], 1]),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue({ count: '0', totalOutstanding: '0' }),
    }),
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
  const mockEvents = { publish: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceivablesService,
        { provide: getRepositoryToken(Receivable), useValue: mockRepo },
        { provide: AuditService, useValue: mockAudit },
        { provide: EventsService, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<ReceivablesService>(ReceivablesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated receivables', async () => {
      const result = await service.findAll({});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return a receivable', async () => {
      mockRepo.findOne.mockResolvedValue({
        ...mockReceivable,
        sale: { reference: 'VTE-2025-00001' },
        client: { name: 'Test' },
      });
      const result = await service.findById('r1');
      expect(result.outstandingAmount).toBe(6800);
    });

    it('should throw NotFoundException', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAgingReport', () => {
    it('should return aggregated aging report', async () => {
      const result = await service.getAgingReport();
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('byBucket');
      expect(result).toHaveProperty('byClient');
    });
  });

  describe('updateAgingBuckets (cron)', () => {
    it('should update aging buckets for overdue receivables', async () => {
      const pastDue = new Date();
      pastDue.setDate(pastDue.getDate() - 35); // 35 days ago → D30

      mockRepo.find.mockResolvedValue([
        {
          ...mockReceivable,
          dueDate: pastDue.toISOString().split('T')[0],
          agingBucket: AgingBucket.CURRENT,
        },
      ]);
      mockRepo.save.mockResolvedValue({});

      await service.updateAgingBuckets();

      expect(mockRepo.save).toHaveBeenCalled();
      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.agingBucket).toBe(AgingBucket.D30);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AGING_UPDATE' }),
      );
      // Should publish overdue alert (CURRENT → D30)
      expect(mockEvents.publish).toHaveBeenCalledWith(
        'receivable.overdue',
        expect.objectContaining({ receivableId: 'r1' }),
      );
    });

    it('should categorize 65-day overdue as D60', async () => {
      const pastDue = new Date();
      pastDue.setDate(pastDue.getDate() - 65);

      mockRepo.find.mockResolvedValue([
        {
          ...mockReceivable,
          dueDate: pastDue.toISOString().split('T')[0],
          agingBucket: AgingBucket.D30,
        },
      ]);
      mockRepo.save.mockResolvedValue({});

      await service.updateAgingBuckets();

      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.agingBucket).toBe(AgingBucket.D60);
    });

    it('should categorize 95-day overdue as D90', async () => {
      const pastDue = new Date();
      pastDue.setDate(pastDue.getDate() - 95);

      mockRepo.find.mockResolvedValue([
        {
          ...mockReceivable,
          dueDate: pastDue.toISOString().split('T')[0],
          agingBucket: AgingBucket.D60,
        },
      ]);
      mockRepo.save.mockResolvedValue({});

      await service.updateAgingBuckets();

      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.agingBucket).toBe(AgingBucket.D90);
    });

    it('should not update if bucket unchanged', async () => {
      mockRepo.find.mockResolvedValue([
        {
          ...mockReceivable,
          dueDate: new Date().toISOString().split('T')[0], // today → CURRENT
          agingBucket: AgingBucket.CURRENT,
        },
      ]);

      await service.updateAgingBuckets();

      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });
});
