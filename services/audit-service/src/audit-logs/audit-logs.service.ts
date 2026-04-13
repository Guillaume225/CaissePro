import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository, SelectQueryBuilder, LessThan } from 'typeorm';
import * as crypto from 'crypto';
import { AuditLog } from '@/entities/audit-log.entity';
import { ListAuditLogsQueryDto, ExportAuditLogsQueryDto, ExportFormat } from './dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);
  private readonly hmacSecret: string;
  private readonly retentionYears: number;

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly configService: ConfigService,
  ) {
    this.hmacSecret = this.configService.get<string>('audit.hmacSecret', 'change-me-in-production');
    this.retentionYears = this.configService.get<number>('audit.retentionYears', 10);
  }

  /* ------------------------------------------------------------------ */
  /*  Paginated list with filters                                       */
  /* ------------------------------------------------------------------ */

  async findAll(query: ListAuditLogsQueryDto): Promise<PaginatedResult<AuditLog>> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;

    const qb = this.auditLogRepo.createQueryBuilder('log');
    this.applyFilters(qb, query);

    const sortBy = query.sortBy ?? 'timestamp';
    const sortOrder = query.sortOrder ?? 'DESC';
    const allowedSortFields = ['timestamp', 'sourceService', 'action', 'entityType', 'eventType', 'userId'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'timestamp';
    qb.orderBy(`log.${safeSortBy}`, sortOrder as 'ASC' | 'DESC');

    qb.skip((page - 1) * perPage).take(perPage);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Entity history                                                    */
  /* ------------------------------------------------------------------ */

  async findByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { entityType, entityId },
      order: { timestamp: 'ASC' },
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Export CSV / JSON                                                  */
  /* ------------------------------------------------------------------ */

  async exportLogs(
    query: ExportAuditLogsQueryDto,
  ): Promise<{ contentType: string; filename: string; data: string }> {
    const format = query.format ?? ExportFormat.CSV;

    const qb = this.auditLogRepo.createQueryBuilder('log');
    this.applyFilters(qb, query);
    qb.orderBy('log.timestamp', 'DESC');
    // Export limit — prevent OOM on huge result sets
    qb.take(50_000);

    const logs = await qb.getMany();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === ExportFormat.JSON) {
      return {
        contentType: 'application/json',
        filename: `audit-logs-${timestamp}.json`,
        data: JSON.stringify(logs, null, 2),
      };
    }

    // CSV — using json2csv
    const { Parser } = await import('json2csv');
    const fields = [
      'id',
      'sourceService',
      'eventType',
      'userId',
      'action',
      'entityType',
      'entityId',
      'ipAddress',
      'signature',
      'timestamp',
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(logs);

    return {
      contentType: 'text/csv',
      filename: `audit-logs-${timestamp}.csv`,
      data: csv,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  HMAC signature verification                                       */
  /* ------------------------------------------------------------------ */

  verifySignature(entry: AuditLog): boolean {
    const canonical = JSON.stringify({
      sourceService: entry.sourceService,
      eventType: entry.eventType,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      payload: entry.payload,
    });

    const expected = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(canonical)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(entry.signature, 'hex'),
      Buffer.from(expected, 'hex'),
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Retention cron — purge entries older than retentionYears          */
  /* ------------------------------------------------------------------ */

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeExpiredLogs(): Promise<void> {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - this.retentionYears);

    const result = await this.auditLogRepo.delete({
      timestamp: LessThan(cutoff),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(`Retention cron: purged ${result.affected} audit logs older than ${this.retentionYears} years`);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Private helpers                                                   */
  /* ------------------------------------------------------------------ */

  private applyFilters(
    qb: SelectQueryBuilder<AuditLog>,
    query: ListAuditLogsQueryDto,
  ): void {
    if (query.userId) {
      qb.andWhere('log.userId = :userId', { userId: query.userId });
    }
    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }
    if (query.entityType) {
      qb.andWhere('log.entityType = :entityType', { entityType: query.entityType });
    }
    if (query.entityId) {
      qb.andWhere('log.entityId = :entityId', { entityId: query.entityId });
    }
    if (query.sourceService) {
      qb.andWhere('log.sourceService = :sourceService', { sourceService: query.sourceService });
    }
    if (query.eventType) {
      qb.andWhere('log.eventType = :eventType', { eventType: query.eventType });
    }
    if (query.dateFrom) {
      qb.andWhere('log.timestamp >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('log.timestamp <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.search) {
      qb.andWhere(
        '(log.eventType ILIKE :search OR log.action ILIKE :search OR log.entityType ILIKE :search OR log.sourceService ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
  }
}
