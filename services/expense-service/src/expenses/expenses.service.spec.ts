import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ExpensesService, WorkflowUser } from './expenses.service';
import { Expense } from '../entities/expense.entity';
import { ExpenseAttachment } from '../entities/expense-attachment.entity';
import { ExpenseApproval } from '../entities/expense-approval.entity';
import { ExpenseCategory } from '../entities/expense-category.entity';
import { ExpenseStatus, ApprovalStatus, PaymentMethod } from '../entities/enums';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { EventsService, ExpenseEvent } from '../events/events.service';
import { DataSource } from 'typeorm';

/* ─── Helpers ─── */

const createMockQb = (result?: unknown, countResult?: [unknown[], number]) => {
  const qb: Record<string, jest.Mock> = {
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

const mockRepo = (qb?: unknown) => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((e) => e),
  save: jest.fn((e) => Promise.resolve({ id: 'exp-1', ...e })),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(qb || createMockQb()),
});

const mockAudit = () => ({ log: jest.fn() });
const mockEvents = () => ({ publish: jest.fn() });
const mockDataSource = () => ({
  query: jest.fn().mockResolvedValue([{ max_disbursement_amount: 0 }]),
});

const mockConfig = () => ({
  get: jest.fn((key: string) => {
    const map: Record<string, unknown> = {
      'workflow.approvalThresholdL2': 500000,
      'workflow.l2Roles': ['DAF', 'ADMIN'],
      'workflow.cashierRole': 'CAISSIER_DEPENSES',
    };
    return map[key];
  }),
});

const makeUser = (overrides?: Partial<WorkflowUser>): WorkflowUser => ({
  id: 'user-1',
  email: 'user@test.com',
  roleName: 'CHEF_SERVICE',
  permissions: [],
  departmentId: 'dept-1',
  ...overrides,
});

