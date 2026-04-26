import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { CashDay } from '../entities/cash-day.entity';
import { Payment } from '../entities/payment.entity';
import { CashDayStatus, CashType, PaymentMethod } from '../entities/enums';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { EventsService, SalesEvent } from '../events/events.service';
import { SageErpService } from '../erp/sage-erp.service';
import { ErpSettingsService } from '../erp/erp-settings.service';
import { OpenCashClosingDto, CloseCashClosingDto, ListCashClosingsQueryDto } from './dto';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

export interface CashClosingUser {
  id: string;
  email: string;
  roleName: string;
  permissions: string[];
  tenantId: string;
}

@Injectable()
export class CashClosingService {
  private readonly logger = new Logger(CashClosingService.name);

  constructor(
    private readonly tenantDsService: TenantDataSourceService,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
    private readonly sageErpService: SageErpService,
    private readonly erpSettingsService: ErpSettingsService,
  ) {}

  private readonly CASH_TYPE = CashType.SALES;

  /* ─── Reference generation: CLV-YYYY-NNNNN ─── */
  private async generateReference(tenantId: string): Promise<string> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const year = new Date().getFullYear();
    const prefix = `CLV-${year}-`;
    const last = await ds.getRepository(CashDay)
      .createQueryBuilder('cc')
      .where('cc.reference LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('cc.reference', 'DESC')
      .getOne();

    let seq = 1;
    if (last) {
      const num = parseInt(last.reference.replace(prefix, ''), 10);
      seq = num + 1;
    }
    return `${prefix}${String(seq).padStart(5, '0')}`;
  }

  /* ─── Open cash register ─── */
  async open(dto: OpenCashClosingDto, user: CashClosingUser) {
    const ds = await this.tenantDsService.getDataSource(user.tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const existing = await closingRepo.findOne({
      where: { status: CashDayStatus.OPEN, cashType: this.CASH_TYPE },
    });
    if (existing) {
      throw new BadRequestException(
        `Une caisse est déjà ouverte (${existing.reference}). Veuillez la clôturer d'abord.`,
      );
    }

    await this.ensureYesterdayClosed(user.tenantId);

    // Auto-inherit opening balance from last closed cash day
    let openingBalance = dto.openingBalance ?? 0;
    const lastClosed = await closingRepo.findOne({
      where: { status: CashDayStatus.CLOSED, cashType: this.CASH_TYPE },
      order: { reference: 'DESC' },
    });
    if (lastClosed && lastClosed.actualBalance != null) {
      openingBalance = Number(lastClosed.actualBalance);
    }

    const reference = await this.generateReference(user.tenantId);
    const closing = closingRepo.create({
      reference,
      cashType: this.CASH_TYPE,
      status: CashDayStatus.OPEN,
      openingBalance,
      totalEntries: 0,
      totalExits: 0,
      theoreticalBalance: openingBalance,
      actualBalance: null,
      variance: 0,
      openedById: user.id,
      closedById: null,
      openedAt: new Date(),
      closedAt: null,
    });

    const saved = await closingRepo.save(closing);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.CASH_CLOSING_OPEN,
      entityType: 'cash_closing',
      entityId: saved.id,
      newValue: { reference, openingBalance },
    });

    await this.eventsService.publish(SalesEvent.CASH_CLOSING_OPENED, {
      closingId: saved.id,
      reference,
      openingBalance,
      openedById: user.id,
    });

