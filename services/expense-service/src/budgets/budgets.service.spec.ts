import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { Budget } from '../entities/budget.entity';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../events/events.service';

const createMockQb = (result?: any, manyResult?: any[]) => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(result || null),
  getMany: jest.fn().mockResolvedValue(manyResult || []),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ affected: 0 }),
});

const mockRepo = (qb?: any) => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((b) => b),
  save: jest.fn((b) => Promise.resolve({ id: 'bud-1', ...b })),
  createQueryBuilder: jest.fn().mockReturnValue(qb || createMockQb()),
});

const mockAudit = () => ({ log: jest.fn() });
const mockEvents = () => ({ publish: jest.fn() });

describe('BudgetsService', () => {
  let service: BudgetsService;
  let repo: ReturnType<typeof mockRepo>;
  let audit: ReturnType<typeof mockAudit>;
  let events: ReturnType<typeof mockEvents>;

  beforeEach(async () => {
    repo = mockRepo();
    audit = mockAudit();
    events = mockEvents();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: getRepositoryToken(Budget), useValue: repo },
        { provide: AuditService, useValue: audit },
        { provide: EventsService, useValue: events },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return a budget', async () => {
      const budget = {
        id: 'bud-1',
        categoryId: 'cat-1',
        allocatedAmount: 10000,
        consumedAmount: 5000,
        alertThresholds: [50, 75, 90, 100],
        category: { name: 'Test' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repo.findOne.mockResolvedValue(budget);

      const result = await service.findById('bud-1');
      expect(result.id).toBe('bud-1');
      expect(result.consumptionPercentage).toBe(50);
      expect(result.remainingAmount).toBe(5000);
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a budget', async () => {
      const qb = createMockQb(null); // no overlap
      repo.createQueryBuilder.mockReturnValue(qb);
      repo.save.mockResolvedValue({ id: 'bud-1' });
      repo.findOne.mockResolvedValue({
        id: 'bud-1',
        categoryId: 'cat-1',
        allocatedAmount: 10000,
        consumedAmount: 0,
        alertThresholds: [50, 75, 90, 100],
        category: { name: 'Test' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(
        {
          categoryId: 'cat-1',
          periodStart: '2024-01-01',
          periodEnd: '2024-12-31',
          allocatedAmount: 10000,
        },
        'user-1',
      );

      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalled();
    });

    it('should reject overlapping budget', async () => {
      const qb = createMockQb({ id: 'existing' });
      repo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.create(
          {
            categoryId: 'cat-1',
            periodStart: '2024-01-01',
            periodEnd: '2024-12-31',
            allocatedAmount: 10000,
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('consumeBudget', () => {
    it('should update consumed amount', async () => {
      const budget = {
        id: 'bud-1',
        categoryId: 'cat-1',
        allocatedAmount: 10000,
        consumedAmount: 4000,
        alertThresholds: [50, 75, 90, 100],
      };
      const qb = createMockQb(budget);
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.consumeBudget('cat-1', 1500, '2024-06-15');

      expect(repo.save).toHaveBeenCalled();
      expect(budget.consumedAmount).toBe(5500);
    });

    it('should send alert when threshold crossed', async () => {
      const budget = {
        id: 'bud-1',
        categoryId: 'cat-1',
        allocatedAmount: 10000,
        consumedAmount: 4500,
        alertThresholds: [50, 75, 90, 100],
      };
      const qb = createMockQb(budget);
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.consumeBudget('cat-1', 600, '2024-06-15');

      expect(events.publish).toHaveBeenCalled();
    });

    it('should not fail if no budget found', async () => {
      const qb = createMockQb(null);
      repo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.consumeBudget('cat-1', 100, '2024-06-15'),
      ).resolves.not.toThrow();
    });
  });
});
