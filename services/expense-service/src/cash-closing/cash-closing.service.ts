import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { In } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { CashDay } from '../entities/cash-day.entity';
import { CashMovement } from '../entities/cash-movement.entity';
import { Expense } from '../entities/expense.entity';
import { User } from '../entities/user.entity';
import { CashDayStatus, CashType, ExpenseStatus } from '../entities/enums';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { EventsService, ExpenseEvent } from '../events/events.service';
import { OpenCashClosingDto, CloseCashClosingDto, ListCashClosingsQueryDto } from './dto';
import { TenantDataSourceService, tenantSchema } from '../tenant/tenant-datasource.service';

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
  ) {}

  private readonly CASH_TYPE = CashType.EXPENSE;

  /* ─── Reference generation: CLD-YYYY-NNNNN ─── */
  private async generateReference(tenantId: string): Promise<string> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const year = new Date().getFullYear();
    const prefix = `CLD-${year}-`;
    const last = await closingRepo
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
      where: {
        status: In([CashDayStatus.OPEN, CashDayStatus.PENDING_CLOSE]),
        cashType: this.CASH_TYPE,
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Une caisse est déjà ouverte (${existing.reference}). Veuillez la clôturer d'abord.`,
      );
    }

    await this.ensureYesterdayClosed(user.tenantId);

    let openingBalance = dto.openingBalance ?? 0;
    const lastClosed = await closingRepo.findOne({
      where: { status: CashDayStatus.CLOSED, cashType: this.CASH_TYPE },
      order: { reference: 'DESC' },
    });
    if (lastClosed && lastClosed.actualBalance != null) {
      openingBalance = Number(lastClosed.actualBalance);
      this.logger.log(
        `Héritage solde: ${lastClosed.reference} actualBalance=${lastClosed.actualBalance} → openingBalance=${openingBalance}`,
      );
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

    await this.rolloverPendingExpenses(user.tenantId, saved.id);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.CASH_CLOSING_OPEN,
      entityType: 'cash_closing',
      entityId: saved.id,
      newValue: { reference, openingBalance },
    });

    await this.eventsService.publish(ExpenseEvent.CASH_CLOSING_OPENED, {
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
      where: {
        status: In([CashDayStatus.OPEN, CashDayStatus.PENDING_CLOSE]),
        cashType: this.CASH_TYPE,
      },
    });
    if (!current) {
      throw new NotFoundException('Aucune caisse ouverte actuellement.');
    }

    const totals = await this.calculateTotals(tenantId, current.id);
    current.totalExits = totals.totalExits;
    current.totalEntries = totals.totalEntries;
    current.theoreticalBalance =
      Number(current.openingBalance) + totals.totalEntries - totals.totalExits;

    return this.toResponseDto(current);
  }

  /* ─── Lock cash register for closing (cashier action) ─── */
  async lockForClose(user: CashClosingUser) {
    const ds = await this.tenantDsService.getDataSource(user.tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const current = await closingRepo.findOne({
      where: { status: CashDayStatus.OPEN, cashType: this.CASH_TYPE },
    });
    if (!current) {
      throw new NotFoundException('Aucune caisse ouverte à fermer.');
    }

    current.status = CashDayStatus.PENDING_CLOSE;
    const saved = await closingRepo.save(current);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.CASH_CLOSING_LOCK,
      entityType: 'cash_closing',
      entityId: saved.id,
      newValue: { reference: saved.reference, status: 'PENDING_CLOSE' },
    });

    return { data: this.toResponseDto(saved) };
  }

  /* ─── Unlock cash register (cancel lock) ─── */
  async unlock(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const current = await closingRepo.findOne({
      where: { status: CashDayStatus.PENDING_CLOSE, cashType: this.CASH_TYPE },
    });
    if (!current) {
      throw new NotFoundException('Aucune caisse en attente de clôture.');
    }

    current.status = CashDayStatus.OPEN;
    const saved = await closingRepo.save(current);

    return { data: this.toResponseDto(saved) };
  }

  /* ─── Close cash register ─── */
  async close(dto: CloseCashClosingDto, user: CashClosingUser) {
    const ds = await this.tenantDsService.getDataSource(user.tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const current = await closingRepo.findOne({
      where: { status: CashDayStatus.PENDING_CLOSE, cashType: this.CASH_TYPE },
    });
    if (!current) {
      throw new BadRequestException(
        'La caisse doit être fermée par la caissière avant de pouvoir être clôturée.',
      );
    }

    const totals = await this.calculateTotals(user.tenantId, current.id);
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

    await this.eventsService.publish(ExpenseEvent.CASH_CLOSING_CLOSED, {
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
      await this.eventsService.publish(ExpenseEvent.CASH_CLOSING_VARIANCE_ALERT, {
        closingId: saved.id,
        reference: saved.reference,
        variance,
        threshold,
        comment: dto.comment,
        closedById: user.id,
      });
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

    if (query.status && query.status.length > 0) {
      qb.andWhere('cc.status IN (:...statuses)', { statuses: query.status });
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

    const activeCashDay = await closingRepo.findOne({
      where: {
        cashType: this.CASH_TYPE,
        status: In([CashDayStatus.OPEN, CashDayStatus.PENDING_CLOSE]),
      },
    });
    if (activeCashDay) return true;

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
  // TODO: This Cron method requires iterating over all tenants.
  // Implement tenant-aware scheduling once a tenant registry is available.
  @Cron('0 * * * *')
  async sendReminderIfNotClosed() {
    this.logger.warn(
      'sendReminderIfNotClosed Cron skipped — tenant-aware scheduling not yet implemented',
    );
  }

  /* ─── State (for frontend CashRegisterState) ─── */
  async getState(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const schema = tenantSchema(tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const current = await closingRepo.findOne({
      where: {
        status: In([CashDayStatus.OPEN, CashDayStatus.PENDING_CLOSE]),
        cashType: this.CASH_TYPE,
      },
    });

    if (!current) {
      return {
        data: {
          status: 'CLOSED',
          openingBalance: 0,
          theoreticalBalance: 0,
          todayEntries: 0,
          todayExits: 0,
          todayPaymentsReceived: 0,
          totalEntries: 0,
          totalExits: 0,
          movementsCount: 0,
        },
      };
    }

    const totals = await this.calculateTotals(tenantId, current.id);

    const [mvtRow] = await ds.query(
      `SELECT COUNT(*) AS cnt FROM [${schema}].[cash_movements] WHERE cash_day_id = @0`,
      [current.id],
    );

    const [paymentsRow] = await ds.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM [${schema}].[payments] WHERE CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)`,
    ).catch(() => [{ total: 0 }]);

    const openingBalance = Number(current.openingBalance);
    const totalEntries = totals.totalEntries;
    const totalExits = totals.totalExits;

    let openedByName = current.openedById;
    try {
      const userRepo = ds.getRepository(User);
      const userRow = await userRepo.findOne({ where: { id: current.openedById } });
      if (userRow) {
        openedByName = `${userRow.firstName} ${userRow.lastName}`.trim();
      }
    } catch {
      /* fallback to UUID */
    }

    return {
      data: {
        status: current.status,
        cashDayId: current.id,
        openedAt: current.openedAt,
        openedBy: openedByName,
        reference: current.reference,
        openingBalance,
        theoreticalBalance: openingBalance + totalEntries - totalExits,
        todayEntries: totals.totalEntries,
        todayExits: totals.totalExits,
        todayPaymentsReceived: Number(paymentsRow?.total ?? 0),
        totalEntries,
        totalExits,
        movementsCount: Number(mvtRow?.cnt ?? 0),
      },
    };
  }

  /* ─── Operations (cash movements for the open day) ─── */
  async getOperations(tenantId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const schema = tenantSchema(tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const current = await closingRepo.findOne({
      where: {
        status: In([CashDayStatus.OPEN, CashDayStatus.PENDING_CLOSE]),
        cashType: this.CASH_TYPE,
      },
    });

    if (!current) {
      return { data: [] };
    }

    const movements = await ds.query(
      `SELECT m.id, m.cash_day_id AS cashDayId, @1 AS cashDayRef,
              m.created_at AS time, m.type, m.category, m.reference,
              m.description, m.amount
       FROM [${schema}].[cash_movements] m
       WHERE m.cash_day_id = @0
       ORDER BY m.created_at DESC`,
      [current.id, current.reference],
    );

    return {
      data: movements.map((m: Record<string, unknown>) => ({
        ...m,
        amount: Number(m.amount),
      })),
    };
  }

  /* ─── Add a cash movement ─── */
  async addMovement(
    dto: {
      type: string;
      category: string;
      amount: number;
      reference?: string;
      description: string;
    },
    user: CashClosingUser,
  ) {
    const ds = await this.tenantDsService.getDataSource(user.tenantId);
    const schema = tenantSchema(user.tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const current = await closingRepo.findOne({
      where: { status: CashDayStatus.OPEN, cashType: this.CASH_TYPE },
    });
    if (!current) {
      throw new BadRequestException(
        "Impossible d'ajouter un mouvement. La caisse est fermée ou en attente de clôture.",
      );
    }

    const [row] = await ds.query(
      `INSERT INTO [${schema}].[cash_movements] (id, cash_day_id, type, category, amount, reference, description, created_by, created_at)
       OUTPUT INSERTED.*
       VALUES (NEWID(), @0, @1, @2, @3, @4, @5, @6, GETDATE())`,
      [
        current.id,
        dto.type,
        dto.category,
        dto.amount,
        dto.reference || null,
        dto.description,
        user.id,
      ],
    );

    if (dto.type === 'ENTRY') {
      current.totalEntries = Number(current.totalEntries) + dto.amount;
    } else {
      current.totalExits = Number(current.totalExits) + dto.amount;
    }
    current.theoreticalBalance =
      Number(current.openingBalance) + Number(current.totalEntries) - Number(current.totalExits);
    await closingRepo.save(current);

    return {
      data: {
        id: row.id,
        cashDayId: current.id,
        cashDayRef: current.reference,
        time: row.created_at,
        type: row.type,
        category: row.category,
        reference: row.reference,
        description: row.description,
        amount: Number(row.amount),
      },
    };
  }

  /* ─── Accounting entries from closed cash days ─── */
  async getAccountingEntries(tenantId: string, cashDayId?: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const schema = tenantSchema(tenantId);
    const closingRepo = ds.getRepository(CashDay);

    let cashDay: CashDay | null = null;

    if (cashDayId) {
      cashDay = await closingRepo.findOne({
        where: { id: cashDayId, cashType: this.CASH_TYPE },
      });
      if (!cashDay) {
        throw new NotFoundException(`Journée de caisse introuvable (${cashDayId}).`);
      }
    } else {
      cashDay = await closingRepo.findOne({
        where: {
          status: In([CashDayStatus.OPEN, CashDayStatus.PENDING_CLOSE]),
          cashType: this.CASH_TYPE,
        },
      });
      if (!cashDay) {
        cashDay = await closingRepo.findOne({
          where: { status: CashDayStatus.CLOSED, cashType: this.CASH_TYPE },
          order: { closedAt: 'DESC' },
        });
      }
    }

    if (!cashDay) {
      return {
        data: {
          date: new Date().toISOString().slice(0, 10),
          totalDebit: 0,
          totalCredit: 0,
          entriesCount: 0,
          isBalanced: true,
          entries: [],
        },
      };
    }

    const entryDate = (cashDay.closedAt ?? cashDay.openedAt ?? new Date())
      .toISOString()
      .slice(0, 10);
    const entries: Array<{ debit: number; credit: number; [key: string]: unknown }> = [];

    const expenses = await ds.query(
      `SELECT e.id, e.reference, e.amount,
              ec.name AS category_name,
              ec.accounting_debit_account,
              ec.accounting_credit_account
       FROM [${schema}].[expenses] e
       LEFT JOIN [${schema}].[expense_categories] ec ON ec.id = e.category_id
       WHERE e.status = 'PAID' AND e.cash_day_id = @0`,
      [cashDay.id],
    );

    for (const exp of expenses) {
      const debitAccount = exp.accounting_debit_account || '601000';
      const creditAccount = exp.accounting_credit_account || '571000';
      const categoryName = exp.category_name || 'Charges diverses';
      const amount = Number(exp.amount);

      entries.push({
        id: `ACC-E-${exp.id.slice(0, 8)}`,
        date: entryDate,
        journalCode: 'CA',
        accountNumber: debitAccount,
        accountLabel: categoryName,
        entryType: 'DEBIT',
        debit: amount,
        credit: 0,
        reference: exp.reference,
        label: `Dépense ${exp.reference} – ${categoryName}`,
        operationType: 'EXPENSE',
      });

      entries.push({
        id: `ACC-E-${exp.id.slice(0, 8)}-C`,
        date: entryDate,
        journalCode: 'CA',
        accountNumber: creditAccount,
        accountLabel: 'Caisse',
        entryType: 'CREDIT',
        debit: 0,
        credit: amount,
        reference: exp.reference,
        label: `Dépense ${exp.reference} – ${categoryName}`,
        operationType: 'EXPENSE',
      });
    }

    if (
      cashDay.status === CashDayStatus.CLOSED &&
      cashDay.variance &&
      Math.abs(Number(cashDay.variance)) > 0.01
    ) {
      const variance = Number(cashDay.variance);
      if (variance > 0) {
        entries.push({
          id: `ACC-GAP-${cashDay.id.slice(0, 8)}`,
          date: entryDate,
          journalCode: 'CA',
          accountNumber: '571000',
          accountLabel: 'Caisse',
          entryType: 'DEBIT',
          debit: variance,
          credit: 0,
          reference: cashDay.reference,
          label: `Écart de caisse (excédent) – ${cashDay.reference}`,
          operationType: 'CLOSING_GAP',
        });
        entries.push({
          id: `ACC-GAP-${cashDay.id.slice(0, 8)}-C`,
          date: entryDate,
          journalCode: 'CA',
          accountNumber: '758000',
          accountLabel: 'Produits divers de gestion',
          entryType: 'CREDIT',
          debit: 0,
          credit: variance,
          reference: cashDay.reference,
          label: `Écart de caisse (excédent) – ${cashDay.reference}`,
          operationType: 'CLOSING_GAP',
        });
      } else {
        entries.push({
          id: `ACC-GAP-${cashDay.id.slice(0, 8)}`,
          date: entryDate,
          journalCode: 'CA',
          accountNumber: '658000',
          accountLabel: 'Charges diverses de gestion',
          entryType: 'DEBIT',
          debit: Math.abs(variance),
          credit: 0,
          reference: cashDay.reference,
          label: `Écart de caisse (déficit) – ${cashDay.reference}`,
          operationType: 'CLOSING_GAP',
        });
        entries.push({
          id: `ACC-GAP-${cashDay.id.slice(0, 8)}-C`,
          date: entryDate,
          journalCode: 'CA',
          accountNumber: '571000',
          accountLabel: 'Caisse',
          entryType: 'CREDIT',
          debit: 0,
          credit: Math.abs(variance),
          reference: cashDay.reference,
          label: `Écart de caisse (déficit) – ${cashDay.reference}`,
          operationType: 'CLOSING_GAP',
        });
      }
    }

    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

    return {
      data: {
        date: entryDate,
        cashDayId: cashDay.id,
        cashDayReference: cashDay.reference,
        cashDayStatus: cashDay.status,
        accountingProcessed: !!cashDay.accountingProcessed,
        accountingProcessedAt: cashDay.accountingProcessedAt,
        sagePosted: !!cashDay.sagePosted,
        sagePostedAt: cashDay.sagePostedAt,
        totalDebit,
        totalCredit,
        entriesCount: entries.length,
        isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
        entries,
      },
    };
  }

  /* ─── Mark accounting entries as processed ─── */
  async processAccountingEntries(tenantId: string, cashDayId: string, user: CashClosingUser) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const cashDay = await closingRepo.findOne({
      where: { id: cashDayId, cashType: this.CASH_TYPE },
    });
    if (!cashDay) {
      throw new NotFoundException(`Journée de caisse introuvable (${cashDayId}).`);
    }
    if (cashDay.status !== CashDayStatus.CLOSED) {
      throw new BadRequestException(
        'Seules les journées clôturées peuvent être traitées comptablement.',
      );
    }
    if (cashDay.accountingProcessed) {
      throw new BadRequestException(
        'Les écritures comptables de cette journée ont déjà été traitées. Annulez le traitement pour retraiter.',
      );
    }

    cashDay.accountingProcessed = true;
    cashDay.accountingProcessedAt = new Date();
    cashDay.accountingProcessedBy = user.id;
    await closingRepo.save(cashDay);

    const sageResult = await this.sendEntriesToSage(tenantId, cashDayId);

    return {
      data: {
        success: true,
        message: 'Écritures comptables traitées avec succès.',
        sage: sageResult,
      },
    };
  }

  /** Standalone Sage posting — can be called independently from process */
  async postAccountingToSage(tenantId: string, cashDayId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const cashDay = await closingRepo.findOne({
      where: { id: cashDayId, cashType: this.CASH_TYPE },
    });
    if (!cashDay) {
      throw new NotFoundException(`Journée de caisse introuvable (${cashDayId}).`);
    }
    if (cashDay.status !== CashDayStatus.CLOSED) {
      throw new BadRequestException(
        'Seules les journées clôturées peuvent être comptabilisées vers Sage.',
      );
    }
    const sageResult = await this.sendEntriesToSage(tenantId, cashDayId);

    if (!sageResult || !sageResult.success) {
      throw new BadRequestException(
        sageResult?.message || "Erreur lors de l'envoi vers Sage.",
      );
    }

    cashDay.sagePosted = true;
    cashDay.sagePostedAt = new Date();
    await closingRepo.save(cashDay);

    return {
      data: {
        success: true,
        message: `${sageResult.entriesPosted ?? 0} écritures envoyées à Sage avec succès.`,
        sage: sageResult,
      },
    };
  }

  private async sendEntriesToSage(
    tenantId: string,
    cashDayId: string,
  ): Promise<{ success: boolean; message: string; entriesPosted: number } | null> {
    let sageResult: { success: boolean; message: string; entriesPosted: number } | null = null;
    try {
      const accountingData = await this.getAccountingEntries(tenantId, cashDayId);
      const entries = accountingData.data?.entries ?? [];

      if (entries.length === 0) {
        return { success: true, message: 'Aucune écriture à envoyer.', entriesPosted: 0 };
      }

      const rawEntries = entries.map((e: any) => ({
        reference: e.reference,
        date: e.date,
        journalCode: e.journalCode,
        pieceType: e.operationType === 'EXPENSE' ? 'EXPENSE' : 'CLOSING',
        label: e.label,
        accountNumber: e.accountNumber,
        auxiliaryAccount: '',
        debit: Number(e.debit) || 0,
        credit: Number(e.credit) || 0,
      }));

      this.logger.log(`[SAGE-CASH] Envoi de ${rawEntries.length} écritures de caisse vers Sage...`);

      const salesServiceUrl = this.configService.get('SALES_SERVICE_URL') || 'http://localhost:3053';
      const response = await fetch(
        `${salesServiceUrl}/api/v1/erp/post-cash-entries`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: rawEntries }),
          signal: AbortSignal.timeout(30000),
        },
      );
      const erpResponse = await response.json();

      sageResult = erpResponse;
      this.logger.log(`[SAGE-CASH] Résultat: ${JSON.stringify(sageResult)}`);
    } catch (erpErr: any) {
      this.logger.error(`[SAGE-CASH] Erreur envoi Sage: ${erpErr?.message || erpErr}`);
      sageResult = { success: false, message: erpErr?.message || 'Erreur Sage', entriesPosted: 0 };
    }
    return sageResult;
  }

  /* ─── Cancel accounting processing ─── */
  async cancelAccountingProcessing(tenantId: string, cashDayId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const cashDay = await closingRepo.findOne({
      where: { id: cashDayId, cashType: this.CASH_TYPE },
    });
    if (!cashDay) {
      throw new NotFoundException(`Journée de caisse introuvable (${cashDayId}).`);
    }
    if (!cashDay.accountingProcessed) {
      throw new BadRequestException("Cette journée n'a pas encore été traitée comptablement.");
    }

    cashDay.accountingProcessed = false;
    cashDay.accountingProcessedAt = null;
    cashDay.accountingProcessedBy = null;
    await closingRepo.save(cashDay);

    return {
      data: {
        success: true,
        message: 'Traitement comptable annulé. Vous pouvez retraiter cette journée.',
      },
    };
  }

  /* ─── Find a specific cash day by ID ─── */
  async findOne(tenantId: string, id: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const closing = await closingRepo.findOne({
      where: { id, cashType: this.CASH_TYPE },
    });
    if (!closing) {
      throw new NotFoundException(`Journée de caisse introuvable (${id}).`);
    }

    const totals = await this.calculateTotals(tenantId, closing.id);
    closing.totalEntries = totals.totalEntries;
    closing.totalExits = totals.totalExits;
    closing.theoreticalBalance =
      Number(closing.openingBalance) + totals.totalEntries - totals.totalExits;

    const userRepo = ds.getRepository(User);
    let openedByName = closing.openedById;
    let closedByName = closing.closedById;

    try {
      const opener = await userRepo.findOne({ where: { id: closing.openedById } });
      if (opener) openedByName = `${opener.firstName} ${opener.lastName}`.trim();
    } catch {
      /* fallback */
    }
    if (closing.closedById) {
      try {
        const closer = await userRepo.findOne({ where: { id: closing.closedById } });
        if (closer) closedByName = `${closer.firstName} ${closer.lastName}`.trim();
      } catch {
        /* fallback */
      }
    }

    return {
      data: {
        ...this.toResponseDto(closing),
        openedByName,
        closedByName,
      },
    };
  }

  /* ─── Get operations/movements for a specific cash day ─── */
  async getOperationsByDay(tenantId: string, cashDayId: string) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const schema = tenantSchema(tenantId);
    const closingRepo = ds.getRepository(CashDay);

    const closing = await closingRepo.findOne({
      where: { id: cashDayId, cashType: this.CASH_TYPE },
    });
    if (!closing) {
      throw new NotFoundException(`Journée de caisse introuvable (${cashDayId}).`);
    }

    const movements = await ds.query(
      `SELECT m.id, m.cash_day_id AS cashDayId, @1 AS cashDayRef,
              m.created_at AS time, m.type, m.category, m.reference,
              m.description, m.amount
       FROM [${schema}].[cash_movements] m
       WHERE m.cash_day_id = @0
       ORDER BY m.created_at DESC`,
      [cashDayId, closing.reference],
    );

    const expenses = await ds.query(
      `SELECT e.id, e.reference, e.amount, e.status, e.beneficiary,
              e.payment_method AS paymentMethod, e.date, e.observations,
              ec.name AS categoryName, ec.direction AS categoryDirection,
              e.created_at AS createdAt
       FROM [${schema}].[expenses] e
       LEFT JOIN [${schema}].[expense_categories] ec ON ec.id = e.category_id
       WHERE e.cash_day_id = @0
       ORDER BY e.created_at DESC`,
      [cashDayId],
    );

    return {
      data: {
        movements: movements.map((m: Record<string, unknown>) => ({
          ...m,
          amount: Number(m.amount),
        })),
        expenses: expenses.map((e: Record<string, unknown>) => ({
          ...e,
          amount: Number(e.amount),
        })),
      },
    };
  }

  private async rolloverPendingExpenses(tenantId: string, newCashDayId: string): Promise<void> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const closingRepo = ds.getRepository(CashDay);
    const expenseRepo = ds.getRepository(Expense);

    const rolloverable = [
      ExpenseStatus.PENDING,
      ExpenseStatus.APPROVED_L1,
      ExpenseStatus.APPROVED_L2,
    ];

    const closedDays = await closingRepo.find({
      where: { status: CashDayStatus.CLOSED, cashType: this.CASH_TYPE },
      select: ['id'],
    });
    if (!closedDays.length) return;

    const closedIds = closedDays.map((d) => d.id);

    const result = await expenseRepo
      .createQueryBuilder()
      .update()
      .set({ cashDayId: newCashDayId })
      .where('cash_day_id IN (:...closedIds)', { closedIds })
      .andWhere('status IN (:...statuses)', { statuses: rolloverable })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(
        `Rollover: ${result.affected} dépense(s) basculée(s) vers la nouvelle journée`,
      );
    }
  }

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
    cashDayId: string,
  ): Promise<{ totalEntries: number; totalExits: number }> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const schema = tenantSchema(tenantId);

    const result = await ds.query(
      `SELECT
         COALESCE(SUM(CASE WHEN COALESCE(ec.direction, 'EXIT') = 'EXIT' THEN e.amount ELSE 0 END), 0) AS totalExits,
         COALESCE(SUM(CASE WHEN ec.direction = 'ENTRY' THEN e.amount ELSE 0 END), 0) AS totalEntries
       FROM [${schema}].[expenses] e
       LEFT JOIN [${schema}].[expense_categories] ec ON ec.id = e.category_id
       WHERE e.status = @0 AND e.cash_day_id = @1`,
      [ExpenseStatus.PAID, cashDayId],
    );

    const row = result?.[0];
    const totalExits = parseFloat(row?.totalExits ?? '0');
    const totalEntries = parseFloat(row?.totalEntries ?? '0');

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
      accountingProcessed: !!closing.accountingProcessed,
      accountingProcessedAt: closing.accountingProcessedAt,
      accountingProcessedBy: closing.accountingProcessedBy,
    };
  }
}
