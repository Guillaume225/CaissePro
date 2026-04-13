import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CashClosingService } from './cash-closing.service';
import { CashDay } from '../entities/cash-day.entity';
import { Expense } from '../entities/expense.entity';
import { CashDayStatus } from '../entities/enums';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../events/events.service';

const mockUser = { id: 'user-1', email: 'a@b.com', roleName: 'CAISSIER', permissions: [], tenantId: '00000000-0000-4000-a000-000000000001' };

function makeMockClosing(overrides: Partial<CashDay> = {}): CashDay {
  return {
    id: 'closing-1',
    reference: 'CLD-2026-00001',
    status: CashDayStatus.OPEN,
    openingBalance: 100000,
    totalEntries: 0,
    totalExits: 0,
    theoreticalBalance: 100000,
    actualBalance: null,
    variance: 0,
    comment: null,
    openedById: 'user-1',
    closedById: null,
    openedAt: new Date('2026-03-30T08:00:00Z'),
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    movements: [],
    ...overrides,
  } as CashDay;
}

describe('CashClosingService (expense)', () => {
  let service: CashClosingService;
  let closingRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let expenseRepo: { createQueryBuilder: jest.Mock };
  let auditService: { log: jest.Mock };
  let eventsService: { publish: jest.Mock };

  const mockQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  beforeEach(async () => {
    closingRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => ({ ...makeMockClosing(), ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      createQueryBuilder: jest.fn(() => ({ ...mockQb })),
    };

    expenseRepo = {
      createQueryBuilder: jest.fn(() => ({ ...mockQb })),
    };

    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    eventsService = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashClosingService,
        { provide: getRepositoryToken(CashDay), useValue: closingRepo },
        { provide: getRepositoryToken(Expense), useValue: expenseRepo },
        { provide: AuditService, useValue: auditService },
        { provide: EventsService, useValue: eventsService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const c: Record<string, unknown> = {
                'cashClosing.varianceThreshold': 5000,
                'cashClosing.reminderHour': 18,
              };
              return c[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get(CashClosingService);
  });

  /* ─── OPEN ─── */
  describe('open', () => {
    it('should open a new cash register', async () => {
      closingRepo.findOne.mockResolvedValue(null); // no existing open
      const result = await service.open({ openingBalance: 100000 }, mockUser);

      expect(result.status).toBe(CashDayStatus.OPEN);
      expect(result.openingBalance).toBe(100000);
      expect(closingRepo.save).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalled();
      expect(eventsService.publish).toHaveBeenCalled();
    });

    it('should reject if a register is already open', async () => {
      closingRepo.findOne.mockResolvedValue(makeMockClosing());

      await expect(
        service.open({ openingBalance: 100000 }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if yesterday closing is not done', async () => {
      closingRepo.findOne.mockResolvedValueOnce(null); // first call: no open register

      // Mock isYesterdayClosed to return open register from yesterday
      const yesterdayClosing = makeMockClosing({
        openedAt: new Date(Date.now() - 86400000),
        status: CashDayStatus.OPEN,
      });
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(yesterdayClosing),
      };
      closingRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.open({ openingBalance: 50000 }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ─── GET CURRENT ─── */
  describe('getCurrent', () => {
    it('should return the current open register with live totals', async () => {
      closingRepo.findOne.mockResolvedValue(makeMockClosing());

      const expQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '25000' }),
      };
      expenseRepo.createQueryBuilder.mockReturnValue(expQb);

      const result = await service.getCurrent();

      expect(result.openingBalance).toBe(100000);
      expect(result.totalExits).toBe(25000);
      expect(result.theoreticalBalance).toBe(75000); // 100000 + 0 - 25000
    });

    it('should throw NotFoundException if no register is open', async () => {
      closingRepo.findOne.mockResolvedValue(null);
      await expect(service.getCurrent()).rejects.toThrow(NotFoundException);
    });
  });

  /* ─── CLOSE ─── */
  describe('close', () => {
    it('should close the register with matching balance', async () => {
      closingRepo.findOne.mockResolvedValue(makeMockClosing());

      const expQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '20000' }),
      };
      expenseRepo.createQueryBuilder.mockReturnValue(expQb);

      const result = await service.close({ actualBalance: 80000 }, mockUser);

      expect(result.status).toBe(CashDayStatus.CLOSED);
      expect(result.theoreticalBalance).toBe(80000); // 100000 - 20000
      expect(result.actualBalance).toBe(80000);
      expect(result.variance).toBe(0);
      expect(auditService.log).toHaveBeenCalled();
    });

    it('should compute variance correctly', async () => {
      closingRepo.findOne.mockResolvedValue(makeMockClosing());

      const expQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '30000' }),
      };
      expenseRepo.createQueryBuilder.mockReturnValue(expQb);

      // theoretical = 100000 - 30000 = 70000, actual = 68000, variance = -2000
      const result = await service.close({ actualBalance: 68000 }, mockUser);

      expect(result.variance).toBe(-2000);
    });

    it('should require comment when variance exceeds threshold', async () => {
      closingRepo.findOne.mockResolvedValue(makeMockClosing());

      const expQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '10000' }),
      };
      expenseRepo.createQueryBuilder.mockReturnValue(expQb);

      // theoretical = 100000 - 10000 = 90000, actual = 82000, variance = -8000 > 5000 threshold
      await expect(
        service.close({ actualBalance: 82000 }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept large variance with comment', async () => {
      closingRepo.findOne.mockResolvedValue(makeMockClosing());

      const expQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '10000' }),
      };
      expenseRepo.createQueryBuilder.mockReturnValue(expQb);

      const result = await service.close(
        { actualBalance: 82000, comment: 'Billet manquant' },
        mockUser,
      );

      expect(result.status).toBe(CashDayStatus.CLOSED);
      expect(result.variance).toBe(-8000);
      expect(result.comment).toBe('Billet manquant');
    });

    it('should send DAF alert event when variance exceeds threshold', async () => {
      closingRepo.findOne.mockResolvedValue(makeMockClosing());

      const expQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '10000' }),
      };
      expenseRepo.createQueryBuilder.mockReturnValue(expQb);

      await service.close(
        { actualBalance: 82000, comment: 'Explication' },
        mockUser,
      );

      // 3 publish calls: CLOSED + VARIANCE_ALERT
      expect(eventsService.publish).toHaveBeenCalledTimes(2);
    });

    it('should throw if no register is open', async () => {
      closingRepo.findOne.mockResolvedValue(null);
      await expect(
        service.close({ actualBalance: 50000 }, mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  /* ─── HISTORY ─── */
  describe('findAll', () => {
    it('should return paginated results', async () => {
      const items = [makeMockClosing({ status: CashDayStatus.CLOSED })];
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([items, 1]),
      };
      closingRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ page: 1, perPage: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  /* ─── YESTERDAY CHECK ─── */
  describe('isYesterdayClosed', () => {
    it('should return true if no register was opened yesterday', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      closingRepo.createQueryBuilder.mockReturnValue(qb);

      expect(await service.isYesterdayClosed()).toBe(true);
    });

    it('should return false if yesterday register is still OPEN', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(makeMockClosing({ status: CashDayStatus.OPEN })),
      };
      closingRepo.createQueryBuilder.mockReturnValue(qb);

      expect(await service.isYesterdayClosed()).toBe(false);
    });

    it('should return true if yesterday register is CLOSED', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(makeMockClosing({ status: CashDayStatus.CLOSED })),
      };
      closingRepo.createQueryBuilder.mockReturnValue(qb);

      expect(await service.isYesterdayClosed()).toBe(true);
    });
  });

  /* ─── REMINDER CRON ─── */
  describe('sendReminderIfNotClosed', () => {
    it('should publish reminder if register is open at reminder hour', async () => {
      // Mock current hour to be 18
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(18);
      closingRepo.findOne.mockResolvedValue(makeMockClosing());

      await service.sendReminderIfNotClosed();

      expect(eventsService.publish).toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should not publish if not the reminder hour', async () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);

      await service.sendReminderIfNotClosed();

      expect(eventsService.publish).not.toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it('should not publish if no register is open', async () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(18);
      closingRepo.findOne.mockResolvedValue(null);

      await service.sendReminderIfNotClosed();

      expect(eventsService.publish).not.toHaveBeenCalled();
      jest.restoreAllMocks();
    });
  });
});
