import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Expense } from '../entities/expense.entity';
import { ExpenseAttachment } from '../entities/expense-attachment.entity';
import { ExpenseApproval } from '../entities/expense-approval.entity';
import { ExpenseCategory } from '../entities/expense-category.entity';
import { ExpenseStatus, ApprovalStatus } from '../entities/enums';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { EventsService, ExpenseEvent } from '../events/events.service';
import { BudgetsService } from '../budgets/budgets.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  ApproveExpenseDto,
  RejectExpenseDto,
  ListExpensesQueryDto,
} from './dto';

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
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
    private readonly budgetsService: BudgetsService,
  ) {}

  /* ─── Reference generation: DEP-YYYY-NNNNN ─── */
  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DEP-${year}-`;

    const last = await this.expenseRepo
      .createQueryBuilder('e')
      .where('e.reference LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('e.reference', 'DESC')
      .getOne();

    let seq = 1;
    if (last) {
      const num = parseInt(last.reference.replace(prefix, ''), 10);
      seq = num + 1;
    }
    return `${prefix}${String(seq).padStart(5, '0')}`;
  }

  /* ─── FindAll with advanced filters ─── */
  async findAll(query: ListExpensesQueryDto) {
    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);

    const qb = this.expenseRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.category', 'cat')
      .leftJoinAndSelect('e.approvals', 'approvals')
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
    const expense = await this.expenseRepo.findOne({
      where: { id },
      relations: ['category', 'approvals', 'attachments'],
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return this.toResponseDto(expense);
  }

  /* ─── Create ─── */
  async create(dto: CreateExpenseDto, userId: string) {
    const cat = await this.catRepo.findOne({ where: { id: dto.categoryId } });
    if (!cat) throw new NotFoundException('Category not found');

    const reference = await this.generateReference();

    const expense = this.expenseRepo.create({
      reference,
      date: dto.date,
      amount: dto.amount,
      description: dto.description || null,
      beneficiary: dto.beneficiary || null,
      paymentMethod: dto.paymentMethod,
      categoryId: dto.categoryId,
      createdById: userId,
      observations: dto.observations || null,
      costCenterId: dto.costCenterId || null,
      projectId: dto.projectId || null,
      status: ExpenseStatus.DRAFT,
    });

    const saved = await this.expenseRepo.save(expense);

    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'expense',
      entityId: saved.id,
      newValue: { reference, amount: dto.amount, categoryId: dto.categoryId },
    });

    await this.eventsService.publish(ExpenseEvent.CREATED, {
      expenseId: saved.id,
      reference,
      amount: dto.amount,
      createdById: userId,
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

    expense.status = ExpenseStatus.PENDING;
    await this.expenseRepo.save(expense);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'expense',
      entityId: id,
      oldValue: { status: ExpenseStatus.DRAFT },
      newValue: { status: ExpenseStatus.PENDING },
    });

    return this.findById(id);
  }

  /* ─── Approve L1 / L2 ─── */
  async approve(id: string, level: number, dto: ApproveExpenseDto, approverId: string) {
    const expense = await this.expenseRepo.findOne({ where: { id }, relations: ['approvals'] });
    if (!expense) throw new NotFoundException('Expense not found');

    const expectedStatus = level === 1 ? ExpenseStatus.PENDING : ExpenseStatus.APPROVED_L1;
    if (expense.status !== expectedStatus) {
      throw new BadRequestException(`Expense must be in ${expectedStatus} status for L${level} approval`);
    }

    const approval = this.approvalRepo.create({
      expenseId: id,
      approverId,
      level,
      status: ApprovalStatus.APPROVED,
      comment: dto.comment || null,
      approvedAt: new Date(),
    });
    await this.approvalRepo.save(approval);

    const newStatus = level === 1 ? ExpenseStatus.APPROVED_L1 : ExpenseStatus.APPROVED_L2;
    expense.status = newStatus;
    await this.expenseRepo.save(expense);

    await this.auditService.log({
      userId: approverId,
      action: AuditAction.APPROVE,
      entityType: 'expense',
      entityId: id,
      newValue: { level, status: newStatus, comment: dto.comment },
    });

    await this.eventsService.publish(ExpenseEvent.APPROVED, {
      expenseId: id,
      reference: expense.reference,
      amount: Number(expense.amount),
      level,
      approverId,
    });

    // On L2 approval, update budgets
    if (level === 2) {
      await this.budgetsService.consumeBudget(expense.categoryId, Number(expense.amount), expense.date);
    }

    return this.findById(id);
  }

  /* ─── Reject ─── */
  async reject(id: string, level: number, dto: RejectExpenseDto, approverId: string) {
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    const approval = this.approvalRepo.create({
      expenseId: id,
      approverId,
      level,
      status: ApprovalStatus.REJECTED,
      comment: dto.comment,
      approvedAt: new Date(),
    });
    await this.approvalRepo.save(approval);

    expense.status = ExpenseStatus.REJECTED;
    await this.expenseRepo.save(expense);

    await this.auditService.log({
      userId: approverId,
      action: AuditAction.REJECT,
      entityType: 'expense',
      entityId: id,
      newValue: { status: ExpenseStatus.REJECTED, comment: dto.comment },
    });

    return this.findById(id);
  }

  /* ─── Mark as Paid ─── */
  async markPaid(id: string, userId: string) {
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    if (expense.status !== ExpenseStatus.APPROVED_L2) {
      throw new BadRequestException('Only APPROVED_L2 expenses can be marked as paid');
    }

    expense.status = ExpenseStatus.PAID;
    await this.expenseRepo.save(expense);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'expense',
      entityId: id,
      oldValue: { status: ExpenseStatus.APPROVED_L2 },
      newValue: { status: ExpenseStatus.PAID },
    });

    await this.eventsService.publish(ExpenseEvent.PAID, {
      expenseId: id,
      reference: expense.reference,
      amount: Number(expense.amount),
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
    if (filters?.categoryId) qb.andWhere('e.category_id = :categoryId', { categoryId: filters.categoryId });

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
    if (query.status) qb.andWhere('e.status = :status', { status: query.status });
    if (query.paymentMethod) qb.andWhere('e.payment_method = :pm', { pm: query.paymentMethod });
    if (query.categoryId) qb.andWhere('e.category_id = :catId', { catId: query.categoryId });
    if (query.createdById) qb.andWhere('e.created_by = :uid', { uid: query.createdById });
    if (query.beneficiary) qb.andWhere('e.beneficiary ILIKE :ben', { ben: `%${query.beneficiary}%` });
    if (query.dateFrom) qb.andWhere('e.date >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) qb.andWhere('e.date <= :dateTo', { dateTo: query.dateTo });
    if (query.amountMin) qb.andWhere('e.amount >= :amountMin', { amountMin: query.amountMin });
    if (query.amountMax) qb.andWhere('e.amount <= :amountMax', { amountMax: query.amountMax });
    if (query.search) {
      qb.andWhere(
        '(e.reference ILIKE :search OR e.description ILIKE :search OR e.beneficiary ILIKE :search)',
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
      createdById: e.createdById,
      costCenterId: e.costCenterId,
      projectId: e.projectId,
      approvals: (e.approvals || []).map((a) => ({
        id: a.id,
        approverId: a.approverId,
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
}
