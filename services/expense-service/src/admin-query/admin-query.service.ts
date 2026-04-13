import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Expense } from '../entities/expense.entity';
import { CashDay } from '../entities/cash-day.entity';
import { Advance } from '../entities/advance.entity';
import { DisbursementRequest } from '../entities/disbursement-request.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import {
  ExpenseStatus,
  CashDayStatus,
  AdvanceStatus,
  DisbursementRequestStatus,
} from '../entities/enums';

export type EntityType = 'expense' | 'cashDay' | 'advance' | 'disbursementRequest';

const ALLOWED_STATUSES: Record<EntityType, string[]> = {
  expense: Object.values(ExpenseStatus),
  cashDay: Object.values(CashDayStatus),
  advance: Object.values(AdvanceStatus),
  disbursementRequest: Object.values(DisbursementRequestStatus),
};

@Injectable()
export class AdminQueryService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(CashDay)
    private readonly cashDayRepo: Repository<CashDay>,
    @InjectRepository(Advance)
    private readonly advanceRepo: Repository<Advance>,
    @InjectRepository(DisbursementRequest)
    private readonly disbursementRepo: Repository<DisbursementRequest>,
    private readonly auditService: AuditService,
  ) {}

  private getRepo(entity: EntityType): Repository<unknown> {
    switch (entity) {
      case 'expense':
        return this.expenseRepo;
      case 'cashDay':
        return this.cashDayRepo;
      case 'advance':
        return this.advanceRepo;
      case 'disbursementRequest':
        return this.disbursementRepo;
      default:
        throw new BadRequestException(`Unknown entity type: ${entity}`);
    }
  }

  async search(entity: EntityType, search?: string, status?: string, page = 1, perPage = 50) {
    const repo = this.getRepo(entity);
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.reference = Like(`%${search}%`);
    }

    const [data, total] = await repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    return {
      data,
      total,
      page,
      perPage,
      allowedStatuses: ALLOWED_STATUSES[entity] || [],
    };
  }

  async updateStatus(
    entity: EntityType,
    ids: string[],
    newStatus: string,
    userId: string,
    reason?: string,
  ) {
    const allowed = ALLOWED_STATUSES[entity];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status "${newStatus}" for entity "${entity}". Allowed: ${allowed?.join(', ')}`,
      );
    }

    const repo = this.getRepo(entity);
    const records = await repo.find({ where: { id: In(ids) } });

    if (records.length === 0) {
      throw new NotFoundException('No records found with the provided IDs');
    }

    const results: { id: string; reference: string; oldStatus: string; newStatus: string }[] = [];

    for (const record of records) {
      const oldStatus = record.status;
      record.status = newStatus;
      await repo.save(record);

      results.push({
        id: record.id,
        reference: record.reference || record.id,
        oldStatus,
        newStatus,
      });

      await this.auditService.log({
        userId,
        action: AuditAction.UPDATE,
        entityType: entity,
        entityId: record.id,
        oldValue: { status: oldStatus },
        newValue: { status: newStatus, reason: reason || 'Admin status override' },
      });
    }

    return { updated: results.length, results };
  }
}
