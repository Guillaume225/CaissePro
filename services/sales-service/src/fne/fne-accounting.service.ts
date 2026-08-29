import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { FneAccountingEntry } from '../entities/fne-accounting-entry.entity';
import { FneInvoice } from '../entities/fne-invoice.entity';
import { FneClient } from '../entities/fne-client.entity';
import { FneProduct } from '../entities/fne-product.entity';
import { FneSetting } from '../entities/fne-setting.entity';
import { FneInvoiceStatus, FneInvoiceType } from '../entities/enums';
import { SageErpService } from '../erp/sage-erp.service';
import { ErpSettingsService } from '../erp/erp-settings.service';
import { TenantDataSourceService } from '../tenant/tenant-datasource.service';

/* ── Default OHADA accounts ── */
const DEFAULT_CLIENT_ACCOUNT = '411000';
const DEFAULT_PRODUCT_ACCOUNT = '701000';
const DEFAULT_VAT_ACCOUNT = '443100';
const DEFAULT_JOURNAL_SALES = 'VF'; // Ventes Facturées
const DEFAULT_JOURNAL_CASH = 'CA'; // Caisse

export interface ListFneAccountingQuery {
  page?: number;
  perPage?: number;
  dateFrom?: string;
  dateTo?: string;
  invoiceReference?: string;
}

export interface GenerateEntriesDto {
  invoiceIds: string[];
}

@Injectable()
export class FneAccountingService {
  private readonly logger = new Logger(FneAccountingService.name);

  constructor(
    private readonly tenantDsService: TenantDataSourceService,
    private readonly sageErpService: SageErpService,
    private readonly erpSettingsService: ErpSettingsService,
  ) {}

