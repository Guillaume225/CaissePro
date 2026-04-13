import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { FneAccountingEntry } from '../entities/fne-accounting-entry.entity';
import { FneInvoice } from '../entities/fne-invoice.entity';
import { FneClient } from '../entities/fne-client.entity';
import { FneProduct } from '../entities/fne-product.entity';
import { FneSetting } from '../entities/fne-setting.entity';
import { FneInvoiceStatus, FneInvoiceType } from '../entities/enums';

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
    @InjectRepository(FneAccountingEntry)
    private readonly entryRepo: Repository<FneAccountingEntry>,
    @InjectRepository(FneInvoice)
    private readonly invoiceRepo: Repository<FneInvoice>,
    @InjectRepository(FneClient)
    private readonly clientRepo: Repository<FneClient>,
    @InjectRepository(FneProduct)
    private readonly productRepo: Repository<FneProduct>,
    @InjectRepository(FneSetting)
    private readonly settingRepo: Repository<FneSetting>,
  ) {}

  /**
   * Generate accounting entries for a list of certified invoices.
   * Each invoice creates 2-3 lines:
   *   1. Débit Client (411xxx)  = TTC
   *   2. Crédit Ventes (701xxx) = HT
   *   3. Crédit TVA (443xxx)    = TVA (if > 0)
   *
   * For credit notes, debits/credits are reversed.
   */
  async generate(dto: GenerateEntriesDto, userId: string): Promise<{ generated: number; skipped: number; errors: string[] }> {
    if (!dto.invoiceIds?.length) {
      throw new BadRequestException('Aucune facture sélectionnée');
    }
    if (dto.invoiceIds.length > 500) {
      throw new BadRequestException('Maximum 500 factures à la fois');
    }

    // Load journal codes from settings (first active setting found)
    const setting = await this.settingRepo.findOne({ where: { isActive: true } });
    const journalSales = setting?.journalSales ?? DEFAULT_JOURNAL_SALES;
    const journalCash = setting?.journalCash ?? DEFAULT_JOURNAL_CASH;

    const invoices = await this.invoiceRepo.find({
      where: { id: In(dto.invoiceIds) },
      relations: ['items'],
    });

    // Pre-fetch all clients and products for account codes
    const allClients = await this.clientRepo.find({ where: { isActive: true } });
    const allProducts = await this.productRepo.find({ where: { isActive: true } });
    const clientByPhone = new Map(allClients.map((c) => [c.phone, c]));
    const clientByName = new Map(allClients.map((c) => [c.companyName, c]));
    const productByRef = new Map(allProducts.filter((p) => p.reference).map((p) => [p.reference!, p]));
    const productByDesc = new Map(allProducts.map((p) => [p.description, p]));

    // Check which invoices already have entries
    const existingInvoiceIds = new Set(
      (await this.entryRepo
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
      if (invoice.status !== FneInvoiceStatus.CERTIFIED && invoice.status !== FneInvoiceStatus.CREDIT_NOTE) {
        errors.push(`${invoice.reference ?? invoice.id}: statut ${invoice.status} — seules les factures certifiées sont prises en charge`);
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
      const matchedClient = clientByPhone.get(invoice.clientPhone) ?? clientByName.get(invoice.clientCompanyName);
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
        const matchedProduct = (item.reference ? productByRef.get(item.reference) : null) ?? productByDesc.get(item.description);
        const productAccount = matchedProduct?.accountCode ?? DEFAULT_PRODUCT_ACCOUNT;

        // Accumulate by product account
        const existingProd = productEntries.find((e) => e.account === productAccount);
        if (existingProd) {
          existingProd.amount += ht;
        } else {
          productEntries.push({ account: productAccount, label: `Vente – ${item.description}`, amount: ht });
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

      const ttc = Number(invoice.totalTtc) || (totalHt + totalVat);
      const entries: Partial<FneAccountingEntry>[] = [];

      // Line 1: Débit Client = TTC (or Crédit for credit note)
      entries.push({
        invoiceId: invoice.id,
        invoiceReference: ref,
        journalCode,
        entryDate,
        accountNumber: clientAccount,
        accountLabel: clientLabel,
        debit: isCreditNote ? 0 : ttc,
        credit: isCreditNote ? ttc : 0,
        label: `${isCreditNote ? 'Avoir' : 'Facture'} ${ref} – ${invoice.clientCompanyName}`,
        operationType: opType,
        createdBy: userId,
      });

      // Line 2+: Crédit Ventes HT (grouped by account) — or Débit for credit note
      for (const pe of productEntries) {
        entries.push({
          invoiceId: invoice.id,
          invoiceReference: ref,
          journalCode,
          entryDate,
          accountNumber: pe.account,
          accountLabel: pe.label,
          debit: isCreditNote ? pe.amount : 0,
          credit: isCreditNote ? 0 : pe.amount,
          label: `${isCreditNote ? 'Avoir' : 'Facture'} ${ref} – Vente HT`,
          operationType: opType,
          createdBy: userId,
        });
      }

      // Line 3+: Crédit TVA (if any) — or Débit for credit note
      for (const ve of vatEntries) {
        entries.push({
          invoiceId: invoice.id,
          invoiceReference: ref,
          journalCode,
          entryDate,
          accountNumber: ve.account,
          accountLabel: ve.label,
          debit: isCreditNote ? ve.amount : 0,
          credit: isCreditNote ? 0 : ve.amount,
          label: `${isCreditNote ? 'Avoir' : 'Facture'} ${ref} – ${ve.label}`,
          operationType: opType,
          createdBy: userId,
        });
      }

      await this.entryRepo.save(entries.map((e) => this.entryRepo.create(e)));
      generated++;
    }

    return { generated, skipped: skipped.length, errors };
  }

  /** Delete all entries for an invoice (reversal) */
  async deleteByInvoice(invoiceId: string): Promise<void> {
    const exists = await this.entryRepo.findOneBy({ invoiceId });
    if (!exists) throw new NotFoundException('Aucune écriture pour cette facture');
    await this.entryRepo.delete({ invoiceId });
  }

  /** Delete all accounting entries */
  async deleteAll(): Promise<{ deleted: number }> {
    const count = await this.entryRepo.count();
    if (count === 0) throw new NotFoundException('Aucune écriture à supprimer');
    await this.entryRepo.clear();
    return { deleted: count };
  }

  /** List entries with pagination + filters */
  async findAll(query: ListFneAccountingQuery) {
    const page = Math.max(Number(query.page) || 1, 1);
    const perPage = Math.min(Math.max(Number(query.perPage) || 50, 1), 200);
    const skip = (page - 1) * perPage;

    const qb = this.entryRepo.createQueryBuilder('e');

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
  async getProcessedInvoiceIds(invoiceIds: string[]): Promise<string[]> {
    if (!invoiceIds.length) return [];
    const rows = await this.entryRepo
      .createQueryBuilder('e')
      .select('DISTINCT e.invoiceId', 'invoiceId')
      .where('e.invoiceId IN (:...ids)', { ids: invoiceIds })
      .getRawMany();
    return rows.map((r: { invoiceId: string }) => r.invoiceId);
  }
}
