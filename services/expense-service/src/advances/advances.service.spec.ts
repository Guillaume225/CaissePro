import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdvancesService } from './advances.service';
import { Advance } from '../entities/advance.entity';
import { AdvanceStatus } from '../entities/enums';
import { AuditService } from '../audit/audit.service';

const createMockQb = (countResult?: [any[], number]) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue(countResult || [[], 0]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ affected: 0 }),
});

const mockRepo = (qb?: any) => ({
  findOne: jest.fn(),
  create: jest.fn((a) => a),
  save: jest.fn((a) => Promise.resolve({ id: 'adv-1', ...a })),
  createQueryBuilder: jest.fn().mockReturnValue(qb || createMockQb()),
});

const mockAudit = () => ({ log: jest.fn() });

describe('AdvancesService', () => {
  let service: AdvancesService;
  let repo: ReturnType<typeof mockRepo>;
  let audit: ReturnType<typeof mockAudit>;

  beforeEach(async () => {
    repo = mockRepo();
    audit = mockAudit();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvancesService,
        { provide: getRepositoryToken(Advance), useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<AdvancesService>(AdvancesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const qb = createMockQb([[], 0]);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({});
      expect(result.data).toEqual([]);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return an advance', async () => {
      repo.findOne.mockResolvedValue({
        id: 'adv-1',
        employeeId: 'emp-1',
        amount: 5000,
        justifiedAmount: 0,
        status: AdvanceStatus.PENDING,
        reason: 'Mission',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.findById('adv-1');
      expect(result.id).toBe('adv-1');
      expect(result.remainingAmount).toBe(5000);
    });

    it('should throw NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create an advance', async () => {
      repo.save.mockResolvedValue({ id: 'adv-1' });
      repo.findOne.mockResolvedValue({
        id: 'adv-1',
        employeeId: 'emp-1',
        amount: 5000,
        justifiedAmount: 0,
        status: AdvanceStatus.PENDING,
        reason: 'Mission',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(
        { employeeId: 'emp-1', amount: 5000, reason: 'Mission' },
        'user-1',
      );

      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalled();
    });
  });

  describe('justify', () => {
    it('should partially justify', async () => {
      const adv = {
        id: 'adv-1',
        amount: 5000,
        justifiedAmount: 0,
        status: AdvanceStatus.PENDING,
      };
      repo.findOne
        .mockResolvedValueOnce(adv)
        .mockResolvedValueOnce({
          ...adv,
          justifiedAmount: 2000,
          status: AdvanceStatus.PARTIAL,
          createdAt: new Date(),
          updatedAt: new Date(),
          employeeId: 'emp-1',
        });

      const result = await service.justify('adv-1', { justifiedAmount: 2000 }, 'user-1');
      expect(repo.save).toHaveBeenCalled();
    });

    it('should fully justify', async () => {
      const adv = {
        id: 'adv-1',
        amount: 5000,
        justifiedAmount: 3000,
        status: AdvanceStatus.PARTIAL,
      };
      repo.findOne
        .mockResolvedValueOnce(adv)
        .mockResolvedValueOnce({
          ...adv,
          justifiedAmount: 5000,
          status: AdvanceStatus.JUSTIFIED,
          createdAt: new Date(),
          updatedAt: new Date(),
          employeeId: 'emp-1',
        });

      await service.justify('adv-1', { justifiedAmount: 2000 }, 'user-1');
      expect(adv.status).toBe(AdvanceStatus.JUSTIFIED);
    });

    it('should reject over-justification', async () => {
      repo.findOne.mockResolvedValue({
        id: 'adv-1',
        amount: 5000,
        justifiedAmount: 4000,
        status: AdvanceStatus.PARTIAL,
      });

      await expect(
        service.justify('adv-1', { justifiedAmount: 2000 }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if already justified', async () => {
      repo.findOne.mockResolvedValue({
        id: 'adv-1',
        amount: 5000,
        justifiedAmount: 5000,
        status: AdvanceStatus.JUSTIFIED,
      });

      await expect(
        service.justify('adv-1', { justifiedAmount: 100 }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkOverdue', () => {
    it('should mark overdue advances', async () => {
      const qb = createMockQb();
      (qb as any).execute = jest.fn().mockResolvedValue({ affected: 3 });
      repo.createQueryBuilder.mockReturnValue(qb);

      const count = await service.checkOverdue();
      expect(count).toBe(3);
    });
  });
});