  /**
   * Generate accounting entries for a list of certified invoices.
   * Each invoice creates 2-3 lines:
   *   1. Débit Client (411xxx)  = TTC
   *   2. Crédit Ventes (701xxx) = HT
   *   3. Crédit TVA (443xxx)    = TVA (if > 0)
   *
   * For credit notes, debits/credits are reversed by default. If the active
   * FNE setting has creditNoteSameSense enabled, credit notes instead keep the
   * same debit/credit column as the original invoice, with a negative amount.
   */
  async generate(
    tenantId: string,
    dto: GenerateEntriesDto,
    userId: string,
  ): Promise<{ generated: number; skipped: number; errors: string[] }> {
    if (!dto.invoiceIds?.length) {
      throw new BadRequestException('Aucune facture sélectionnée');
    }
    if (dto.invoiceIds.length > 500) {
      throw new BadRequestException('Maximum 500 factures à la fois');
    }

    const ds = await this.tenantDsService.getDataSource(tenantId);
    const entryRepo = ds.getRepository(FneAccountingEntry);
    const invoiceRepo = ds.getRepository(FneInvoice);
    const clientRepo = ds.getRepository(FneClient);
    const productRepo = ds.getRepository(FneProduct);
    const settingRepo = ds.getRepository(FneSetting);

    // Load journal codes from settings (first active setting found)
    const setting = await settingRepo.findOne({ where: { isActive: true } });
    const journalSales = setting?.journalSales ?? DEFAULT_JOURNAL_SALES;
    const journalCash = setting?.journalCash ?? DEFAULT_JOURNAL_CASH;
    const creditNoteSameSense = setting?.creditNoteSameSense ?? false;

    const invoices = await invoiceRepo.find({
      where: { id: In(dto.invoiceIds) },
      relations: ['items'],
    });

    // Pre-fetch all clients and products for account codes
    const allClients = await clientRepo.find({ where: { isActive: true } });
    const allProducts = await productRepo.find({ where: { isActive: true } });
    const clientByPhone = new Map(allClients.map((c) => [c.phone, c]));
    const clientByName = new Map(allClients.map((c) => [c.companyName, c]));
    const productByRef = new Map(
      allProducts.filter((p) => p.reference).map((p) => [p.reference!, p]),
    );
    const productByDesc = new Map(allProducts.map((p) => [p.description, p]));

    // Check which invoices already have entries
    const existingInvoiceIds = new Set(
      (
        await entryRepo
          .createQueryBuilder('e')
          .select('DISTINCT e.invoiceId', 'invoiceId')
          .where('e.invoiceId IN (:...ids)', { ids: dto.invoiceIds })
          .getRawMany()
      ).map((r: { invoiceId: string }) => r.invoiceId),
    );

    let generated = 0;
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const invoice of invoices) {
      // Skip if not certified or credit_note
      if (
        invoice.status !== FneInvoiceStatus.CERTIFIED &&
        invoice.status !== FneInvoiceStatus.CREDIT_NOTE
      ) {
        errors.push(
          `${invoice.reference ?? invoice.id}: statut ${invoice.status} — seules les factures certifiées sont prises en charge`,
        );
        continue;
      }

      // Skip if already processed
      if (existingInvoiceIds.has(invoice.id)) {
        skipped.push(invoice.reference ?? invoice.id);
        continue;
      }

      const isCreditNote = invoice.invoiceType === FneInvoiceType.CREDIT_NOTE;
      const opType = isCreditNote ? 'CREDIT_NOTE' : 'SALE';
      const entryDate = invoice.updatedAt ?? invoice.createdAt;
      const ref = invoice.reference ?? invoice.id;

      // Determine journal code based on payment method
      const isCashPayment = invoice.paymentMethod === 'cash';
      const journalCode = isCashPayment ? journalCash : journalSales;

      // Find client account code
      const matchedClient =
        clientByPhone.get(invoice.clientPhone) ?? clientByName.get(invoice.clientCompanyName);
      const clientAccount = matchedClient?.accountCode ?? DEFAULT_CLIENT_ACCOUNT;
      const clientLabel = `Client – ${invoice.clientCompanyName}`;

      // Compute per-item product totals and VAT totals
      let totalHt = 0;
      let totalVat = 0;
      const productEntries: { account: string; label: string; amount: number }[] = [];
      const vatEntries: { account: string; label: string; amount: number }[] = [];

      for (const item of invoice.items) {
        const ht = Number(item.lineTotalHt) || 0;
        const vat = Number(item.lineVat) || 0;
        totalHt += ht;
        totalVat += vat;

        // Find matching product for account codes
        const matchedProduct =
          (item.reference ? productByRef.get(item.reference) : null) ??
          productByDesc.get(item.description);
        const productAccount = matchedProduct?.accountCode ?? DEFAULT_PRODUCT_ACCOUNT;

        // Accumulate by product account
        const existingProd = productEntries.find((e) => e.account === productAccount);
        if (existingProd) {
          existingProd.amount += ht;
        } else {
          productEntries.push({
            account: productAccount,
            label: `Vente – ${item.description}`,
            amount: ht,
          });
        }

        // VAT entry (only for non-zero taxes)
        if (vat > 0) {
          const vatAccount = matchedProduct?.vatAccountCode ?? DEFAULT_VAT_ACCOUNT;
          const existingVat = vatEntries.find((e) => e.account === vatAccount);
          if (existingVat) {
            existingVat.amount += vat;
          } else {
            const taxLabel = (item.taxes ?? []).join(', ') || 'TVA';
            vatEntries.push({ account: vatAccount, label: `${taxLabel} collectée`, amount: vat });
          }
        }
      }

      const ttc = Number(invoice.totalTtc) || totalHt + totalVat;
      const entries: Partial<FneAccountingEntry>[] = [];

      // Line 1: Débit Client = TTC (or Crédit for credit note, unless same-sense mode)
      const clientAmounts = this.creditNoteAmounts(ttc, 0, isCreditNote, creditNoteSameSense);
      entries.push({
        invoiceId: invoice.id,
        invoiceReference: ref,
        journalCode,
        entryDate,
        accountNumber: clientAccount,
        accountLabel: clientLabel,
        debit: clientAmounts.debit,
        credit: clientAmounts.credit,
        label: `${isCreditNote ? 'Avoir' : 'Facture'} ${ref} – ${invoice.clientCompanyName}`,
        operationType: opType,
        createdBy: userId,
      });

      // Line 2+: Crédit Ventes HT (grouped by account) — or Débit for credit note, unless same-sense mode
      for (const pe of productEntries) {
        const amounts = this.creditNoteAmounts(0, pe.amount, isCreditNote, creditNoteSameSense);
        entries.push({
          invoiceId: invoice.id,
          invoiceReference: ref,
          journalCode,
          entryDate,
          accountNumber: pe.account,
          accountLabel: pe.label,
          debit: amounts.debit,
          credit: amounts.credit,
          label: `${isCreditNote ? 'Avoir' : 'Facture'} ${ref} – Vente HT`,
          operationType: opType,
          createdBy: userId,
        });
      }

      // Line 3+: Crédit TVA (if any) — or Débit for credit note, unless same-sense mode
      for (const ve of vatEntries) {
        const amounts = this.creditNoteAmounts(0, ve.amount, isCreditNote, creditNoteSameSense);
        entries.push({
          invoiceId: invoice.id,
          invoiceReference: ref,
          journalCode,
          entryDate,
          accountNumber: ve.account,
          accountLabel: ve.label,
          debit: amounts.debit,
          credit: amounts.credit,
          label: `${isCreditNote ? 'Avoir' : 'Facture'} ${ref} – ${ve.label}`,
          operationType: opType,
          createdBy: userId,
        });
      }

      await entryRepo.save(entries.map((e) => entryRepo.create(e)));
      generated++;
    }

