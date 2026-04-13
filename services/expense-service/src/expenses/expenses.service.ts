import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, SelectQueryBuilder, DataSource } from 'typeorm';
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
  departmentId: string | null;
}

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(ExpenseAttachment)
    private readonly attachRepo: Repository<ExpenseAttachment>,
    @InjectRepository(ExpenseApproval)
    private readonly approvalRepo: Repository<ExpenseApproval>,
    @InjectRepository(ExpenseCategory)
    private readonly catRepo: Repository<ExpenseCategory>,
    @InjectRepository(CashDay)
    private readonly cashDayRepo: Repository<CashDay>,
    @InjectRepository(DisbursementRequest)
    private readonly disbursementRequestRepo: Repository<DisbursementRequest>,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  /* ─── Reference generation: DEP-YYYY-NNNNN ─── */
  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DEP-${year}-`;

    const result = await this.expenseRepo
      .createQueryBuilder('e')
      .select('MAX(CAST(RIGHT(e.reference, 5) AS INT))', 'maxSeq')
      .where('e.reference LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('LEN(e.reference) = :len', { len: prefix.length + 5 })
      .getRawOne();

    const seq = (result?.maxSeq ?? 0) + 1;
    return `${prefix}${String(seq).padStart(5, '0')}`;
  }

  /* ─── FindAll with advanced filters ─── */
  async findAll(query: ListExpensesQueryDto) {
    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);

    const qb = this.expenseRepo
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
  async findById(id: string) {
    const expense = await this.expenseRepo
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
  async create(dto: CreateExpenseDto, user: WorkflowUser) {
    const cat = await this.catRepo.findOne({ where: { id: dto.categoryId } });
    if (!cat) throw new NotFoundException('Category not found');

    const reference = await this.generateReference();

    // Find open EXPENSE cash day to link the expense
    const openCashDay = await this.cashDayRepo.findOne({
      where: { cashType: CashType.EXPENSE, status: CashDayStatus.OPEN },
      order: { openedAt: 'DESC' },
    });

    const expense = this.expenseRepo.create({
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

    const saved = await this.expenseRepo.save(expense);

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

    return this.findById(saved.id);
  }

  /* ─── Update (only DRAFT) ─── */
  async update(id: string, dto: UpdateExpenseDto, userId: string) {
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    if (expense.status !== ExpenseStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT expenses can be updated');
    }

    if (dto.categoryId) {
      const cat = await this.catRepo.findOne({ where: { id: dto.categoryId } });
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
    await this.expenseRepo.save(expense);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'expense',
      entityId: id,
      oldValue,
      newValue,
    });

    return this.findById(id);
  }

  /* ─── Soft Delete (only DRAFT) ─── */
  async remove(id: string, userId: string): Promise<void> {
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    if (expense.status !== ExpenseStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT expenses can be deleted');
    }

    await this.expenseRepo.softDelete(id);

    await this.auditService.log({
      userId,
      action: AuditAction.DELETE,
      entityType: 'expense',
      entityId: id,
      oldValue: { reference: expense.reference, amount: expense.amount },
    });
  }

  /* ─── Submit for approval ─── */
  async submit(id: string, userId: string) {
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.status !== ExpenseStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT expenses can be submitted');
    }
    if (expense.createdById !== userId) {
      throw new ForbiddenException('Only the creator can submit an expense');
    }

    expense.status = ExpenseStatus.PENDING;
    await this.expenseRepo.save(expense);

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

    return this.findById(id);
  }

  /* ─── Approve (level auto-detected from expense status) ─── */
  async approve(id: string, dto: ApproveExpenseDto, user: WorkflowUser) {
    const expense = await this.expenseRepo.findOne({ where: { id }, relations: ['approvals'] });
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
      return this.approveL1(expense, dto, user, threshold);
    }
    if (expense.status === ExpenseStatus.APPROVED_L1) {
      return this.approveL2(expense, dto, user, l2Roles);
    }

    throw new BadRequestException('Expense must be in PENDING or APPROVED_L1 status for approval');
  }

  /* ── L1 internal ── */
  private async approveL1(
    expense: Expense,
    dto: ApproveExpenseDto,
    user: WorkflowUser,
    threshold: number,
  ) {
    if (!user.departmentId || user.departmentId !== expense.departmentId) {
      throw new ForbiddenException('L1 approver must belong to the same department as the expense');
    }

    const approval = this.approvalRepo.create({
      expenseId: expense.id,
      approverId: user.id,
      level: 1,
      status: ApprovalStatus.APPROVED,
      comment: dto.comment || null,
      approvedAt: new Date(),
    });
    await this.approvalRepo.save(approval);

    const amount = Number(expense.amount);
    const autoL2 = amount <= threshold;

    if (autoL2) {
      // Amount below threshold → auto-approve L2
      const l2Approval = this.approvalRepo.create({
        expenseId: expense.id,
        approverId: user.id,
        level: 2,
        status: ApprovalStatus.APPROVED,
        comment: `Auto-approved: amount (${amount} FCFA) below threshold (${threshold} FCFA)`,
        approvedAt: new Date(),
      });
      await this.approvalRepo.save(l2Approval);

      expense.status = ExpenseStatus.APPROVED_L2;
      await this.expenseRepo.save(expense);

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
      await this.expenseRepo.save(expense);

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

    return this.findById(expense.id);
  }

  /* ── L2 internal ── */
  private async approveL2(
    expense: Expense,
    dto: ApproveExpenseDto,
    user: WorkflowUser,
    l2Roles: string[],
  ) {
    if (!l2Roles.includes(user.roleName)) {
      throw new ForbiddenException(
        `L2 approval requires one of the following roles: ${l2Roles.join(', ')}`,
      );
    }

    const amount = Number(expense.amount);

    const approval = this.approvalRepo.create({
      expenseId: expense.id,
      approverId: user.id,
      level: 2,
      status: ApprovalStatus.APPROVED,
      comment: dto.comment || null,
      approvedAt: new Date(),
    });
    await this.approvalRepo.save(approval);

    expense.status = ExpenseStatus.APPROVED_L2;
    await this.expenseRepo.save(expense);

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

    return this.findById(expense.id);
  }

  /* ─── Reject (level auto-detected from expense status) ─── */
  async reject(id: string, dto: RejectExpenseDto, user: WorkflowUser) {
    const expense = await this.expenseRepo.findOne({ where: { id } });
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

    const approval = this.approvalRepo.create({
      expenseId: id,
      approverId: user.id,
      level,
      status: ApprovalStatus.REJECTED,
      comment: dto.comment,
      approvedAt: new Date(),
    });
    await this.approvalRepo.save(approval);

    expense.status = ExpenseStatus.REJECTED;
    await this.expenseRepo.save(expense);

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

    return this.findById(id);
  }

  /* ─── Mark as Paid ─── */
  async markPaid(id: string, user: WorkflowUser) {
    const expense = await this.expenseRepo.findOne({ where: { id } });
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

    // Check disbursement limit from company settings
    const cashierRole =
      this.configService.get<string>('workflow.cashierRole') ?? 'CAISSIER_DEPENSES';
    if (user.roleName !== cashierRole) {
      throw new ForbiddenException('Seul le caissier peut marquer une dépense comme payée.');
    }

    const amount = Number(expense.amount);
    const [company] = await this.dataSource.query(
      `SELECT TOP 1 max_disbursement_amount FROM companies`,
    );
    const maxDisbursement = Number(company?.max_disbursement_amount ?? 0);
    if (maxDisbursement > 0 && amount > maxDisbursement) {
      throw new BadRequestException(
        `Le montant (${amount} FCFA) dépasse la limite autorisée de décaissement (${maxDisbursement} FCFA).`,
      );
    }

    expense.status = ExpenseStatus.PAID;

    // Link expense to current open EXPENSE cash day
    const openCashDay = await this.cashDayRepo.findOne({
      where: { status: CashDayStatus.OPEN, cashType: CashType.EXPENSE },
    });
    if (openCashDay) {
      expense.cashDayId = openCashDay.id;
    }

    await this.expenseRepo.save(expense);

    // Update linked disbursement request to VALIDATED
    if (expense.disbursementRequestId) {
      const dr = await this.disbursementRequestRepo.findOne({
        where: { id: expense.disbursementRequestId },
      });
      if (dr && dr.status === DisbursementRequestStatus.VALIDATING) {
        dr.status = DisbursementRequestStatus.VALIDATED;
        await this.disbursementRequestRepo.save(dr);
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

    return this.findById(id);
  }

  /* ─── Cancel (after payment, with mandatory reason) ─── */
  async cancel(id: string, dto: CancelExpenseDto, userId: string) {
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    if (expense.status !== ExpenseStatus.PAID) {
      throw new BadRequestException('Only PAID expenses can be cancelled');
    }

    expense.status = ExpenseStatus.CANCELLED;
    await this.expenseRepo.save(expense);

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

    return this.findById(id);
  }

  /* ─── Upload attachments ─── */
  async addAttachments(expenseId: string, files: Express.Multer.File[], userId: string) {
    const expense = await this.expenseRepo.findOne({
      where: { id: expenseId },
      relations: ['attachments'],
    });
    if (!expense) throw new NotFoundException('Expense not found');

    const currentCount = expense.attachments?.length || 0;
    if (currentCount + files.length > 5) {
      throw new BadRequestException(`Maximum 5 attachments allowed (current: ${currentCount})`);
    }

    const attachments = files.map((f) =>
      this.attachRepo.create({
        expenseId,
        filePath: f.path,
        fileType: f.mimetype,
        originalFilename: f.originalname,
      }),
    );
    await this.attachRepo.save(attachments);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'expense_attachment',
      entityId: expenseId,
      newValue: { filesAdded: files.map((f) => f.originalname) },
    });

    return this.findById(expenseId);
  }

  /* ─── Stats / Aggregates ─── */
  async getStats(filters?: { dateFrom?: string; dateTo?: string; categoryId?: string }) {
    const qb = this.expenseRepo.createQueryBuilder('e');

    if (filters?.dateFrom) qb.andWhere('e.date >= :dateFrom', { dateFrom: filters.dateFrom });
    if (filters?.dateTo) qb.andWhere('e.date <= :dateTo', { dateTo: filters.dateTo });
    if (filters?.categoryId)
      qb.andWhere('e.category_id = :categoryId', { categoryId: filters.categoryId });

    const totalResult = await qb
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'total')
      .getRawOne();

    const byStatus = await this.expenseRepo
      .createQueryBuilder('e')
      .select('e.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'total')
      .where(filters?.dateFrom ? 'e.date >= :dateFrom' : '1=1', { dateFrom: filters?.dateFrom })
      .andWhere(filters?.dateTo ? 'e.date <= :dateTo' : '1=1', { dateTo: filters?.dateTo })
      .groupBy('e.status')
      .getRawMany();

    const byCategory = await this.expenseRepo
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

    const byMonth = await this.expenseRepo
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