    return this.toResponseDto(saved);
  }

  /* ─── Get current open register ─── */
  async getCurrent(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const current = await closingRepo.findOne({
      where: { status: CashDayStatus.OPEN, cashType: this.CASH_TYPE },
    });
    if (!current) {
      throw new NotFoundException('Aucune caisse ouverte actuellement.');
    }

    const totals = await this.calculateTotals(tenantId, current.openedAt);
    current.totalEntries = totals.totalEntries;
    current.totalExits = totals.totalExits;
    current.theoreticalBalance =
      Number(current.openingBalance) + totals.totalEntries - totals.totalExits;

    return this.toResponseDto(current);
  }

  /* ─── Close cash register ─── */
  async close(dto: CloseCashClosingDto, user: CashClosingUser) {
    const ds = await this.tenantDsService.getDataSource(user.tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const current = await closingRepo.findOne({
      where: { status: CashDayStatus.OPEN, cashType: this.CASH_TYPE },
    });
    if (!current) {
      throw new NotFoundException('Aucune caisse ouverte à clôturer.');
    }

    const totals = await this.calculateTotals(user.tenantId, current.openedAt);
    const openingBalance = Number(current.openingBalance);
    const theoreticalBalance = openingBalance + totals.totalEntries - totals.totalExits;
    const variance = dto.actualBalance - theoreticalBalance;

    const threshold = this.configService.get<number>('cashClosing.varianceThreshold') ?? 5000;
    if (Math.abs(variance) > threshold && !dto.comment) {
      throw new BadRequestException(
        `L'écart (${variance} FCFA) dépasse le seuil (${threshold} FCFA). Un commentaire est obligatoire.`,
      );
    }

    current.totalEntries = totals.totalEntries;
    current.totalExits = totals.totalExits;
    current.theoreticalBalance = theoreticalBalance;
    current.actualBalance = dto.actualBalance;
    current.variance = variance;
    current.comment = dto.comment || null;
    current.status = CashDayStatus.CLOSED;
    current.closedById = user.id;
    current.closedAt = new Date();

    const saved = await closingRepo.save(current);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.CASH_CLOSING_CLOSE,
      entityType: 'cash_closing',
      entityId: saved.id,
      newValue: {
        reference: saved.reference,
        theoreticalBalance,
        actualBalance: dto.actualBalance,
        variance,
      },
    });

    await this.eventsService.publish(SalesEvent.CASH_CLOSING_CLOSED, {
      closingId: saved.id,
      reference: saved.reference,
      openingBalance,
      totalEntries: totals.totalEntries,
      totalExits: totals.totalExits,
      theoreticalBalance,
      actualBalance: dto.actualBalance,
      variance,
      closedById: user.id,
    });

    if (Math.abs(variance) > threshold) {
      await this.eventsService.publish(SalesEvent.CASH_CLOSING_VARIANCE_ALERT, {
        closingId: saved.id,
        reference: saved.reference,
        variance,
        threshold,
        comment: dto.comment,
        closedById: user.id,
      });
    }

    // Auto-post unposted accounting entries to ERP on cash closing
    try {
      const erpSetting = await this.erpSettingsService.findActive(user.tenantId);
      if (erpSetting?.autoPostOnClosing && erpSetting.isActive) {
        const erpResult = await this.sageErpService.postAllUnposted(user.tenantId);
        this.logger.log(
          `Auto-post ERP on closing: ${erpResult.entriesPosted} entries (${erpResult.message})`,
        );
      }
    } catch (erpErr) {
      this.logger.error(`Auto-post ERP on closing failed (non-blocking): ${erpErr}`);
    }

    return this.toResponseDto(saved);
  }

  /* ─── History (paginated) ─── */
  async findAll(tenantId: string, query: ListCashClosingsQueryDto) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);

    const qb = closingRepo.createQueryBuilder('cc');

    qb.andWhere('cc.cash_type = :cashType', { cashType: this.CASH_TYPE });

    if (query.status) {
      qb.andWhere('cc.status = :status', { status: query.status });
    }
    if (query.dateFrom) {
      qb.andWhere('cc.opened_at >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('cc.opened_at <= :dateTo', { dateTo: query.dateTo });
    }

    const allowedSort = ['openedAt', 'closedAt', 'variance', 'reference'];
    const sortBy = allowedSort.includes(query.sortBy || '') ? query.sortBy! : 'openedAt';
    const sortOrder = query.sortOrder || 'DESC';
    qb.orderBy(`cc.${sortBy}`, sortOrder);

    qb.skip((page - 1) * perPage).take(perPage);
    const [items, total] = await qb.getManyAndCount();

    return {
      data: items.map((cc) => this.toResponseDto(cc)),
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

  /* ─── Check if yesterday was closed (used by guard) ─── */
  async isYesterdayClosed(tenantId: string): Promise<boolean> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterdayClosing = await closingRepo
      .createQueryBuilder('cc')
      .where('cc.cash_type = :cashType', { cashType: this.CASH_TYPE })
      .andWhere('cc.opened_at >= :yesterday', { yesterday })
      .andWhere('cc.opened_at < :today', { today })
      .getOne();

    if (!yesterdayClosing) return true;
    return yesterdayClosing.status === CashDayStatus.CLOSED;
  }

  /* ─── Cron: reminder at configurable hour if register not closed ─── */
  // TODO: This cron needs tenantId to iterate all tenants — skipped for schema-per-tenant migration
  @Cron('0 * * * *')
  async sendReminderIfNotClosed() {
    this.logger.log('Cash closing reminder cron: skipped — requires per-tenant iteration (TODO)');
  }

  /* ─── Private helpers ─── */
  private async ensureYesterdayClosed(tenantId: string): Promise<void> {
    const closed = await this.isYesterdayClosed(tenantId);
    if (!closed) {
      throw new BadRequestException(
        "La clôture de la veille n'a pas été effectuée. Veuillez d'abord clôturer la caisse précédente.",
      );
    }
  }

  private async calculateTotals(
    tenantId: string,
    since: Date,
  ): Promise<{ totalEntries: number; totalExits: number }> {
    const ds = await this.tenantDsService.getDataSource(tenantId);

    // Entries = sum of CASH payments received since register opened
    const entryResult = await ds.getRepository(Payment)
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .where('p.payment_method = :method', { method: PaymentMethod.CASH })
      .andWhere('p.created_at >= :since', { since })
      .getRawOne();

    const totalEntries = parseFloat(entryResult?.total ?? '0');

    // Exits: in sales context, exits = 0 (change/refunds not tracked yet)
    const totalExits = 0;

    return { totalEntries, totalExits };
  }

  private toResponseDto(closing: CashDay) {
    return {
      id: closing.id,
      reference: closing.reference,
      status: closing.status,
      openingBalance: Number(closing.openingBalance),
      totalEntries: Number(closing.totalEntries),
      totalExits: Number(closing.totalExits),
      theoreticalBalance: Number(closing.theoreticalBalance),
      actualBalance: closing.actualBalance != null ? Number(closing.actualBalance) : null,
      variance: Number(closing.variance),
      comment: closing.comment,
      openedById: closing.openedById,
      closedById: closing.closedById,
      openedAt: closing.openedAt,
      closedAt: closing.closedAt,
    };
  }
}
