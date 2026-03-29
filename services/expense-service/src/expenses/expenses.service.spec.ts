import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { Expense } from '../entities/expense.entity';
import { ExpenseAttachment } from '../entities/expense-attachment.entity';
import { ExpenseApproval } from '../entities/expense-approval.entity';
import { ExpenseCategory } from '../entities/expense-category.entity';
import { ExpenseStatus, ApprovalStatus, PaymentMethod } from '../entities/enums';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../events/events.service';
import { BudgetsService } from '../budgets/budgets.service';

const createMockQb = (result?: any, countResult?: [any[], number]) => {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result || null),
    getMany: jest.fn().mockResolvedValue(countResult ? countResult[0] : []),
    getManyAndCount: jest.fn().mockResolvedValue(countResult || [[], 0]),
    getRawOne: jest.fn().mockResolvedValue({ count: '0', total: '0' }),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  return qb;
};

const mockRepo = (qb?: any) => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((e) => e),
  save: jest.fn((e) => Promise.resolve({ id: 'exp-1', ...e })),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(qb || createMockQb()),
});

const mockAudit = () => ({ log: jest.fn() });
const mockEvents = () => ({ publish: jest.fn() });
const mockBudgets = () => ({ consumeBudget: jest.fn() });

describe('ExpensesService', () => {
  let service: ExpensesService;
  let expenseRepo: ReturnType<typeof mockRepo>;
  let attachRepo: ReturnType<typeof mockRepo>;
  let approvalRepo: ReturnType<typeof mockRepo>;
  let catRepo: ReturnType<typeof mockRepo>;
  let audit: ReturnType<typeof mockAudit>;
  let events: ReturnType<typeof mockEvents>;
  let budgets: ReturnType<typeof mockBudgets>;

  beforeEach(async () => {
    const qb = createMockQb(null, [[], 0]);
    expenseRepo = mockRepo(qb);
    attachRepo = mockRepo();
    approvalRepo = mockRepo();
    catRepo = mockRepo();
    audit = mockAudit();
    events = mockEvents();
    budgets = mockBudgets();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: getRepositoryToken(Expense), useValue: expenseRepo },
        { provide: getRepositoryToken(ExpenseAttachment), useValue: attachRepo },
        { provide: getRepositoryToken(ExpenseApproval), useValue: approvalRepo },
        { provide: getRepositoryToken(ExpenseCategory), useValue: catRepo },
        { provide: AuditService, useValue: audit },
        { provide: EventsService, useValue: events },
        { provide: BudgetsService, useValue: budgets },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const qb = createMockQb(null, [[], 0]);
      expenseRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ page: 1, perPage: 10 });
      expect(result.data).toEqual([]);
      expect(result.meta.page).toBe(1);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return expense', async () => {
      const exp = {
        id: 'exp-1',
        reference: 'DEP-2024-00001',
        date: new Date(),
        amount: 100,
        status: ExpenseStatus.DRAFT,
        paymentMethod: PaymentMethod.CASH,
        categoryId: 'cat-1',
        createdById: 'user-1',
        category: { name: 'Test' },
        approvals: [],
        attachments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expenseRepo.findOne.mockResolvedValue(exp);

      const result = await service.findById('exp-1');
      expect(result.id).toBe('exp-1');
      expect(result.reference).toBe('DEP-2024-00001');
    });

    it('should throw NotFoundException if not found', async () => {
      expenseRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create expense with generated reference', async () => {
      catRepo.findOne.mockResolvedValue({ id: 'cat-1', name: 'Test' });

      const qb = createMockQb(null); // no last expense
      expenseRepo.createQueryBuilder.mockReturnValue(qb);
      expenseRepo.save.mockResolvedValue({ id: 'exp-1' });
      expenseRepo.findOne.mockResolvedValue({
        id: 'exp-1',
        reference: 'DEP-2024-00001',
        date: new Date(),
        amount: 500,
        status: ExpenseStatus.DRAFT,
        paymentMethod: PaymentMethod.CASH,
        category: { name: 'Test' },
        approvals: [],
        attachments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(
        {
          date: '2024-01-15',
          amount: 500,
          paymentMethod: PaymentMethod.CASH,
          categoryId: 'cat-1',
        },
        'user-1',
      );

      expect(expenseRepo.create).toHaveBeenCalled();
      expect(expenseRepo.save).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalled();
      expect(events.publish).toHaveBeenCalled();
    });

    it('should throw if category not found', async () => {
      catRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(
          { date: '2024-01-15', amount: 500, paymentMethod: PaymentMethod.CASH, categoryId: 'bad' },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update DRAFT expense', async () => {
      const exp = { id: 'exp-1', status: ExpenseStatus.DRAFT, amount: 100 };
      expenseRepo.findOne
        .mockResolvedValueOnce(exp) // update lookup
        .mockResolvedValueOnce({    // findById after update
          ...exp,
          amount: 200,
          category: { name: 'Test' },
          approvals: [],
          attachments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      const result = await service.update('exp-1', { amount: 200 }, 'user-1');
      expect(expenseRepo.save).toHaveBeenCalled();
    });

    it('should reject update on non-DRAFT', async () => {
      expenseRepo.findOne.mockResolvedValue({ id: 'exp-1', status: ExpenseStatus.PENDING });
      await expect(
        service.update('exp-1', { amount: 200 }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should soft-delete DRAFT expense', async () => {
      expenseRepo.findOne.mockResolvedValue({ id: 'exp-1', status: ExpenseStatus.DRAFT, reference: 'DEP', amount: 100 });
      await service.remove('exp-1', 'user-1');
      expect(expenseRepo.softDelete).toHaveBeenCalledWith('exp-1');
      expect(audit.log).toHaveBeenCalled();
    });

    it('should reject delete on non-DRAFT', async () => {
      expenseRepo.findOne.mockResolvedValue({ id: 'exp-1', status: ExpenseStatus.APPROVED_L1 });
      await expect(service.remove('exp-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('submit', () => {
    it('should change status from DRAFT to PENDING', async () => {
      const exp = { id: 'exp-1', status: ExpenseStatus.DRAFT };
      expenseRepo.findOne
        .mockResolvedValueOnce(exp)
        .mockResolvedValueOnce({
          ...exp,
          status: ExpenseStatus.PENDING,
          category: { name: 'Test' },
          approvals: [],
          attachments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      const result = await service.submit('exp-1', 'user-1');
      expect(expenseRepo.save).toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('should approve L1', async () => {
      const exp = {
        id: 'exp-1',
        reference: 'DEP-2024-00001',
        amount: 500,
        status: ExpenseStatus.PENDING,
        categoryId: 'cat-1',
        approvals: [],
      };
      expenseRepo.findOne
        .mockResolvedValueOnce(exp)
        .mockResolvedValueOnce({
          ...exp,
          status: ExpenseStatus.APPROVED_L1,
          category: { name: 'Test' },
          attachments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      await service.approve('exp-1', 1, { comment: 'ok' }, 'approver-1');
      expect(approvalRepo.create).toHaveBeenCalled();
      expect(approvalRepo.save).toHaveBeenCalled();
      expect(events.publish).toHaveBeenCalled();
    });

    it('should consume budget on L2 approval', async () => {
      const exp = {
        id: 'exp-1',
        reference: 'DEP-2024-00001',
        amount: 500,
        status: ExpenseStatus.APPROVED_L1,
        categoryId: 'cat-1',
        date: new Date(),
        approvals: [],
      };
      expenseRepo.findOne
        .mockResolvedValueOnce(exp)
        .mockResolvedValueOnce({
          ...exp,
          status: ExpenseStatus.APPROVED_L2,
          category: { name: 'Test' },
          attachments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      await service.approve('exp-1', 2, {}, 'approver-2');
      expect(budgets.consumeBudget).toHaveBeenCalledWith('cat-1', 500, exp.date);
    });
  });

  describe('reject', () => {
    it('should reject expense', async () => {
      expenseRepo.findOne
        .mockResolvedValueOnce({ id: 'exp-1', status: ExpenseStatus.PENDING })
        .mockResolvedValueOnce({
          id: 'exp-1',
          status: ExpenseStatus.REJECTED,
          category: { name: 'Test' },
          approvals: [],
          attachments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      await service.reject('exp-1', 1, { comment: 'no' }, 'approver-1');
      expect(approvalRepo.save).toHaveBeenCalled();
    });
  });

  describe('markPaid', () => {
    it('should mark as paid', async () => {
      expenseRepo.findOne
        .mockResolvedValueOnce({ id: 'exp-1', reference: 'DEP', amount: 500, status: ExpenseStatus.APPROVED_L2 })
        .mockResolvedValueOnce({
          id: 'exp-1',
          status: ExpenseStatus.PAID,
          category: { name: 'Test' },
          approvals: [],
          attachments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      await service.markPaid('exp-1', 'user-1');
      expect(events.publish).toHaveBeenCalled();
    });

    it('should reject if not APPROVED_L2', async () => {
      expenseRepo.findOne.mockResolvedValue({ id: 'exp-1', status: ExpenseStatus.PENDING });
      await expect(service.markPaid('exp-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });
});