    // Auto-post to ERP if configured
    if (generated > 0) {
      try {
        const erpSetting = await this.erpSettingsService.findActive(tenantId);
        if (erpSetting?.autoPostOnCertify || erpSetting?.autoPostOnClosing) {
          const successIds = invoices
            .filter((inv) => !existingInvoiceIds.has(inv.id))
            .map((inv) => inv.id);
          if (successIds.length) {
            const erpResult = await this.sageErpService.postEntries(tenantId, successIds);
            this.logger.log(
              `Auto-post ERP: ${erpResult.entriesPosted} entries posted (${erpResult.message})`,
            );
          }
        }
      } catch (erpErr) {
        this.logger.error(`Auto-post ERP failed (non-blocking): ${erpErr}`);
        // Non-blocking — entries are saved, ERP post failed but can be retried
      }
    }

    return { generated, skipped: skipped.length, errors };
  }

  /**
   * Resolve the debit/credit for a line given its normal (sale) amounts.
   * - Sale: unchanged.
   * - Credit note, default: debit and credit swapped.
   * - Credit note, same-sense: same column as the sale, amount negated.
   */
  private creditNoteAmounts(
    normalDebit: number,
    normalCredit: number,
    isCreditNote: boolean,
    sameSense: boolean,
  ): { debit: number; credit: number } {
    if (!isCreditNote) return { debit: normalDebit, credit: normalCredit };
    if (sameSense) {
      return {
        debit: normalDebit ? -normalDebit : 0,
        credit: normalCredit ? -normalCredit : 0,
      };
    }
    return { debit: normalCredit, credit: normalDebit };
  }

  /**
   * Delete the (un-generated-to-ERP) entries for an invoice.
   * Entries already posted to Sage are never deleted — use reverseAllPosted
   * to cancel them via a proper accounting contre-passation instead.
   */
  async deleteByInvoice(
    tenantId: string,
    invoiceId: string,
  ): Promise<{ deleted: number; protected: number }> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const entryRepo = ds.getRepository(FneAccountingEntry);
    const all = await entryRepo.find({ where: { invoiceId } });
    if (!all.length) throw new NotFoundException('Aucune écriture pour cette facture');

    const deletable = all.filter((e) => !e.erpPosted);
    const protectedCount = all.length - deletable.length;
    if (deletable.length) {
      await entryRepo.delete({ id: In(deletable.map((e) => e.id)) });
    }
    return { deleted: deletable.length, protected: protectedCount };
  }

  /**
   * Delete all non-posted accounting entries.
   * Entries already posted to Sage are never deleted — use reverseAllPosted
   * to cancel them via a proper accounting contre-passation instead.
   */
  async deleteAll(tenantId: string): Promise<{ deleted: number; protected: number }> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const entryRepo = ds.getRepository(FneAccountingEntry);
    const total = await entryRepo.count();
    if (total === 0) throw new NotFoundException('Aucune écriture à supprimer');

    const protectedCount = await entryRepo.count({ where: { erpPosted: true } });
    const deleted = total - protectedCount;
    if (deleted === 0) {
      throw new BadRequestException(
        'Toutes les écritures ont déjà été envoyées à Sage — utilisez la contre-passation pour les annuler.',
      );
    }
    await entryRepo.delete({ erpPosted: false });
    return { deleted, protected: protectedCount };
  }

  /** Count of posted entries that can still be reversed (not already reversed). */
  async countReversible(tenantId: string): Promise<{ count: number }> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const entryRepo = ds.getRepository(FneAccountingEntry);
    const count = await entryRepo.count({ where: { erpPosted: true, reversed: false } });
    return { count };
  }

  /**
   * Cancel entries already posted to Sage via a proper accounting contre-passation:
   * generates new entries with debit/credit swapped (same account, opposite sense)
   * instead of deleting the originals. The reversal entries themselves are NOT
   * posted to Sage yet — post them via the normal "Comptabiliser dans Sage" action.
   */
  async reverseAllPosted(
    tenantId: string,
    userId: string,
  ): Promise<{ reversed: number; invoicesAffected: number }> {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const entryRepo = ds.getRepository(FneAccountingEntry);

    const toReverse = await entryRepo.find({ where: { erpPosted: true, reversed: false } });
    if (!toReverse.length) {
      throw new NotFoundException('Aucune écriture envoyée à Sage à contre-passer');
    }

    const now = new Date();
    const reversalEntries = toReverse.map((original) =>
      entryRepo.create({
        invoiceId: original.invoiceId,
        invoiceReference: original.invoiceReference,
        journalCode: original.journalCode,
        entryDate: now,
        accountNumber: original.accountNumber,
        accountLabel: original.accountLabel,
        debit: original.credit,
        credit: original.debit,
        label: `Contre-passation – ${original.label}`,
        operationType: 'REVERSAL',
        createdBy: userId,
        reversalOfEntryId: original.id,
      }),
    );
    await entryRepo.save(reversalEntries);

    await entryRepo.update(
      { id: In(toReverse.map((e) => e.id)) },
      { reversed: true, reversedAt: now },
    );

    const invoicesAffected = new Set(toReverse.map((e) => e.invoiceId)).size;
    return { reversed: reversalEntries.length, invoicesAffected };
  }

  /** List entries with pagination + filters */
  async findAll(tenantId: string, query: ListFneAccountingQuery) {
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const entryRepo = ds.getRepository(FneAccountingEntry);

    const page = Math.max(Number(query.page) || 1, 1);
    const perPage = Math.min(Math.max(Number(query.perPage) || 50, 1), 200);
    const skip = (page - 1) * perPage;

    const qb = entryRepo.createQueryBuilder('e');

    if (query.dateFrom) {
      qb.andWhere('e.entryDate >= :from', { from: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('e.entryDate <= :to', { to: query.dateTo });
    }
    if (query.invoiceReference) {
      qb.andWhere('e.invoiceReference LIKE :ref', { ref: `%${query.invoiceReference}%` });
    }

    qb.orderBy('e.entryDate', 'DESC')
      .addOrderBy('e.invoiceReference', 'ASC')
      .addOrderBy('e.debit', 'DESC')
      .skip(skip)
      .take(perPage);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) } };
  }

  /** Get invoice IDs that already have entries */
  async getProcessedInvoiceIds(tenantId: string, invoiceIds: string[]): Promise<string[]> {
    if (!invoiceIds.length) return [];
    const ds = await this.tenantDsService.getDataSource(tenantId);
    const rows = await ds.getRepository(FneAccountingEntry)
      .createQueryBuilder('e')
      .select('DISTINCT e.invoiceId', 'invoiceId')
      .where('e.invoiceId IN (:...ids)', { ids: invoiceIds })
      .getRawMany();
    return rows.map((r: { invoiceId: string }) => r.invoiceId);
  }
}
