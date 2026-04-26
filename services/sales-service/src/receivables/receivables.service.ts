import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Receivable } from '../entities/receivable.entity';
import { AgingBucket } from '../entities/enums';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { EventsService, SalesEvent } from '../events/events.service';
import { ListReceivablesQueryDto } from './dto';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

@Injectable()
export class ReceivablesService {
  private readonly logger = new Logger(ReceivablesService.name);

  constructor(
    private readonly tenantDsService: TenantDataSourceService,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
  ) {}

  /* ─── FindAll with filters ─── */
  async findAll(tenantId: string, query: ListReceivablesQueryDto) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Receivable);

    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);

    const qb = repo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.sale', 'sale')
      .leftJoinAndSelect('r.client', 'client');

    if (query.clientId) qb.andWhere('r.clientId = :clientId', { clientId: query.clientId });
    if (query.agingBucket) qb.andWhere('r.agingBucket = :bucket', { bucket: query.agingBucket });
    if (query.isSettled !== undefined)
      qb.andWhere('r.isSettled = :settled', { settled: query.isSettled });
    if (query.search) {
      qb.andWhere('(sale.reference ILIKE :s OR client.name ILIKE :s)', { s: `%${query.search}%` });
    }

    const sortBy = query.sortBy || 'dueDate';
    const sortOrder = query.sortOrder || 'ASC';
    const allowedSort = ['dueDate', 'outstandingAmount', 'agingBucket', 'createdAt'];
    const sortField = allowedSort.includes(sortBy) ? sortBy : 'dueDate';
    qb.orderBy(`r.${sortField}`, sortOrder as 'ASC' | 'DESC');

    qb.skip((page - 1) * perPage).take(perPage);
    const [items, total] = await qb.getManyAndCount();

    return {
      data: items.map((r) => this.toResponseDto(r)),
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
    const receivable = await ds.getRepository(Receivable).findOne({
      where: { id },
      relations: ['sale', 'client'],
    });
    if (!receivable) throw new NotFoundException('Receivable not found');
    return this.toResponseDto(receivable);
  }

  /* ─── Aging Report (balance âgée) ─── */
  async getAgingReport(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const repo = ds.getRepository(Receivable);

    const buckets = await repo
      .createQueryBuilder('r')
      .select('r.agingBucket', 'bucket')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(r.outstandingAmount), 0)', 'totalOutstanding')
      .where('r.isSettled = false')
      .groupBy('r.agingBucket')
      .getRawMany();

    const totalResult = await repo
      .createQueryBuilder('r')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(r.outstandingAmount), 0)', 'totalOutstanding')
      .where('r.isSettled = false')
      .getRawOne();

    const byClient = await repo
      .createQueryBuilder('r')
      .leftJoin('r.client', 'client')
      .select('client.id', 'clientId')
      .addSelect('client.name', 'clientName')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(r.outstandingAmount), 0)', 'totalOutstanding')
      .where('r.isSettled = false')
      .groupBy('client.id')
      .addGroupBy('client.name')
      .orderBy('COALESCE(SUM(r.outstandingAmount), 0)', 'DESC')
      .getRawMany();

    return {
      total: {
        count: parseInt(totalResult.count, 10),
        totalOutstanding: parseFloat(totalResult.totalOutstanding),
      },
      byBucket: buckets.map((b) => ({
        bucket: b.bucket,
        count: parseInt(b.count, 10),
        totalOutstanding: parseFloat(b.totalOutstanding),
      })),
      byClient: byClient.map((c) => ({
        clientId: c.clientId,
        clientName: c.clientName,
        count: parseInt(c.count, 10),
        totalOutstanding: parseFloat(c.totalOutstanding),
      })),
    };
  }

  /* ─── Cron: update aging buckets daily at 01:00 ─── */
  // TODO: This cron needs tenantId to iterate all tenants — skipped for schema-per-tenant migration
  @Cron('0 1 * * *')
  async updateAgingBuckets() {
    this.logger.log('Aging bucket cron: skipped — requires per-tenant iteration (TODO)');
  }

  /* ─── Private helpers ─── */
  private toResponseDto(r: Receivable) {
    return {
      id: r.id,
      saleId: r.saleId,
      saleReference: r.sale?.reference || null,
      clientId: r.clientId,
      clientName: r.client?.name || null,
      totalAmount: Number(r.totalAmount),
      paidAmount: Number(r.paidAmount),
      outstandingAmount: Number(r.outstandingAmount),
      dueDate: r.dueDate,
      agingBucket: r.agingBucket,
      isSettled: r.isSettled,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    };
  }
}