const makeExpense = (overrides?: Partial<Expense>): Partial<Expense> => ({
  id: 'exp-1',
  reference: 'DEP-2024-00001',
  date: '2024-06-15',
  amount: 300000,
  status: ExpenseStatus.DRAFT,
  paymentMethod: PaymentMethod.CASH,
  categoryId: 'cat-1',
  createdById: 'creator-1',
  departmentId: 'dept-1',
  description: null,
  beneficiary: null,
  observations: null,
  costCenterId: null,
  projectId: null,
  approvals: [],
  attachments: [],
  category: { name: 'Fournitures' } as unknown as ExpenseCategory,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

/* ─── Test Suite ─── */

describe('ExpensesService', () => {
  let service: ExpensesService;
  let expenseRepo: ReturnType<typeof mockRepo>;
  let attachRepo: ReturnType<typeof mockRepo>;
  let approvalRepo: ReturnType<typeof mockRepo>;
  let catRepo: ReturnType<typeof mockRepo>;
  let audit: ReturnType<typeof mockAudit>;
  let events: ReturnType<typeof mockEvents>;
  let dataSource: ReturnType<typeof mockDataSource>;
  let config: ReturnType<typeof mockConfig>;

  beforeEach(async () => {
    const qb = createMockQb(null, [[], 0]);
    expenseRepo = mockRepo(qb);
    attachRepo = mockRepo();
    approvalRepo = mockRepo();
    catRepo = mockRepo();
    audit = mockAudit();
    events = mockEvents();
    dataSource = mockDataSource();
    config = mockConfig();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: getRepositoryToken(Expense), useValue: expenseRepo },
        { provide: getRepositoryToken(ExpenseAttachment), useValue: attachRepo },
        { provide: getRepositoryToken(ExpenseApproval), useValue: approvalRepo },
        { provide: getRepositoryToken(ExpenseCategory), useValue: catRepo },
        { provide: AuditService, useValue: audit },
        { provide: EventsService, useValue: events },
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /* ═══════════════════════════ findAll ═══════════════════════════ */

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

  /* ═══════════════════════════ findById ═══════════════════════════ */

  describe('findById', () => {
    it('should return expense', async () => {
      expenseRepo.findOne.mockResolvedValue(makeExpense());
      const result = await service.findById('exp-1');
      expect(result.id).toBe('exp-1');
      expect(result.reference).toBe('DEP-2024-00001');
    });

    it('should throw NotFoundException if not found', async () => {
      expenseRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('not-found')).rejects.toThrow(NotFoundException);
    });
  });

  /* ═══════════════════════════ create ═══════════════════════════ */

  describe('create', () => {
    it('should create expense with departmentId from user', async () => {
      catRepo.findOne.mockResolvedValue({ id: 'cat-1', name: 'Test' });
      const qb = createMockQb(null);
      expenseRepo.createQueryBuilder.mockReturnValue(qb);
      expenseRepo.save.mockResolvedValue({ id: 'exp-1' });
      expenseRepo.findOne.mockResolvedValue(makeExpense());

      const user = makeUser({ id: 'user-1', departmentId: 'dept-1' });
      await service.create(
        { date: '2024-01-15', amount: 500, paymentMethod: PaymentMethod.CASH, categoryId: 'cat-1' },
        user,
      );

      expect(expenseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdById: 'user-1', departmentId: 'dept-1' }),
      );
      expect(audit.log).toHaveBeenCalled();
      expect(events.publish).toHaveBeenCalledWith(ExpenseEvent.CREATED, expect.any(Object));
    });

    it('should throw if category not found', async () => {
      catRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(
          { date: '2024-01-15', amount: 500, paymentMethod: PaymentMethod.CASH, categoryId: 'bad' },
          makeUser(),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  /* ═══════════════════════════ update ═══════════════════════════ */

  describe('update', () => {
    it('should update DRAFT expense', async () => {
      const exp = makeExpense({ status: ExpenseStatus.DRAFT });
      expenseRepo.findOne
        .mockResolvedValueOnce(exp)
        .mockResolvedValueOnce({ ...exp, amount: 200 });

      await service.update('exp-1', { amount: 200 }, 'user-1');
      expect(expenseRepo.save).toHaveBeenCalled();
    });

    it('should reject update on non-DRAFT', async () => {
      expenseRepo.findOne.mockResolvedValue(makeExpense({ status: ExpenseStatus.PENDING }));
      await expect(service.update('exp-1', { amount: 200 }, 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  /* ═══════════════════════════ remove ═══════════════════════════ */

  describe('remove', () => {
    it('should soft-delete DRAFT expense', async () => {
      expenseRepo.findOne.mockResolvedValue(makeExpense({ status: ExpenseStatus.DRAFT }));
      await service.remove('exp-1', 'user-1');
      expect(expenseRepo.softDelete).toHaveBeenCalledWith('exp-1');
    });

    it('should reject delete on non-DRAFT', async () => {
      expenseRepo.findOne.mockResolvedValue(makeExpense({ status: ExpenseStatus.APPROVED_L1 }));
      await expect(service.remove('exp-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  /* ═══════════════════════════ submit ═══════════════════════════ */

  describe('submit', () => {
    it('should change status DRAFT → PENDING', async () => {
      const exp = makeExpense({ status: ExpenseStatus.DRAFT, createdById: 'user-1' });
      expenseRepo.findOne
        .mockResolvedValueOnce(exp)
        .mockResolvedValueOnce({ ...exp, status: ExpenseStatus.PENDING });

      await service.submit('exp-1', 'user-1');
      expect(expenseRepo.save).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.SUBMIT }));
      expect(events.publish).toHaveBeenCalledWith(ExpenseEvent.SUBMITTED, expect.any(Object));
    });

    it('should reject if not DRAFT', async () => {
      expenseRepo.findOne.mockResolvedValue(makeExpense({ status: ExpenseStatus.PENDING }));
      await expect(service.submit('exp-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject if submitter is not the creator', async () => {
      expenseRepo.findOne.mockResolvedValue(makeExpense({ status: ExpenseStatus.DRAFT, createdById: 'other-user' }));
      await expect(service.submit('exp-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  /* ═══════════════════════════ approve ═══════════════════════════ */

  describe('approve', () => {
    /* ── L1 approval ── */

    it('should approve L1 when PENDING + same department', async () => {
      const exp = makeExpense({
        status: ExpenseStatus.PENDING,
        amount: 600000,
        departmentId: 'dept-1',
      });
      expenseRepo.findOne
        .mockResolvedValueOnce(exp) // approve lookup
        .mockResolvedValueOnce({ ...exp, status: ExpenseStatus.APPROVED_L1 }); // findById

      const user = makeUser({ id: 'approver-1', departmentId: 'dept-1' });
      await service.approve('exp-1', { comment: 'ok' }, user);

      expect(approvalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ level: 1, status: ApprovalStatus.APPROVED }),
      );
      expect(approvalRepo.save).toHaveBeenCalledTimes(1);
      expect(events.publish).toHaveBeenCalledWith(
        ExpenseEvent.APPROVED,
        expect.objectContaining({ level: 1 }),
      );
    });

    it('should auto-approve L2 when amount ≤ threshold', async () => {
      const exp = makeExpense({
        status: ExpenseStatus.PENDING,
        amount: 300000,
        departmentId: 'dept-1',
      });
      expenseRepo.findOne
        .mockResolvedValueOnce(exp)
        .mockResolvedValueOnce({ ...exp, status: ExpenseStatus.APPROVED_L2 });

      const user = makeUser({ id: 'approver-1', departmentId: 'dept-1' });
      await service.approve('exp-1', {}, user);

      // Should create 2 approval records (L1 + auto-L2)
      expect(approvalRepo.save).toHaveBeenCalledTimes(2);
      expect(events.publish).toHaveBeenCalledWith(
        ExpenseEvent.APPROVED,
        expect.objectContaining({ level: 2, autoL2: true }),
      );
    });

    it('should reject self-approval', async () => {
      const exp = makeExpense({ status: ExpenseStatus.PENDING, createdById: 'user-1' });
      expenseRepo.findOne.mockResolvedValue(exp);

      const user = makeUser({ id: 'user-1' }); // same as creator
      await expect(service.approve('exp-1', {}, user)).rejects.toThrow(ForbiddenException);
    });

    it('should reject L1 if approver is in a different department', async () => {
      const exp = makeExpense({ status: ExpenseStatus.PENDING, departmentId: 'dept-1' });
      expenseRepo.findOne.mockResolvedValue(exp);

      const user = makeUser({ id: 'approver-1', departmentId: 'dept-OTHER' });
      await expect(service.approve('exp-1', {}, user)).rejects.toThrow(ForbiddenException);
    });

    it('should reject L1 if approver has no department', async () => {
      const exp = makeExpense({ status: ExpenseStatus.PENDING, departmentId: 'dept-1' });
      expenseRepo.findOne.mockResolvedValue(exp);

      const user = makeUser({ id: 'approver-1', departmentId: null });
      await expect(service.approve('exp-1', {}, user)).rejects.toThrow(ForbiddenException);
    });

    /* ── L2 approval ── */

    it('should approve L2 when APPROVED_L1 + DAF role + budget OK', async () => {
      const exp = makeExpense({ status: ExpenseStatus.APPROVED_L1, amount: 800000 });
      expenseRepo.findOne
        .mockResolvedValueOnce(exp)
        .mockResolvedValueOnce({ ...exp, status: ExpenseStatus.APPROVED_L2 });

      const user = makeUser({ id: 'daf-1', roleName: 'DAF', departmentId: 'dept-finance' });
      await service.approve('exp-1', { comment: 'approved by DAF' }, user);

      expect(approvalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ level: 2, status: ApprovalStatus.APPROVED }),
      );
    });

    it('should reject L2 if user role is not in l2Roles', async () => {
      const exp = makeExpense({ status: ExpenseStatus.APPROVED_L1 });
      expenseRepo.findOne.mockResolvedValue(exp);

      const user = makeUser({ id: 'random-1', roleName: 'CHEF_SERVICE' });
      await expect(service.approve('exp-1', {}, user)).rejects.toThrow(ForbiddenException);
    });



    it('should reject self-approval at L2', async () => {
      const exp = makeExpense({ status: ExpenseStatus.APPROVED_L1, createdById: 'daf-1' });
      expenseRepo.findOne.mockResolvedValue(exp);

      const user = makeUser({ id: 'daf-1', roleName: 'DAF' });
      await expect(service.approve('exp-1', {}, user)).rejects.toThrow(ForbiddenException);
    });

    /* ── Invalid status ── */

    it('should reject approval on invalid status', async () => {
      expenseRepo.findOne.mockResolvedValue(makeExpense({ status: ExpenseStatus.PAID }));
      await expect(
        service.approve('exp-1', {}, makeUser({ id: 'approver-1' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for unknown expense', async () => {
      expenseRepo.findOne.mockResolvedValue(null);
      await expect(
        service.approve('exp-999', {}, makeUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  /* ═══════════════════════════ reject ═══════════════════════════ */

  describe('reject', () => {
    it('should reject a PENDING expense at L1 (same dept)', async () => {
      const exp = makeExpense({ status: ExpenseStatus.PENDING, departmentId: 'dept-1' });
      expenseRepo.findOne
        .mockResolvedValueOnce(exp)
        .mockResolvedValueOnce({ ...exp, status: ExpenseStatus.REJECTED });

      const user = makeUser({ id: 'approver-1', departmentId: 'dept-1' });
      await service.reject('exp-1', { comment: 'Missing receipt' }, user);

      expect(approvalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ level: 1, status: ApprovalStatus.REJECTED, comment: 'Missing receipt' }),
      );
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.REJECT }));
      expect(events.publish).toHaveBeenCalledWith(
        ExpenseEvent.REJECTED,
        expect.objectContaining({ level: 1 }),
      );
    });

    it('should reject an APPROVED_L1 expense at L2 (DAF role)', async () => {
      const exp = makeExpense({ status: ExpenseStatus.APPROVED_L1 });
      expenseRepo.findOne
        .mockResolvedValueOnce(exp)
        .mockResolvedValueOnce({ ...exp, status: ExpenseStatus.REJECTED });

      const user = makeUser({ id: 'daf-1', roleName: 'DAF' });
      await service.reject('exp-1', { comment: 'Budget exceeded' }, user);

      expect(approvalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ level: 2, status: ApprovalStatus.REJECTED }),
      );
    });

    it('should forbid self-rejection', async () => {
      const exp = makeExpense({ status: ExpenseStatus.PENDING, createdById: 'user-1' });
      expenseRepo.findOne.mockResolvedValue(exp);

      const user = makeUser({ id: 'user-1' });
      await expect(service.reject('exp-1', { comment: 'x' }, user)).rejects.toThrow(ForbiddenException);
    });

    it('should forbid L1 rejection from wrong department', async () => {
      const exp = makeExpense({ status: ExpenseStatus.PENDING, departmentId: 'dept-1' });
      expenseRepo.findOne.mockResolvedValue(exp);

      const user = makeUser({ id: 'approver-1', departmentId: 'dept-OTHER' });
      await expect(service.reject('exp-1', { comment: 'x' }, user)).rejects.toThrow(ForbiddenException);
    });

    it('should forbid L2 rejection without correct role', async () => {
      const exp = makeExpense({ status: ExpenseStatus.APPROVED_L1 });
      expenseRepo.findOne.mockResolvedValue(exp);

      const user = makeUser({ id: 'random-1', roleName: 'CHEF_SERVICE' });
      await expect(service.reject('exp-1', { comment: 'x' }, user)).rejects.toThrow(ForbiddenException);
    });

    it('should reject if status is not PENDING or APPROVED_L1', async () => {
      expenseRepo.findOne.mockResolvedValue(makeExpense({ status: ExpenseStatus.PAID }));
      await expect(
        service.reject('exp-1', { comment: 'x' }, makeUser({ id: 'approver-1' })),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ═══════════════════════════ markPaid ═══════════════════════════ */

  describe('markPaid', () => {
    it('should mark APPROVED_L2 as PAID when cashier role', async () => {
      const exp = makeExpense({ status: ExpenseStatus.APPROVED_L2 });
      expenseRepo.findOne
        .mockResolvedValueOnce(exp)
        .mockResolvedValueOnce({ ...exp, status: ExpenseStatus.PAID });

      const user = makeUser({ id: 'cashier-1', roleName: 'CAISSIER_DEPENSES' });
      await service.markPaid('exp-1', user);

      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.PAY }));
      expect(events.publish).toHaveBeenCalledWith(ExpenseEvent.PAID, expect.any(Object));
    });

    it('should reject if not APPROVED_L2', async () => {
      expenseRepo.findOne.mockResolvedValue(makeExpense({ status: ExpenseStatus.PENDING }));
      await expect(
        service.markPaid('exp-1', makeUser({ roleName: 'CAISSIER_DEPENSES' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if user is not cashier', async () => {
      expenseRepo.findOne.mockResolvedValue(makeExpense({ status: ExpenseStatus.APPROVED_L2 }));

      const user = makeUser({ id: 'random-1', roleName: 'CHEF_SERVICE' });
      await expect(service.markPaid('exp-1', user)).rejects.toThrow(ForbiddenException);
    });
  });

  /* ═══════════════════════════ cancel ═══════════════════════════ */

  describe('cancel', () => {
    it('should cancel a PAID expense with reason', async () => {
      const exp = makeExpense({ status: ExpenseStatus.PAID });
      expenseRepo.findOne
        .mockResolvedValueOnce(exp)
        .mockResolvedValueOnce({ ...exp, status: ExpenseStatus.CANCELLED });

      await service.cancel('exp-1', { reason: 'Duplicate payment' }, 'user-1');

      expect(expenseRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: ExpenseStatus.CANCELLED }));
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CANCEL,
          newValue: expect.objectContaining({ reason: 'Duplicate payment' }),
        }),
      );
      expect(events.publish).toHaveBeenCalledWith(
        ExpenseEvent.CANCELLED,
        expect.objectContaining({ reason: 'Duplicate payment' }),
      );
    });

    it('should reject cancel if not PAID', async () => {
      expenseRepo.findOne.mockResolvedValue(makeExpense({ status: ExpenseStatus.APPROVED_L2 }));
      await expect(
        service.cancel('exp-1', { reason: 'test' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for unknown expense', async () => {
      expenseRepo.findOne.mockResolvedValue(null);
      await expect(
        service.cancel('exp-999', { reason: 'test' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  /* ═══════════════════════════ Full Workflow Integration ═══════════════════════════ */

  describe('full workflow — high-amount path (L1 → L2 → PAID)', () => {
    it('should follow DRAFT → PENDING → APPROVED_L1 → APPROVED_L2 → PAID', async () => {
      // 1. Submit
      const draft = makeExpense({ status: ExpenseStatus.DRAFT, createdById: 'creator-1', amount: 800000 });
      expenseRepo.findOne
        .mockResolvedValueOnce(draft)
        .mockResolvedValueOnce({ ...draft, status: ExpenseStatus.PENDING });
      await service.submit('exp-1', 'creator-1');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.SUBMIT }));

      // 2. Approve L1
      const pending = makeExpense({ status: ExpenseStatus.PENDING, amount: 800000, departmentId: 'dept-1' });
      expenseRepo.findOne
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce({ ...pending, status: ExpenseStatus.APPROVED_L1 });
      const l1User = makeUser({ id: 'manager-1', departmentId: 'dept-1' });
      await service.approve('exp-1', { comment: 'L1 ok' }, l1User);
      expect(approvalRepo.save).toHaveBeenCalled();

      // 3. Approve L2
      const l1Approved = makeExpense({ status: ExpenseStatus.APPROVED_L1, amount: 800000 });
      expenseRepo.findOne
        .mockResolvedValueOnce(l1Approved)
        .mockResolvedValueOnce({ ...l1Approved, status: ExpenseStatus.APPROVED_L2 });
      const l2User = makeUser({ id: 'daf-1', roleName: 'DAF' });
      await service.approve('exp-1', { comment: 'L2 ok' }, l2User);
      // 4. Pay
      const l2Approved = makeExpense({ status: ExpenseStatus.APPROVED_L2 });
      expenseRepo.findOne
        .mockResolvedValueOnce(l2Approved)
        .mockResolvedValueOnce({ ...l2Approved, status: ExpenseStatus.PAID });
      const cashier = makeUser({ id: 'cashier-1', roleName: 'CAISSIER_DEPENSES' });
      await service.markPaid('exp-1', cashier);
      expect(events.publish).toHaveBeenCalledWith(ExpenseEvent.PAID, expect.any(Object));
    });
  });

  describe('full workflow — low-amount path (auto-L2)', () => {
    it('should follow DRAFT → PENDING → APPROVED_L2 (auto) → PAID', async () => {
      // 1. Submit
      const draft = makeExpense({ status: ExpenseStatus.DRAFT, createdById: 'creator-1', amount: 200000 });
      expenseRepo.findOne
        .mockResolvedValueOnce(draft)
        .mockResolvedValueOnce({ ...draft, status: ExpenseStatus.PENDING });
      await service.submit('exp-1', 'creator-1');

      // 2. Approve L1 (auto-skip L2)
      const pending = makeExpense({ status: ExpenseStatus.PENDING, amount: 200000, departmentId: 'dept-1' });
      expenseRepo.findOne
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce({ ...pending, status: ExpenseStatus.APPROVED_L2 });
      const l1User = makeUser({ id: 'manager-1', departmentId: 'dept-1' });
      await service.approve('exp-1', {}, l1User);
      // L2 auto-approved → 2 approval saves
      expect(approvalRepo.save).toHaveBeenCalledTimes(2);
      // 3. Pay
      const approved = makeExpense({ status: ExpenseStatus.APPROVED_L2 });
      expenseRepo.findOne
        .mockResolvedValueOnce(approved)
        .mockResolvedValueOnce({ ...approved, status: ExpenseStatus.PAID });
      const cashier = makeUser({ id: 'cashier-1', roleName: 'CAISSIER_DEPENSES' });
      await service.markPaid('exp-1', cashier);
      expect(events.publish).toHaveBeenCalledWith(ExpenseEvent.PAID, expect.any(Object));
    });
  });
});
