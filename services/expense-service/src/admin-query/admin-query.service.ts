import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Like, In } from 'typeorm';
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
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';
import { DataSource } from 'typeorm'; // used for getRepo parameter type

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
    private readonly tenantDsService: TenantDataSourceService,
    private readonly auditService: AuditService,
  ) {}

  private getRepo(ds: DataSource, entity: EntityType) {
    switch (entity) {
      case 'expense':
        return ds.getRepository(Expense);
      case 'cashDay':
        return ds.getRepository(CashDay);
      case 'advance':
        return ds.getRepository(Advance);
      case 'disbursementRequest':
        return ds.getRepository(DisbursementRequest);
      default:
        throw new BadRequestException(`Unknown entity type: ${entity}`);
    }
  }

  async search(tenantId: string, entity: EntityType, search?: string, status?: string, page = 1, perPage = 50) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = this.getRepo(ds, entity);
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
    tenantId: string,
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

    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = this.getRepo(ds, entity);
    const records = await repo.find({ where: { id: In(ids) } });

    if (records.length === 0) {
      throw new NotFoundException('No records found with the provided IDs');
    }

    const results: { id: string; reference: string; oldStatus: string; newStatus: string }[] = [];

    for (const record of records) {
      const rec = record as Record<string, any>;
      const oldStatus = rec.status;
      rec.status = newStatus;
      await (repo as any).save(rec);

      results.push({
        id: rec.id,
        reference: rec.reference || rec.id,
        oldStatus,
        newStatus,
      });

      await this.auditService.log({
        userId,
        action: AuditAction.UPDATE,
        entityType: entity,
        entityId: rec.id,
        oldValue: { status: oldStatus },
        newValue: { status: newStatus, reason: reason || 'Admin status override' },
      });
    }

    return { updated: results.length, results };
  }
}
