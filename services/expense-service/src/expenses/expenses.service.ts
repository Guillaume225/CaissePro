import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SelectQueryBuilder } from 'typeorm';
import { Expense } from '../entities/expense.entity';
import { ExpenseAttachment } from '../entities/expense-attachment.entity';
import { ExpenseApproval } from '../entities/expense-approval.entity';
import { ExpenseCategory } from '../entities/expense-category.entity';
import {
  ExpenseStatus,
  ApprovalStatus,
  CashDayStatus,
  CashType,
  DisbursementRequestStatus,
} from '../entities/enums';
import { DisbursementRequest } from '../entities/disbursement-request.entity';
import { CashDay } from '../entities/cash-day.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { EventsService, ExpenseEvent } from '../events/events.service';
import { TenantDataSourceService, tenantSchema } from '../tenant/tenant-datasource.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  ApproveExpenseDto,
  RejectExpenseDto,
  CancelExpenseDto,
  ListExpensesQueryDto,
} from './dto';

/** Shape produced by JwtStrategy.validate() */
export interface WorkflowUser {
  id: string;
  email: string;
  roleName: string;
  permissions: string[];
  tenantId: string;
  departmentId: string | null;
}

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly tenantDsService: TenantDataSourceService,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) {}

  /* ─── Reference generation: DEP-YYYY-NNNNN ─── */
  private async generateReference(tenantId: string): Promise<string> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const expenseRepo = ds.getRepository(Expense);
    const year = new Date().getFullYear();
    const prefix = `DEP-${year}-`;

    const result = await expenseRepo
      .createQueryBuilder('e')
      .select('MAX(CAST(RIGHT(e.reference, 5) AS INT))', 'maxSeq')
      .where('e.reference LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('LEN(e.reference) = :len', { len: prefix.length + 5 })
      .getRawOne();

    const seq = (result?.maxSeq ?? 0) + 1;
    return `${prefix}${String(seq).padStart(5, '0')}`;
  }

  /* ─── FindAll with advanced filters ─── */
  async findAll(tenantId: string, query: ListExpensesQueryDto) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const expenseRepo = ds.getRepository(Expense);

    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);

    const qb = expenseRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.category', 'cat')
      .leftJoinAndSelect('e.cashDay', 'cashDay')
      .leftJoinAndSelect('e.approvals', 'approvals')
      .leftJoin('approvals.approver', 'approver')
      .addSelect(['approver.id', 'approver.firstName', 'approver.lastName'])
      .leftJoin('e.createdBy', 'creator')
      .addSelect(['creator.id', 'creator.firstName', 'creator.lastName'])
      .leftJoinAndSelect('e.attachments', 'attachments');

    this.applyFilters(qb, query);

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'DESC';
    const allowedSort = ['date', 'amount', 'reference', 'status', 'createdAt'];
    const sortField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(`e.${sortField}`, sortOrder);

    qb.skip((page - 1) * perPage).take(perPage);
    const [items, total] = await qb.getManyAndCount();

    return {
      data: items.map((e) => this.toResponseDto(e)),
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
        hasNextPage: page * perPage < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  /* ─── FindById ─── */
  async findById(tenantId: string, id: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const expense = await ds.getRepository(Expense)
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.category', 'cat')
      .leftJoinAndSelect('e.cashDay', 'cashDay')
      .leftJoinAndSelect('e.approvals', 'approvals')
      .leftJoin('approvals.approver', 'approver')
      .addSelect(['approver.id', 'approver.firstName', 'approver.lastName'])
      .leftJoin('e.createdBy', 'creator')
      .addSelect(['creator.id', 'creator.firstName', 'creator.lastName'])
      .leftJoinAndSelect('e.attachments', 'attachments')
      .where('e.id = :id', { id })
      .getOne();
    if (!expense) throw new NotFoundException('Expense not found');
    return this.toResponseDto(expense);
  }

  /* ─── Create ─── */
  async create(tenantId: string, dto: CreateExpenseDto, user: WorkflowUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const expenseRepo = ds.getRepository(Expense);
    const catRepo = ds.getRepository(ExpenseCategory);
    const cashDayRepo = ds.getRepository(CashDay);

    const cat = await catRepo.findOne({ where: { id: dto.categoryId } });
    if (!cat) throw new NotFoundException('Category not found');

    const reference = await this.generateReference(tenantId);

    // Find open EXPENSE cash day to link the expense
    const openCashDay = await cashDayRepo.findOne({
      where: { cashType: CashType.EXPENSE, status: CashDayStatus.OPEN },
      order: { openedAt: 'DESC' },
    });

    const expense = expenseRepo.create({
      reference,
      date: dto.date,
      amount: dto.amount,
      description: dto.description || null,
      beneficiary: dto.beneficiary || null,
      paymentMethod: dto.paymentMethod,
      categoryId: dto.categoryId,
      createdById: user.id,
      departmentId: user.departmentId || null,
      observations: dto.observations || null,
      costCenterId: dto.costCenterId || null,
      projectId: dto.projectId || null,
      disbursementRequestId: dto.disbursementRequestId || null,
      status: ExpenseStatus.DRAFT,
      cashDayId: openCashDay?.id || null,
    });

    const saved = await expenseRepo.save(expense);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.CREATE,
      entityType: 'expense',
      entityId: saved.id,
      newValue: { reference, amount: dto.amount, categoryId: dto.categoryId },
    });

    await this.eventsService.publish(ExpenseEvent.CREATED, {
      expenseId: saved.id,
      reference,
      amount: dto.amount,
      createdById: user.id,
    });

    return this.findById(tenantId, saved.id);
  }

  /* ─── Update (only DRAFT) ─── */
  async update(tenantId: string, id: string, dto: UpdateExpenseDto, userId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const expenseRepo = ds.getRepository(Expense);
    const catRepo = ds.getRepository(ExpenseCategory);

    const expense = await expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    if (expense.status !== ExpenseStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT expenses can be updated');
    }

    if (dto.categoryId) {
      const cat = await catRepo.findOne({ where: { id: dto.categoryId } });
      if (!cat) throw new NotFoundException('Category not found');
    }

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    for (const key of Object.keys(dto) as (keyof UpdateExpenseDto)[]) {
      if (dto[key] !== undefined) {
        oldValue[key] = (expense as unknown as Record<string, unknown>)[key];
        newValue[key] = dto[key];
      }
    }

    Object.assign(expense, dto);
    await expenseRepo.save(expense);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'expense',
      entityId: id,
      oldValue,
      newValue,
    });

    return this.findById(tenantId, id);
  }

  /* ─── Soft Delete (only DRAFT) ─── */
  async remove(tenantId: string, id: string, userId: string): Promise<void> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const expenseRepo = ds.getRepository(Expense);
    const expense = await expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    if (expense.status !== ExpenseStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT expenses can be deleted');
    }

    await expenseRepo.softDelete(id);

    await this.auditService.log({
      userId,
      action: AuditAction.DELETE,
      entityType: 'expense',
      entityId: id,
      oldValue: { reference: expense.reference, amount: expense.amount },
    });
  }

  /* ─── Submit for approval ─── */
  async submit(tenantId: string, id: string, userId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const expenseRepo = ds.getRepository(Expense);
    const expense = await expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.status !== ExpenseStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT expenses can be submitted');
    }
    if (expense.createdById !== userId) {
      throw new ForbiddenException('Only the creator can submit an expense');
    }

    expense.status = ExpenseStatus.PENDING;
    await expenseRepo.save(expense);

    // ── Create approval records from the matching approval circuit ──
    await this.createApprovalRecordsFromCircuit(tenantId, expense);

    await this.auditService.log({
      userId,
      action: AuditAction.SUBMIT,
      entityType: 'expense',
      entityId: id,
      oldValue: { status: ExpenseStatus.DRAFT },
      newValue: { status: ExpenseStatus.PENDING },
    });

    await this.eventsService.publish(ExpenseEvent.SUBMITTED, {
      expenseId: id,
      reference: expense.reference,
      amount: Number(expense.amount),
      createdById: expense.createdById,
    });

    return this.findById(tenantId, id);
  }

  /**
   * Finds the active approval circuit whose amount range covers the expense,
   * fetches its steps, and creates PENDING ExpenseApproval records for each step.
   * If no circuit matches, creates a single L1 PENDING approval without a
   * pre-assigned approver so any authorised user can approve it.
   */
  private async createApprovalRecordsFromCircuit(tenantId: string, expense: Expense): Promise<void> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const schema = tenantSchema(tenantId);
    const approvalRepo = ds.getRepository(ExpenseApproval);
    const amount = Number(expense.amount);

    // Find matching circuit by amount range
    const circuitRows: { id: string }[] = await ds.query(
      `SELECT TOP 1 id
         FROM [${schema}].[approval_circuits]
        WHERE is_active = 1
          AND min_amount <= @0
          AND (max_amount IS NULL OR max_amount >= @0)
        ORDER BY min_amount DESC`,
      [amount],
    );
    const circuit = circuitRows[0];

    if (circuit) {
      // Fetch all steps for this circuit, ordered by level
      const steps: { level: number; role: string; approver_id: string | null }[] =
        await ds.query(
          `SELECT level, role, approver_id
             FROM [${schema}].[approval_circuit_steps]
            WHERE circuit_id = @0
            ORDER BY level ASC`,
          [circuit.id],
        );

      if (steps.length > 0) {
        for (const step of steps) {
          const approval = approvalRepo.create({
            expenseId: expense.id,
            approverId: step.approver_id ?? expense.createdById, // fallback; will be replaced on actual approve
            level: step.level,
            status: ApprovalStatus.PENDING,
            comment: null,
            approvedAt: null,
          });
          await approvalRepo.save(approval);
        }
        this.logger.log(
          `Created ${steps.length} approval step(s) for expense ${expense.reference} (circuit: ${circuit.id})`,
        );
        return;
      }
    }

    // Fallback: no circuit found or circuit has no steps — create a generic L1 pending approval
    this.logger.warn(
      `No approval circuit found for expense ${expense.reference} (amount=${amount}). Creating default L1 approval.`,
    );
    const fallbackApproval = approvalRepo.create({
      expenseId: expense.id,
      approverId: expense.createdById, // placeholder; any authorised user can approve
      level: 1,
      status: ApprovalStatus.PENDING,
      comment: null,
      approvedAt: null,
    });
    await approvalRepo.save(fallbackApproval);
  }

  /* ─── Approve (level auto-detected from expense status) ─── */
  async approve(tenantId: string, id: string, dto: ApproveExpenseDto, user: WorkflowUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const expense = await ds.getRepository(Expense).findOne({ where: { id }, relations: ['approvals'] });
    if (!expense) throw new NotFoundException('Expense not found');

    if (user.id === expense.createdById) {
      throw new ForbiddenException('You cannot approve your own expense');
    }

    const threshold = this.configService.get<number>('workflow.approvalThresholdL2') ?? 500000;
    const l2Roles: string[] = this.configService.get<string[]>('workflow.l2Roles') ?? [
      'DAF',
      'ADMIN',
    ];

    if (expense.status === ExpenseStatus.PENDING) {
      return this.approveL1(tenantId, expense, dto, user, threshold);
    }
    if (expense.status === ExpenseStatus.APPROVED_L1) {
      return this.approveL2(tenantId, expense, dto, user, l2Roles);
    }

    throw new BadRequestException('Expense must be in PENDING or APPROVED_L1 status for approval');
  }

  /* ── L1 internal ── */
  private async approveL1(
    tenantId: string,
    expense: Expense,
    dto: ApproveExpenseDto,
    user: WorkflowUser,
    threshold: number,
  ) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const expenseRepo = ds.getRepository(Expense);

    // If both have departments assigned, they must match
    const bothHaveDept = user.departmentId && expense.departmentId;
    if (bothHaveDept && user.departmentId !== expense.departmentId) {
      throw new ForbiddenException('L1 approver must belong to the same department as the expense');
    }

    await this.upsertApproval(tenantId, {
      expenseId: expense.id,
      approverId: user.id,
      level: 1,
      status: ApprovalStatus.APPROVED,
      comment: dto.comment || null,
      approvedAt: new Date(),
    });

    const amount = Number(expense.amount);
    const autoL2 = amount <= threshold;

    if (autoL2) {
      // Amount below threshold → auto-approve L2
      await this.upsertApproval(tenantId, {
        expenseId: expense.id,
        approverId: user.id,
        level: 2,
        status: ApprovalStatus.APPROVED,
        comment: `Auto-approved: amount (${amount} FCFA) below threshold (${threshold} FCFA)`,
        approvedAt: new Date(),
      });

      expense.status = ExpenseStatus.APPROVED_L2;
      await expenseRepo.save(expense);

      await this.auditService.log({
        userId: user.id,
        action: AuditAction.APPROVE,
        entityType: 'expense',
        entityId: expense.id,
        newValue: {
          level: 1,
          autoL2: true,
          status: ExpenseStatus.APPROVED_L2,
          comment: dto.comment,
        },
      });

      await this.eventsService.publish(ExpenseEvent.APPROVED, {
        expenseId: expense.id,
        reference: expense.reference,
        amount,
        level: 2,
        approverId: user.id,
        autoL2: true,
      });
    } else {
      expense.status = ExpenseStatus.APPROVED_L1;
      await expenseRepo.save(expense);

      await this.auditService.log({
        userId: user.id,
        action: AuditAction.APPROVE,
        entityType: 'expense',
        entityId: expense.id,
        newValue: { level: 1, status: ExpenseStatus.APPROVED_L1, comment: dto.comment },
      });

      await this.eventsService.publish(ExpenseEvent.APPROVED, {
        expenseId: expense.id,
        reference: expense.reference,
        amount,
        level: 1,
        approverId: user.id,
      });
    }

    return this.findById(tenantId, expense.id);
  }

  /* ── L2 internal ── */
  private async approveL2(
    tenantId: string,
    expense: Expense,
    dto: ApproveExpenseDto,
    user: WorkflowUser,
    l2Roles: string[],
  ) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const expenseRepo = ds.getRepository(Expense);

    if (!l2Roles.includes(user.roleName)) {
      throw new ForbiddenException(
        `L2 approval requires one of the following roles: ${l2Roles.join(', ')}`,
      );
    }

    const amount = Number(expense.amount);

    await this.upsertApproval(tenantId, {
      expenseId: expense.id,
      approverId: user.id,
      level: 2,
      status: ApprovalStatus.APPROVED,
      comment: dto.comment || null,
      approvedAt: new Date(),
    });

    expense.status = ExpenseStatus.APPROVED_L2;
    await expenseRepo.save(expense);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.APPROVE,
      entityType: 'expense',
      entityId: expense.id,
      newValue: { level: 2, status: ExpenseStatus.APPROVED_L2, comment: dto.comment },
    });

    await this.eventsService.publish(ExpenseEvent.APPROVED, {
      expenseId: expense.id,
      reference: expense.reference,
      amount,
      level: 2,
      approverId: user.id,
    });

    return this.findById(tenantId, expense.id);
  }

  /* ─── Reject (level auto-detected from expense status) ─── */
  async reject(tenantId: string, id: string, dto: RejectExpenseDto, user: WorkflowUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const expenseRepo = ds.getRepository(Expense);
    const expense = await expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    if (user.id === expense.createdById) {
      throw new ForbiddenException('You cannot reject your own expense');
    }

    let level: number;

    if (expense.status === ExpenseStatus.PENDING) {
      level = 1;
      if (!user.departmentId || user.departmentId !== expense.departmentId) {
        throw new ForbiddenException(
          'L1 rejector must belong to the same department as the expense',
        );
      }
    } else if (expense.status === ExpenseStatus.APPROVED_L1) {
      level = 2;
      const l2Roles: string[] = this.configService.get<string[]>('workflow.l2Roles') ?? [
        'DAF',
        'ADMIN',
      ];
      if (!l2Roles.includes(user.roleName)) {
        throw new ForbiddenException(
          `L2 rejection requires one of the following roles: ${l2Roles.join(', ')}`,
        );
      }
    } else {
      throw new BadRequestException('Only PENDING or APPROVED_L1 expenses can be rejected');
    }

    await this.upsertApproval(tenantId, {
      expenseId: id,
      approverId: user.id,
      level,
      status: ApprovalStatus.REJECTED,
      comment: dto.comment,
      approvedAt: new Date(),
    });

    expense.status = ExpenseStatus.REJECTED;
    await expenseRepo.save(expense);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.REJECT,
      entityType: 'expense',
      entityId: id,
      newValue: { level, status: ExpenseStatus.REJECTED, comment: dto.comment },
    });

    await this.eventsService.publish(ExpenseEvent.REJECTED, {
      expenseId: id,
      reference: expense.reference,
      amount: Number(expense.amount),
      level,
      rejectedBy: user.id,
    });

    return this.findById(tenantId, id);
  }

  /* ─── Mark as Paid ─── */
  async markPaid(tenantId: string, id: string, user: WorkflowUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const expenseRepo = ds.getRepository(Expense);
    const cashDayRepo = ds.getRepository(CashDay);
    const disbursementRequestRepo = ds.getRepository(DisbursementRequest);

    const expense = await expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    if (expense.status !== ExpenseStatus.APPROVED_L2) {
      const statusMessages: Record<string, string> = {
        DRAFT: 'Cette pièce est encore en brouillon. Elle doit être soumise puis validée.',
        PENDING: 'Cette pièce est en attente de soumission.',
        APPROVED_L1:
          'Cette pièce est en cours de validation (niveau 1 validé). Elle doit encore être approuvée au niveau 2 avant paiement.',
        PAID: 'Cette pièce a déjà été payée.',
        REJECTED: 'Cette pièce a été rejetée et ne peut pas être payée.',
        CANCELLED: 'Cette pièce a été annulée.',
      };
      const msg =
        statusMessages[expense.status] ??
        `Statut actuel : ${expense.status}. Seules les pièces approuvées (N2) peuvent être payées.`;
      throw new BadRequestException(msg);
    }

    // The @Permissions(EXPENSE_PERMISSIONS.PAY) guard already ensures the user
    // has the 'expense.pay' permission, so no additional role check is needed.

    const amount = Number(expense.amount);
    const schema = tenantSchema(tenantId);
    const [company] = await ds.query(
      `SELECT TOP 1 max_disbursement_amount FROM [${schema}].[companies]`,
    );
    const maxDisbursement = Number(company?.max_disbursement_amount ?? 0);
    if (maxDisbursement > 0 && amount > maxDisbursement) {
      throw new BadRequestException(
        `Le montant (${amount} FCFA) dépasse la limite autorisée de décaissement (${maxDisbursement} FCFA).`,
      );
    }

    expense.status = ExpenseStatus.PAID;

    // Link expense to current open EXPENSE cash day
    const openCashDay = await cashDayRepo.findOne({
      where: { status: CashDayStatus.OPEN, cashType: CashType.EXPENSE },
    });
    if (openCashDay) {
      expense.cashDayId = openCashDay.id;
    }

    await expenseRepo.save(expense);

    // Update linked disbursement request to VALIDATED
    if (expense.disbursementRequestId) {
      const dr = await disbursementRequestRepo.findOne({
        where: { id: expense.disbursementRequestId },
      });
      if (dr && dr.status === DisbursementRequestStatus.VALIDATING) {
        dr.status = DisbursementRequestStatus.VALIDATED;
        await disbursementRequestRepo.save(dr);
      }
    }

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.PAY,
      entityType: 'expense',
      entityId: id,
      oldValue: { status: ExpenseStatus.APPROVED_L2 },
      newValue: { status: ExpenseStatus.PAID },
    });

    await this.eventsService.publish(ExpenseEvent.PAID, {
      expenseId: id,
      reference: expense.reference,
      amount: Number(expense.amount),
      paidBy: user.id,
    });

    return this.findById(tenantId, id);
  }

  /* ─── Cancel (after payment, with mandatory reason) ─── */
  async cancel(tenantId: string, id: string, dto: CancelExpenseDto, userId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const expenseRepo = ds.getRepository(Expense);
    const expense = await expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    if (expense.status !== ExpenseStatus.PAID) {
      throw new BadRequestException('Only PAID expenses can be cancelled');
    }

    expense.status = ExpenseStatus.CANCELLED;
    await expenseRepo.save(expense);

    await this.auditService.log({
      userId,
      action: AuditAction.CANCEL,
      entityType: 'expense',
      entityId: id,
      oldValue: { status: ExpenseStatus.PAID },
      newValue: { status: ExpenseStatus.CANCELLED, reason: dto.reason },
    });

    await this.eventsService.publish(ExpenseEvent.CANCELLED, {
      expenseId: id,
      reference: expense.reference,
      amount: Number(expense.amount),
      reason: dto.reason,
      cancelledBy: userId,
    });

    return this.findById(tenantId, id);
  }

  /* ─── Upload attachments ─── */
  async addAttachments(tenantId: string, expenseId: string, files: Express.Multer.File[], userId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const expenseRepo = ds.getRepository(Expense);
    const attachRepo = ds.getRepository(ExpenseAttachment);

    const expense = await expenseRepo.findOne({
      where: { id: expenseId },
      relations: ['attachments'],
    });
    if (!expense) throw new NotFoundException('Expense not found');

    const currentCount = expense.attachments?.length || 0;
    if (currentCount + files.length > 5) {
      throw new BadRequestException(`Maximum 5 attachments allowed (current: ${currentCount})`);
    }

    const attachments = files.map((f) =>
      attachRepo.create({
        expenseId,
        filePath: f.path,
        fileType: f.mimetype,
        originalFilename: f.originalname,
      }),
    );
    await attachRepo.save(attachments);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'expense_attachment',
      entityId: expenseId,
      newValue: { filesAdded: files.map((f) => f.originalname) },
    });

    return this.findById(tenantId, expenseId);
  }

  /* ─── Stats / Aggregates ─── */
  async getStats(tenantId: string, filters?: { dateFrom?: string; dateTo?: string; categoryId?: string }) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const expenseRepo = ds.getRepository(Expense);

    const qb = expenseRepo.createQueryBuilder('e');

    if (filters?.dateFrom) qb.andWhere('e.date >= :dateFrom', { dateFrom: filters.dateFrom });
    if (filters?.dateTo) qb.andWhere('e.date <= :dateTo', { dateTo: filters.dateTo });
    if (filters?.categoryId)
      qb.andWhere('e.category_id = :categoryId', { categoryId: filters.categoryId });

    const totalResult = await qb
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'total')
      .getRawOne();

    const byStatus = await expenseRepo
      .createQueryBuilder('e')
      .select('e.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'total')
      .where(filters?.dateFrom ? 'e.date >= :dateFrom' : '1=1', { dateFrom: filters?.dateFrom })
      .andWhere(filters?.dateTo ? 'e.date <= :dateTo' : '1=1', { dateTo: filters?.dateTo })
      .groupBy('e.status')
      .getRawMany();

    const byCategory = await expenseRepo
      .createQueryBuilder('e')
      .leftJoin('e.category', 'cat')
      .select('cat.name', 'categoryName')
      .addSelect('cat.id', 'categoryId')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'total')
      .where(filters?.dateFrom ? 'e.date >= :dateFrom' : '1=1', { dateFrom: filters?.dateFrom })
      .andWhere(filters?.dateTo ? 'e.date <= :dateTo' : '1=1', { dateTo: filters?.dateTo })
      .groupBy('cat.id')
      .addGroupBy('cat.name')
      .getRawMany();

    const byMonth = await expenseRepo
      .createQueryBuilder('e')
      .select("TO_CHAR(e.date, 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'total')
      .where(filters?.dateFrom ? 'e.date >= :dateFrom' : '1=1', { dateFrom: filters?.dateFrom })
      .andWhere(filters?.dateTo ? 'e.date <= :dateTo' : '1=1', { dateTo: filters?.dateTo })
      .groupBy("TO_CHAR(e.date, 'YYYY-MM')")
      .orderBy("TO_CHAR(e.date, 'YYYY-MM')", 'ASC')
      .getRawMany();

    return {
      total: {
        count: parseInt(totalResult.count, 10),
        amount: parseFloat(totalResult.total),
      },
      byStatus: byStatus.map((r) => ({
        status: r.status,
        count: parseInt(r.count, 10),
        amount: parseFloat(r.total),
      })),
      byCategory: byCategory.map((r) => ({
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        count: parseInt(r.count, 10),
        amount: parseFloat(r.total),
      })),
      byMonth: byMonth.map((r) => ({
        month: r.month,
        count: parseInt(r.count, 10),
        amount: parseFloat(r.total),
      })),
    };
  }

  /* ─── Private helpers ─── */
  private applyFilters(qb: SelectQueryBuilder<Expense>, query: ListExpensesQueryDto) {
    if (query.cashDayId) qb.andWhere('e.cash_day_id = :cashDayId', { cashDayId: query.cashDayId });
    if (query.status) {
      const statuses = query.status.split(',').map((s) => s.trim());
      if (statuses.length === 1) {
        qb.andWhere('e.status = :status', { status: statuses[0] });
      } else {
        qb.andWhere('e.status IN (:...statuses)', { statuses });
      }
    }
    if (query.paymentMethod) qb.andWhere('e.payment_method = :pm', { pm: query.paymentMethod });
    if (query.categoryId) qb.andWhere('e.category_id = :catId', { catId: query.categoryId });
    if (query.createdById) qb.andWhere('e.created_by = :uid', { uid: query.createdById });
    if (query.beneficiary)
      qb.andWhere('e.beneficiary LIKE :ben', { ben: `%${query.beneficiary}%` });
    if (query.dateFrom) qb.andWhere('e.date >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) qb.andWhere('e.date <= :dateTo', { dateTo: query.dateTo });
    if (query.amountMin) qb.andWhere('e.amount >= :amountMin', { amountMin: query.amountMin });
    if (query.amountMax) qb.andWhere('e.amount <= :amountMax', { amountMax: query.amountMax });
    if (query.search) {
      qb.andWhere(
        '(e.reference LIKE :search OR e.description LIKE :search OR e.beneficiary LIKE :search)',
        { search: `%${query.search}%` },
      );
    }
  }

  private toResponseDto(e: Expense) {
    return {
      id: e.id,
      reference: e.reference,
      date: e.date,
      amount: Number(e.amount),
      description: e.description,
      beneficiary: e.beneficiary,
      paymentMethod: e.paymentMethod,
      status: e.status,
      observations: e.observations,
      categoryId: e.categoryId,
      categoryName: e.category?.name || null,
      cashDayId: e.cashDayId || null,
      cashDayRef: e.cashDay?.reference || null,
      disbursementRequestId: e.disbursementRequestId || null,
      createdById: e.createdById,
      createdByName: e.createdBy ? `${e.createdBy.firstName} ${e.createdBy.lastName}`.trim() : null,
      departmentId: e.departmentId,
      costCenterId: e.costCenterId,
      projectId: e.projectId,
      currentApprovalLevel: this.getCurrentApprovalLevel(e),
      approvals: (e.approvals || []).map((a) => ({
        id: a.id,
        approverId: a.approverId,
        approverName: a.approver ? `${a.approver.firstName} ${a.approver.lastName}`.trim() : null,
        level: a.level,
        status: a.status,
        comment: a.comment,
        approvedAt: a.approvedAt?.toISOString() || null,
      })),
      attachments: (e.attachments || []).map((a) => ({
        id: a.id,
        filePath: a.filePath,
        fileType: a.fileType,
        originalFilename: a.originalFilename,
        createdAt: a.createdAt?.toISOString(),
      })),
      createdAt: e.createdAt?.toISOString(),
      updatedAt: e.updatedAt?.toISOString(),
    };
  }

  /**
   * Find-or-create an ExpenseApproval for (expenseId, level).
   * If a PENDING record already exists (created at submit time), update it;
   * otherwise create a new one.
   */
  private async upsertApproval(tenantId: string, data: {
    expenseId: string;
    approverId: string;
    level: number;
    status: ApprovalStatus;
    comment: string | null;
    approvedAt: Date | null;
  }): Promise<ExpenseApproval> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const approvalRepo = ds.getRepository(ExpenseApproval);
    const existing = await approvalRepo.findOne({
      where: { expenseId: data.expenseId, level: data.level },
    });
    if (existing) {
      await approvalRepo.update(existing.id, {
        approverId: data.approverId,
        status: data.status,
        comment: data.comment,
        approvedAt: data.approvedAt,
      });
      return { ...existing, ...data } as ExpenseApproval;
    }
    const approval = approvalRepo.create(data);
    return approvalRepo.save(approval);
  }

  private getCurrentApprovalLevel(e: Expense): number | null {
    if (!e.approvals || e.approvals.length === 0) return null;
    const pending = e.approvals.find((a) => a.status === 'PENDING');
    if (pending) return pending.level;
    const approved = e.approvals
      .filter((a) => a.status === 'APPROVED')
      .sort((a, b) => b.level - a.level);
    if (approved.length > 0) return approved[0].level;
    return e.approvals[0].level;
  }
}
