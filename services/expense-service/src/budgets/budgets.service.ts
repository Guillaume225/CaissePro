import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Budget } from '../entities/budget.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { EventsService, ExpenseEvent } from '../events/events.service';
import { CreateBudgetDto, UpdateBudgetDto } from './dto';

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(
    @InjectRepository(Budget)
    private readonly budgetRepo: Repository<Budget>,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
  ) {}

  /* ─── FindAll ─── */
  async findAll(filters?: { categoryId?: string; departmentId?: string; active?: boolean }) {
    const qb = this.budgetRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.category', 'cat');

    if (filters?.categoryId) qb.andWhere('b.category_id = :catId', { catId: filters.categoryId });
    if (filters?.departmentId) qb.andWhere('b.department_id = :deptId', { deptId: filters.departmentId });
    if (filters?.active) {
      const now = new Date().toISOString().split('T')[0];
      qb.andWhere('b.period_start <= :now', { now });
      qb.andWhere('b.period_end >= :now', { now });
    }

    qb.orderBy('b.periodStart', 'DESC');
    const items = await qb.getMany();
    return items.map((b) => this.toResponseDto(b));
  }

  /* ─── FindById ─── */
  async findById(id: string) {
    const budget = await this.budgetRepo.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!budget) throw new NotFoundException('Budget not found');
    return this.toResponseDto(budget);
  }

  /* ─── Create ─── */
  async create(dto: CreateBudgetDto, userId: string) {
    // Check for overlapping budget for the same category
    const overlap = await this.budgetRepo
      .createQueryBuilder('b')
      .where('b.category_id = :catId', { catId: dto.categoryId })
      .andWhere('b.period_start <= :end', { end: dto.periodEnd })
      .andWhere('b.period_end >= :start', { start: dto.periodStart })
      .getOne();

    if (overlap) {
      throw new BadRequestException(
        'A budget already exists for this category and overlapping period',
      );
    }

    const data: Partial<Budget> = {
      categoryId: dto.categoryId,
      departmentId: dto.departmentId || null,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      allocatedAmount: dto.allocatedAmount,
      consumedAmount: 0,
      alertThresholds: dto.alertThresholds || [50, 75, 90, 100],
    };
    const budget = this.budgetRepo.create(data);

    const saved = await this.budgetRepo.save(budget);

    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'budget',
      entityId: saved.id,
      newValue: {
        categoryId: dto.categoryId,
        allocatedAmount: dto.allocatedAmount,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
      },
    });

    return this.findById(saved.id);
  }

  /* ─── Update ─── */
  async update(id: string, dto: UpdateBudgetDto, userId: string) {
    const budget = await this.budgetRepo.findOne({ where: { id } });
    if (!budget) throw new NotFoundException('Budget not found');

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    for (const key of Object.keys(dto) as (keyof UpdateBudgetDto)[]) {
      if (dto[key] !== undefined) {
        oldValue[key] = (budget as unknown as Record<string, unknown>)[key];
        newValue[key] = dto[key];
      }
    }

    Object.assign(budget, dto);
    await this.budgetRepo.save(budget);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'budget',
      entityId: id,
      oldValue,
      newValue,
    });

    return this.findById(id);
  }

  /* ─── Consume budget (called by expenses.service on L2 approval) ─── */
  async consumeBudget(categoryId: string, amount: number, expenseDate: Date | string): Promise<void> {
    const date = typeof expenseDate === 'string' ? expenseDate : expenseDate.toISOString().split('T')[0];

    const budget = await this.budgetRepo
      .createQueryBuilder('b')
      .where('b.category_id = :catId', { catId: categoryId })
      .andWhere('b.period_start <= :date', { date })
      .andWhere('b.period_end >= :date', { date })
      .getOne();

    if (!budget) {
      this.logger.warn(`No budget found for category ${categoryId} on date ${date}`);
      return;
    }

    budget.consumedAmount = Number(budget.consumedAmount) + amount;
    await this.budgetRepo.save(budget);

    // Check alert thresholds
    const pct = (Number(budget.consumedAmount) / Number(budget.allocatedAmount)) * 100;
    const thresholds = (budget.alertThresholds as number[]) || [50, 75, 90, 100];
    const previousPct = ((Number(budget.consumedAmount) - amount) / Number(budget.allocatedAmount)) * 100;

    for (const threshold of thresholds) {
      if (previousPct < threshold && pct >= threshold) {
        this.logger.warn(
          `Budget alert: ${pct.toFixed(1)}% consumed for category ${categoryId} (threshold: ${threshold}%)`,
        );

        await this.eventsService.publish(ExpenseEvent.BUDGET_ALERT, {
          budgetId: budget.id,
          categoryId,
          allocatedAmount: Number(budget.allocatedAmount),
          consumedAmount: Number(budget.consumedAmount),
          percentage: parseFloat(pct.toFixed(2)),
          threshold,
        });
        break; // Only send the first crossed threshold
      }
    }
  }

  /* ─── Consumption endpoint ─── */
  async getConsumption(categoryId?: string) {
    const now = new Date().toISOString().split('T')[0];
    const qb = this.budgetRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.category', 'cat')
      .where('b.period_start <= :now', { now })
      .andWhere('b.period_end >= :now', { now });

    if (categoryId) qb.andWhere('b.category_id = :catId', { catId: categoryId });

    const budgets = await qb.getMany();

    return budgets.map((b) => ({
      id: b.id,
      categoryId: b.categoryId,
      categoryName: b.category?.name || null,
      periodStart: b.periodStart,
      periodEnd: b.periodEnd,
      allocatedAmount: Number(b.allocatedAmount),
      consumedAmount: Number(b.consumedAmount),
      remainingAmount: Number(b.allocatedAmount) - Number(b.consumedAmount),
      consumptionPercentage: Number(b.allocatedAmount) > 0
        ? parseFloat(((Number(b.consumedAmount) / Number(b.allocatedAmount)) * 100).toFixed(2))
        : 0,
    }));
  }

  /* ─── Response mapper ─── */
  private toResponseDto(b: Budget) {
    return {
      id: b.id,
      categoryId: b.categoryId,
      categoryName: b.category?.name || null,
      departmentId: b.departmentId,
      periodStart: b.periodStart,
      periodEnd: b.periodEnd,
      allocatedAmount: Number(b.allocatedAmount),
      consumedAmount: Number(b.consumedAmount),
      remainingAmount: Number(b.allocatedAmount) - Number(b.consumedAmount),
      consumptionPercentage: Number(b.allocatedAmount) > 0
        ? parseFloat(((Number(b.consumedAmount) / Number(b.allocatedAmount)) * 100).toFixed(2))
        : 0,
      alertThresholds: b.alertThresholds,
      createdAt: b.createdAt?.toISOString(),
      updatedAt: b.updatedAt?.toISOString(),
    };
  }
}
