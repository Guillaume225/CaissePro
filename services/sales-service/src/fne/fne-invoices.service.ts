import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FneInvoice } from '../entities/fne-invoice.entity';
import { FneInvoiceItem } from '../entities/fne-invoice-item.entity';
import { FneInvoiceStatus, FneTemplate, FnePaymentMethod, FneTaxCode, FneInvoiceType } from '../entities/enums';
import { FneApiService } from './fne-api.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';

/* ─── Tax rates mapping ─── */
const TAX_RATES: Record<string, number> = {
  TVA: 18,
  TVAB: 9,
  TVAC: 0,
  TVAD: 0,
};

/* ─── DTOs (inline for colocation) ─── */
export interface CreateFneInvoiceItemDto {
  reference?: string;
  description: string;
  quantity: number;
  amount: number;
  discount?: number;
  measurementUnit?: string;
  taxes: string[];
  customTaxes?: Array<{ name: string; amount: number }>;
}

export interface CreateFneInvoiceDto {
  template: FneTemplate;
  invoiceType?: 'sale' | 'estimate';
  paymentMethod: FnePaymentMethod;
  isRne?: boolean;
  rne?: string;
  clientNcc?: string;
  clientCompanyName: string;
  clientPhone: string;
  clientEmail: string;
  clientSellerName?: string;
  pointOfSale: string;
  establishment: string;
  commercialMessage?: string;
  footer?: string;
  foreignCurrency?: string;
  foreignCurrencyRate?: number;
  items: CreateFneInvoiceItemDto[];
  customTaxes?: Array<{ name: string; amount: number }>;
  discount?: number;
}

export interface RefundItemDto {
  fneItemId: string;
  quantity: number;
}

export interface ListFneInvoicesQuery {
  page?: number;
  perPage?: number;
  status?: FneInvoiceStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface UpdateFneInvoiceDto {
  template?: FneTemplate;
  invoiceType?: 'sale' | 'estimate';
  paymentMethod?: FnePaymentMethod;
  isRne?: boolean;
  rne?: string;
  clientNcc?: string;
  clientCompanyName?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientSellerName?: string;
  pointOfSale?: string;
  establishment?: string;
  commercialMessage?: string;
  footer?: string;
  foreignCurrency?: string;
  foreignCurrencyRate?: number;
  items?: CreateFneInvoiceItemDto[];
  customTaxes?: Array<{ name: string; amount: number }>;
  discount?: number;
  decisionComment?: string;
}

@Injectable()
export class FneInvoicesService {
  private readonly logger = new Logger(FneInvoicesService.name);

  constructor(
    @InjectRepository(FneInvoice)
    private readonly invoiceRepo: Repository<FneInvoice>,
    @InjectRepository(FneInvoiceItem)
    private readonly itemRepo: Repository<FneInvoiceItem>,
    private readonly fneApi: FneApiService,
    private readonly auditService: AuditService,
  ) {}

  /* ─── Reference generation: FNE-YYYY-NNNNN ─── */
  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `FNE-${year}-`;
    const result = await this.invoiceRepo
      .createQueryBuilder('i')
      .select('MAX(CAST(RIGHT(i.reference, 5) AS INT))', 'maxSeq')
      .where('i.reference LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('LEN(i.reference) = :len', { len: prefix.length + 5 })
      .getRawOne();
    const seq = (result?.maxSeq ?? 0) + 1;
    return `${prefix}${String(seq).padStart(5, '0')}`;
  }

  /* ─── Compute line totals ─── */
  private computeLineTotals(item: CreateFneInvoiceItemDto) {
    const qty = Number(item.quantity);
    const price = Number(item.amount);
    const discountPct = Number(item.discount ?? 0);
    const lineTotalHt = qty * price * (1 - discountPct / 100);

    // Sum tax rates from standard taxes
    let taxRatePct = 0;
    for (const code of item.taxes) {
      taxRatePct += TAX_RATES[code] ?? 0;
    }
    // Add custom tax rates
    if (item.customTaxes) {
      for (const ct of item.customTaxes) {
        taxRatePct += Number(ct.amount);
      }
    }

    const lineVat = lineTotalHt * (taxRatePct / 100);
    const lineTotalTtc = lineTotalHt + lineVat;
    return { lineTotalHt: Math.round(lineTotalHt * 100) / 100, lineVat: Math.round(lineVat * 100) / 100, lineTotalTtc: Math.round(lineTotalTtc * 100) / 100 };
  }

  /* ─── Create invoice + certify with FNE API ─── */
  async createAndCertify(dto: CreateFneInvoiceDto, userId: string, companyId?: string): Promise<FneInvoice> {
    // Validate
    if (!dto.items?.length) throw new BadRequestException('Au moins un article est requis');
    const VALID_FNE_TAXES = ['TVA', 'TVAB', 'TVAC', 'TVAD', 'TVAE'];
    for (const it of dto.items) {
      const stdTaxes = (it.taxes ?? []).filter((t) => VALID_FNE_TAXES.includes(t));
      if (stdTaxes.length !== 1) {
        throw new BadRequestException(`Chaque article doit avoir exactement une taxe standard (TVA, TVAB, TVAC, TVAD ou TVAE). Article "${it.description}" en a ${stdTaxes.length}.`);
      }
    }
    if (dto.template === FneTemplate.B2B && !dto.clientNcc) {
      throw new BadRequestException('Le NCC client est obligatoire pour une facture B2B');
    }
    if (dto.isRne && !dto.rne) {
      throw new BadRequestException('Le numéro RNE est obligatoire');
    }
    if (dto.foreignCurrency && !dto.foreignCurrencyRate) {
      throw new BadRequestException('Le taux de change est obligatoire pour une devise étrangère');
    }

    const reference = await this.generateReference();
    const globalDiscountPct = Number(dto.discount ?? 0);

    const isEstimate = dto.invoiceType === 'estimate';

    // Build entity
    const invoice = this.invoiceRepo.create({
      reference,
      status: FneInvoiceStatus.DRAFT,
      invoiceType: isEstimate ? FneInvoiceType.ESTIMATE : FneInvoiceType.SALE,
      template: dto.template,
      paymentMethod: dto.paymentMethod,
      clientCompanyName: dto.clientCompanyName,
      clientPhone: dto.clientPhone,
      clientEmail: dto.clientEmail,
      clientNcc: dto.clientNcc || null,
      clientSellerName: dto.clientSellerName || null,
      pointOfSale: dto.pointOfSale,
      establishment: dto.establishment,
      commercialMessage: dto.commercialMessage || null,
      footer: dto.footer || null,
      isRne: dto.isRne ?? false,
      rne: dto.rne || null,
      foreignCurrency: dto.foreignCurrency || null,
      foreignCurrencyRate: dto.foreignCurrency ? Number(dto.foreignCurrencyRate ?? 0) : 0,
      customTaxes: dto.customTaxes || null,
      discountPct: globalDiscountPct,
      createdById: userId,
    });

    // Compute items
    let subtotalHt = 0;
    let totalVat = 0;
    const itemEntities: FneInvoiceItem[] = [];
    for (const it of dto.items) {
      const totals = this.computeLineTotals(it);
      subtotalHt += totals.lineTotalHt;
      totalVat += totals.lineVat;
      itemEntities.push(this.itemRepo.create({
        reference: it.reference || null,
        description: it.description,
        quantity: it.quantity,
        amount: it.amount,
        discount: it.discount ?? 0,
        measurementUnit: it.measurementUnit || null,
        taxes: it.taxes,
        customTaxes: it.customTaxes || null,
        ...totals,
      }));
    }

    // Global discount
    const discountAmount = subtotalHt * (globalDiscountPct / 100);
    const adjustedHt = subtotalHt - discountAmount;
    const adjustedVat = totalVat * (1 - globalDiscountPct / 100);
    const totalTtc = adjustedHt + adjustedVat;

    invoice.subtotalHt = Math.round(subtotalHt * 100) / 100;
    invoice.totalVat = Math.round(adjustedVat * 100) / 100;
    invoice.totalTtc = Math.round(totalTtc * 100) / 100;
    invoice.discountAmount = Math.round(discountAmount * 100) / 100;

    invoice.items = itemEntities;
    const saved = await this.invoiceRepo.save(invoice);

    // Estimates are saved as DRAFT only — no FNE API call
    if (isEstimate) {
      await this.auditService.log({
        userId,
        action: AuditAction.CREATE,
        entityType: 'fne_invoice',
        entityId: saved.id,
        newValue: { reference, invoiceType: 'estimate', status: 'DRAFT' },
      });
      return this.findById(saved.id);
    }

    // Build FNE API payload
    const fnePayload: Record<string, unknown> = {
      invoiceType: dto.invoiceType ?? 'sale',
      paymentMethod: dto.paymentMethod,
      template: dto.template,
      isRne: dto.isRne ?? false,
      rne: dto.rne ?? '',
      clientNcc: dto.clientNcc ?? '',
      clientCompanyName: dto.clientCompanyName,
      clientPhone: dto.clientPhone,
      clientEmail: dto.clientEmail,
      clientSellerName: dto.clientSellerName ?? '',
      pointOfSale: dto.pointOfSale,
      establishment: dto.establishment,
      commercialMessage: dto.commercialMessage ?? '',
      footer: dto.footer ?? '',
      foreignCurrency: dto.foreignCurrency ?? '',
      foreignCurrencyRate: dto.foreignCurrency ? Number(dto.foreignCurrencyRate ?? 0) : 0,
      discount: globalDiscountPct,
      items: dto.items.map((it) => ({
        reference: it.reference ?? '',
        description: it.description,
        quantity: it.quantity,
        amount: it.amount,
        discount: it.discount ?? 0,
        measurementUnit: it.measurementUnit ?? '',
        taxes: [it.taxes.find((t) => VALID_FNE_TAXES.includes(t)) ?? it.taxes[0]],
        customTaxes: it.customTaxes ?? [],
      })),
      customTaxes: dto.customTaxes ?? [],
    };

    try {
      const res = await this.fneApi.signInvoice(fnePayload, saved.id, userId, companyId);

      // Update invoice with FNE response
      saved.fneNcc = res.ncc;
      saved.fneReference = res.reference;
      saved.fneToken = res.token;
      saved.fneInvoiceId = String((res.invoice as Record<string, unknown>)?.id ?? '');
      saved.fneResponse = res as unknown as Record<string, unknown>;
      saved.balanceSticker = res.balance_funds;
      saved.fneWarning = res.warning;
      saved.status = FneInvoiceStatus.CERTIFIED;

      // Store FNE item IDs
      if (res.invoice && Array.isArray((res.invoice as Record<string, unknown>).items)) {
        const fneItems = (res.invoice as Record<string, unknown>).items as Array<Record<string, unknown>>;
        for (let i = 0; i < Math.min(fneItems.length, saved.items.length); i++) {
          saved.items[i].fneItemId = String(fneItems[i].id);
        }
      }

      await this.invoiceRepo.save(saved);

      await this.auditService.log({
        userId,
        action: AuditAction.CREATE,
        entityType: 'fne_invoice',
        entityId: saved.id,
        newValue: { reference, fneReference: res.reference, status: 'CERTIFIED' },
      });

      return this.findById(saved.id);
    } catch (err) {
      saved.status = FneInvoiceStatus.ERROR;
      saved.fneResponse = this.extractErrorDetails(err);
      await this.invoiceRepo.save(saved);
      throw err;
    }
  }

  /* ─── Certify a DRAFT invoice via FNE API ─── */
  async certify(id: string, userId: string, companyId?: string): Promise<FneInvoice> {
    const invoice = await this.findById(id);
    if (invoice.status !== FneInvoiceStatus.DRAFT && invoice.status !== FneInvoiceStatus.ERROR) {
      throw new BadRequestException('Seules les factures en brouillon ou en erreur peuvent être certifiées');
    }

    // Credit note → use refund API on the original invoice
    if (invoice.invoiceType === FneInvoiceType.CREDIT_NOTE) {
      return this.certifyCreditNote(invoice, userId, companyId);
    }

    const fnePayload: Record<string, unknown> = {
      invoiceType: 'sale',
      paymentMethod: invoice.paymentMethod,
      template: invoice.template,
      isRne: invoice.isRne ?? false,
      rne: invoice.rne ?? '',
      clientNcc: invoice.clientNcc ?? '',
      clientCompanyName: invoice.clientCompanyName,
      clientPhone: invoice.clientPhone,
      clientEmail: invoice.clientEmail,
      clientSellerName: invoice.clientSellerName ?? '',
      pointOfSale: invoice.pointOfSale,
      establishment: invoice.establishment,
      commercialMessage: invoice.commercialMessage ?? '',
      footer: invoice.footer ?? '',
      foreignCurrency: invoice.foreignCurrency ?? '',
      foreignCurrencyRate: invoice.foreignCurrency ? Number(invoice.foreignCurrencyRate ?? 0) : 0,
      discount: Number(invoice.discountPct ?? 0),
      items: invoice.items.map((it) => {
        const VALID_FNE_TAXES = ['TVA', 'TVAB', 'TVAC', 'TVAD', 'TVAE'];
        return {
          reference: it.reference ?? '',
          description: it.description,
          quantity: Number(it.quantity),
          amount: Number(it.amount),
          discount: Number(it.discount ?? 0),
          measurementUnit: it.measurementUnit ?? '',
          taxes: [((it.taxes ?? []) as string[]).find((t) => VALID_FNE_TAXES.includes(t)) ?? 'TVA'],
          customTaxes: it.customTaxes ?? [],
        };
      }),
      customTaxes: invoice.customTaxes ?? [],
    };

    try {
      const res = await this.fneApi.signInvoice(fnePayload, invoice.id, userId, companyId);

      invoice.fneNcc = res.ncc;
      invoice.fneReference = res.reference;
      invoice.fneToken = res.token;
      invoice.fneInvoiceId = String((res.invoice as Record<string, unknown>)?.id ?? '');
      invoice.fneResponse = res as unknown as Record<string, unknown>;
      invoice.balanceSticker = res.balance_funds;
      invoice.fneWarning = res.warning;
      invoice.status = FneInvoiceStatus.CERTIFIED;

      // If was an estimate, convert to sale on certification
      if (invoice.invoiceType === FneInvoiceType.ESTIMATE) {
        invoice.invoiceType = FneInvoiceType.SALE;
      }

      if (res.invoice && Array.isArray((res.invoice as Record<string, unknown>).items)) {
        const fneItems = (res.invoice as Record<string, unknown>).items as Array<Record<string, unknown>>;
        for (let i = 0; i < Math.min(fneItems.length, invoice.items.length); i++) {
          invoice.items[i].fneItemId = String(fneItems[i].id);
        }
      }

      await this.invoiceRepo.save(invoice);

      await this.auditService.log({
        userId,
        action: AuditAction.CREATE,
        entityType: 'fne_invoice',
        entityId: invoice.id,
        newValue: { reference: invoice.reference, fneReference: res.reference, status: 'CERTIFIED' },
      });

      return this.findById(invoice.id);
    } catch (err) {
      invoice.status = FneInvoiceStatus.ERROR;
      invoice.fneResponse = this.extractErrorDetails(err);
      await this.invoiceRepo.save(invoice);
      throw err;
    }
  }

  /* ─── Certify a credit note via FNE refund API ─── */
  private async certifyCreditNote(invoice: FneInvoice, userId: string, companyId?: string): Promise<FneInvoice> {
    if (!invoice.creditNoteOf) {
      throw new BadRequestException('Avoir sans facture d\'origine');
    }
    const original = await this.findById(invoice.creditNoteOf);
    if (!original.fneInvoiceId) {
      throw new BadRequestException('ID FNE manquant sur la facture d\'origine');
    }

    const refundItems = invoice.items
      .filter((it) => it.fneItemId)
      .map((it) => ({ id: it.fneItemId!, quantity: Number(it.quantity) }));

    if (!refundItems.length) {
      throw new BadRequestException('Aucun article avec ID FNE pour le remboursement');
    }

    try {
      const res = await this.fneApi.refundInvoice(
        original.fneInvoiceId,
        { items: refundItems },
        invoice.id,
        userId,
        companyId,
      );

      invoice.fneNcc = res.ncc;
      invoice.fneReference = res.reference;
      invoice.fneToken = res.token;
      invoice.fneResponse = res as unknown as Record<string, unknown>;
      invoice.fneInvoiceId = res.invoice ? String((res.invoice as Record<string, unknown>)?.id ?? '') : '';
      invoice.balanceSticker = res.balance_funds ?? 0;
      invoice.fneWarning = res.warning ?? false;
      invoice.status = FneInvoiceStatus.CERTIFIED;
      await this.invoiceRepo.save(invoice);

      // Update original's credit note reference
      original.creditNoteReference = invoice.reference;
      await this.invoiceRepo.save(original);

      await this.auditService.log({
        userId,
        action: AuditAction.CREATE,
        entityType: 'fne_credit_note',
        entityId: invoice.id,
        newValue: { reference: invoice.reference, fneReference: res.reference, originalInvoice: original.reference },
      });

      return this.findById(invoice.id);
    } catch (err) {
      invoice.status = FneInvoiceStatus.ERROR;
      invoice.fneResponse = this.extractErrorDetails(err);
      await this.invoiceRepo.save(invoice);
      throw err;
    }
  }

  /* ─── Extract error details for storage ─── */
  private extractErrorDetails(err: unknown): Record<string, unknown> {
    if (err instanceof HttpException) {
      const response = err.getResponse();
      if (typeof response === 'object') return response as Record<string, unknown>;
      return { error: String(response), statusCode: err.getStatus() };
    }
    return { error: err instanceof Error ? err.message : String(err) };
  }

  /* ─── Create credit note (avoir) — creates a NEW invoice as DRAFT ─── */
  async createCreditNote(
    invoiceId: string,
    refundItems: RefundItemDto[],
    userId: string,
    companyId?: string,
  ): Promise<FneInvoice> {
    const original = await this.findById(invoiceId);
    if (original.status !== FneInvoiceStatus.CERTIFIED && original.status !== FneInvoiceStatus.CREDIT_NOTE) {
      throw new BadRequestException('Seules les factures certifiées peuvent faire l\'objet d\'un avoir');
    }

    // Validate refund items
    for (const ri of refundItems) {
      const item = original.items.find((i) => i.fneItemId === ri.fneItemId);
      if (!item) throw new BadRequestException(`Article FNE ${ri.fneItemId} introuvable`);
      const remaining = Number(item.quantity) - Number(item.quantityReturned);
      if (ri.quantity > remaining) {
        throw new BadRequestException(`Quantité max retournable pour "${item.description}" : ${remaining}`);
      }
    }

    // Generate a reference for the credit note
    const reference = await this.generateReference();

    // Build credit note items from the refund selection
    const creditItems: FneInvoiceItem[] = [];
    let subtotalHt = 0;
    let totalVat = 0;

    for (const ri of refundItems) {
      const srcItem = original.items.find((i) => i.fneItemId === ri.fneItemId)!;
      const totals = this.computeLineTotals({
        description: srcItem.description,
        reference: srcItem.reference ?? undefined,
        quantity: ri.quantity,
        amount: Number(srcItem.amount),
        discount: Number(srcItem.discount ?? 0),
        measurementUnit: srcItem.measurementUnit ?? undefined,
        taxes: srcItem.taxes,
        customTaxes: srcItem.customTaxes ?? undefined,
      });
      subtotalHt += totals.lineTotalHt;
      totalVat += totals.lineVat;

      creditItems.push(this.itemRepo.create({
        fneItemId: srcItem.fneItemId,
        reference: srcItem.reference,
        description: srcItem.description,
        quantity: ri.quantity,
        amount: srcItem.amount,
        discount: srcItem.discount,
        measurementUnit: srcItem.measurementUnit,
        taxes: srcItem.taxes,
        customTaxes: srcItem.customTaxes,
        ...totals,
      }));
    }

    const totalTtc = subtotalHt + totalVat;

    // Create the credit note invoice as DRAFT
    const creditNote = this.invoiceRepo.create({
      reference,
      status: FneInvoiceStatus.DRAFT,
      invoiceType: FneInvoiceType.CREDIT_NOTE,
      template: original.template,
      paymentMethod: original.paymentMethod,
      clientCompanyName: original.clientCompanyName,
      clientPhone: original.clientPhone,
      clientEmail: original.clientEmail,
      clientNcc: original.clientNcc,
      clientSellerName: original.clientSellerName,
      pointOfSale: original.pointOfSale,
      establishment: original.establishment,
      commercialMessage: original.commercialMessage,
      footer: original.footer,
      isRne: original.isRne,
      rne: original.rne,
      foreignCurrency: original.foreignCurrency,
      foreignCurrencyRate: original.foreignCurrencyRate,
      customTaxes: original.customTaxes,
      discountPct: 0,
      discountAmount: 0,
      subtotalHt: Math.round(subtotalHt * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      totalTtc: Math.round(totalTtc * 100) / 100,
      creditNoteOf: original.id,
      createdById: userId,
      items: creditItems,
    });

    const saved = await this.invoiceRepo.save(creditNote);

    // Update returned quantities on the original
    for (const ri of refundItems) {
      const item = original.items.find((i) => i.fneItemId === ri.fneItemId)!;
      item.quantityReturned = Number(item.quantityReturned) + ri.quantity;
      await this.itemRepo.save(item);
    }

    // Link original to this credit note
    original.creditNoteReference = saved.reference;
    await this.invoiceRepo.save(original);

    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'fne_credit_note',
      entityId: saved.id,
      newValue: { reference, creditNoteOf: original.reference },
    });

    return this.findById(saved.id);
  }

  /* ─── Update a DRAFT invoice ─── */
  async update(id: string, dto: UpdateFneInvoiceDto, userId: string): Promise<FneInvoice> {
    const invoice = await this.findById(id);
    if (invoice.status !== FneInvoiceStatus.DRAFT && invoice.status !== FneInvoiceStatus.ERROR) {
      throw new BadRequestException('Seules les factures en brouillon ou en erreur peuvent être modifiées');
    }

    // Validate
    if (dto.template === FneTemplate.B2B) {
      const ncc = dto.clientNcc ?? invoice.clientNcc;
      if (!ncc) throw new BadRequestException('Le NCC client est obligatoire pour une facture B2B');
    }
    if (dto.isRne && !dto.rne && !invoice.rne) {
      throw new BadRequestException('Le numéro RNE est obligatoire');
    }
    if (dto.foreignCurrency && !dto.foreignCurrencyRate && !invoice.foreignCurrencyRate) {
      throw new BadRequestException('Le taux de change est obligatoire pour une devise étrangère');
    }

    // Update scalar fields
    if (dto.template !== undefined) invoice.template = dto.template;
    if (dto.invoiceType !== undefined) invoice.invoiceType = dto.invoiceType === 'estimate' ? FneInvoiceType.ESTIMATE : FneInvoiceType.SALE;
    if (dto.paymentMethod !== undefined) invoice.paymentMethod = dto.paymentMethod;
    if (dto.clientCompanyName !== undefined) invoice.clientCompanyName = dto.clientCompanyName;
    if (dto.clientPhone !== undefined) invoice.clientPhone = dto.clientPhone;
    if (dto.clientEmail !== undefined) invoice.clientEmail = dto.clientEmail;
    if (dto.clientNcc !== undefined) invoice.clientNcc = dto.clientNcc || null;
    if (dto.clientSellerName !== undefined) invoice.clientSellerName = dto.clientSellerName || null;
    if (dto.pointOfSale !== undefined) invoice.pointOfSale = dto.pointOfSale;
    if (dto.establishment !== undefined) invoice.establishment = dto.establishment;
    if (dto.commercialMessage !== undefined) invoice.commercialMessage = dto.commercialMessage || null;
    if (dto.footer !== undefined) invoice.footer = dto.footer || null;
    if (dto.isRne !== undefined) invoice.isRne = dto.isRne;
    if (dto.rne !== undefined) invoice.rne = dto.rne || null;
    if (dto.foreignCurrency !== undefined) invoice.foreignCurrency = dto.foreignCurrency || null;
    if (dto.foreignCurrencyRate !== undefined) invoice.foreignCurrencyRate = dto.foreignCurrency ? Number(dto.foreignCurrencyRate ?? 0) : 0;
    if (dto.customTaxes !== undefined) invoice.customTaxes = dto.customTaxes || null;
    if (dto.discount !== undefined) invoice.discountPct = Number(dto.discount);

    // Replace items if provided
    if (dto.items !== undefined) {
      if (!dto.items.length) throw new BadRequestException('Au moins un article est requis');
      const VALID_FNE_TAXES = ['TVA', 'TVAB', 'TVAC', 'TVAD', 'TVAE'];
      for (const it of dto.items) {
        const stdTaxes = (it.taxes ?? []).filter((t) => VALID_FNE_TAXES.includes(t));
        if (stdTaxes.length !== 1) {
          throw new BadRequestException(`Chaque article doit avoir exactement une taxe standard. Article "${it.description}" en a ${stdTaxes.length}.`);
        }
      }

      // Remove old items
      await this.itemRepo.delete({ invoice: { id: invoice.id } });

      // Build new items
      let subtotalHt = 0;
      let totalVat = 0;
      const itemEntities: FneInvoiceItem[] = [];
      for (const it of dto.items) {
        const totals = this.computeLineTotals(it);
        subtotalHt += totals.lineTotalHt;
        totalVat += totals.lineVat;
        itemEntities.push(this.itemRepo.create({
          reference: it.reference || null,
          description: it.description,
          quantity: it.quantity,
          amount: it.amount,
          discount: it.discount ?? 0,
          measurementUnit: it.measurementUnit || null,
          taxes: it.taxes,
          customTaxes: it.customTaxes || null,
          ...totals,
        }));
      }

      const globalDiscountPct = Number(dto.discount ?? invoice.discountPct ?? 0);
      const discountAmount = subtotalHt * (globalDiscountPct / 100);
      const adjustedHt = subtotalHt - discountAmount;
      const adjustedVat = totalVat * (1 - globalDiscountPct / 100);
      const totalTtc = adjustedHt + adjustedVat;

      invoice.subtotalHt = Math.round(subtotalHt * 100) / 100;
      invoice.totalVat = Math.round(adjustedVat * 100) / 100;
      invoice.totalTtc = Math.round(totalTtc * 100) / 100;
      invoice.discountAmount = Math.round(discountAmount * 100) / 100;
      invoice.items = itemEntities;
    }

    await this.invoiceRepo.save(invoice);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'fne_invoice',
      entityId: invoice.id,
      newValue: { reference: invoice.reference, status: invoice.status },
    });

    return this.findById(invoice.id);
  }

  /* ─── Update decision comment (any status) ─── */
  async updateDecisionComment(id: string, comment: string | null): Promise<FneInvoice> {
    const invoice = await this.findById(id);
    invoice.decisionComment = comment;
    await this.invoiceRepo.save(invoice);
    return this.findById(invoice.id);
  }

  /* ─── Delete a non-certified invoice ─── */
  async remove(id: string, userId: string): Promise<{ deleted: true }> {
    const invoice = await this.findById(id);
    if (invoice.status !== FneInvoiceStatus.DRAFT && invoice.status !== FneInvoiceStatus.ERROR) {
      throw new BadRequestException('Seules les factures non certifiées (brouillon ou erreur) peuvent être supprimées');
    }

    const reference = invoice.reference;
    await this.itemRepo.delete({ invoice: { id } });
    await this.invoiceRepo.delete(id);

    await this.auditService.log({
      userId,
      action: AuditAction.DELETE,
      entityType: 'fne_invoice',
      entityId: id,
      oldValue: { reference, status: invoice.status },
    });

    return { deleted: true };
  }

  /* ─── Bulk certify DRAFT/ERROR invoices ─── */
  async bulkCertify(ids: string[], userId: string, companyId?: string): Promise<{ certified: number; errors: Array<{ id: string; reference?: string; error: string }> }> {
    if (!ids?.length) throw new BadRequestException('Aucun ID fourni');
    if (ids.length > 50) throw new BadRequestException('Maximum 50 factures à la fois');

    let certified = 0;
    const errors: Array<{ id: string; reference?: string; error: string }> = [];

    for (const id of ids) {
      try {
        await this.certify(id, userId, companyId);
        certified++;
      } catch (err) {
        const invoice = await this.invoiceRepo.findOne({ where: { id }, select: ['id', 'reference'] }).catch(() => null);
        errors.push({
          id,
          reference: invoice?.reference ?? undefined,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { certified, errors };
  }

  /* ─── Bulk delete non-certified invoices ─── */
  async bulkRemove(ids: string[], userId: string): Promise<{ deleted: number; skipped: number; errors: string[] }> {
    if (!ids?.length) throw new BadRequestException('Aucun ID fourni');
    if (ids.length > 100) throw new BadRequestException('Maximum 100 factures à la fois');

    let deleted = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        await this.remove(id, userId);
        deleted++;
      } catch (err) {
        errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { deleted, skipped: ids.length - deleted, errors };
  }

  /* ─── Bulk import invoices as DRAFT ─── */
  async bulkImport(
    invoices: CreateFneInvoiceDto[],
    userId: string,
  ): Promise<{ imported: number; errors: Array<{ index: number; error: string }> }> {
    if (!invoices?.length) throw new BadRequestException('Aucune facture à importer');
    if (invoices.length > 200) throw new BadRequestException('Maximum 200 factures à la fois');

    let imported = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let idx = 0; idx < invoices.length; idx++) {
      const dto = invoices[idx];
      try {
        // Validate items
        if (!dto.items?.length) throw new BadRequestException('Au moins un article est requis');
        const VALID_FNE_TAXES = ['TVA', 'TVAB', 'TVAC', 'TVAD', 'TVAE'];
        for (const it of dto.items) {
          const stdTaxes = (it.taxes ?? []).filter((t) => VALID_FNE_TAXES.includes(t));
          if (stdTaxes.length !== 1) {
            throw new BadRequestException(`Article "${it.description}" doit avoir exactement une taxe standard.`);
          }
        }

        const reference = await this.generateReference();
        const globalDiscountPct = Number(dto.discount ?? 0);

        const invoice = this.invoiceRepo.create({
          reference,
          status: FneInvoiceStatus.DRAFT,
          invoiceType: FneInvoiceType.SALE,
          template: dto.template,
          paymentMethod: dto.paymentMethod,
          clientCompanyName: dto.clientCompanyName,
          clientPhone: dto.clientPhone,
          clientEmail: dto.clientEmail,
          clientNcc: dto.clientNcc || null,
          clientSellerName: dto.clientSellerName || null,
          pointOfSale: dto.pointOfSale,
          establishment: dto.establishment,
          commercialMessage: dto.commercialMessage || null,
          footer: dto.footer || null,
          isRne: dto.isRne ?? false,
          rne: dto.rne || null,
          foreignCurrency: dto.foreignCurrency || null,
          foreignCurrencyRate: dto.foreignCurrency ? Number(dto.foreignCurrencyRate ?? 0) : 0,
          customTaxes: dto.customTaxes || null,
          discountPct: globalDiscountPct,
          createdById: userId,
        });

        let subtotalHt = 0;
        let totalVat = 0;
        const itemEntities: FneInvoiceItem[] = [];
        for (const it of dto.items) {
          const totals = this.computeLineTotals(it);
          subtotalHt += totals.lineTotalHt;
          totalVat += totals.lineVat;
          itemEntities.push(this.itemRepo.create({
            reference: it.reference || null,
            description: it.description,
            quantity: it.quantity,
            amount: it.amount,
            discount: it.discount ?? 0,
            measurementUnit: it.measurementUnit || null,
            taxes: it.taxes,
            customTaxes: it.customTaxes || null,
            ...totals,
          }));
        }

        const discountAmount = subtotalHt * (globalDiscountPct / 100);
        const adjustedHt = subtotalHt - discountAmount;
        const adjustedVat = totalVat * (1 - globalDiscountPct / 100);
        const totalTtc = adjustedHt + adjustedVat;

        invoice.subtotalHt = Math.round(subtotalHt * 100) / 100;
        invoice.totalVat = Math.round(adjustedVat * 100) / 100;
        invoice.totalTtc = Math.round(totalTtc * 100) / 100;
        invoice.discountAmount = Math.round(discountAmount * 100) / 100;
        invoice.items = itemEntities;

        await this.invoiceRepo.save(invoice);

        await this.auditService.log({
          userId,
          action: AuditAction.CREATE,
          entityType: 'fne_invoice',
          entityId: invoice.id,
          newValue: { reference, status: 'DRAFT', source: 'import' },
        });

        imported++;
      } catch (err) {
        errors.push({
          index: idx + 1,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { imported, errors };
  }

  /* ─── Find by ID ─── */
  async findById(id: string): Promise<FneInvoice & { creditNotes?: Array<{ id: string; reference: string; status: string }> }> {
    const inv = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!inv) throw new NotFoundException('Facture FNE introuvable');

    // Attach credit notes linked to this invoice
    const creditNotes = await this.invoiceRepo.find({
      where: { creditNoteOf: id },
      select: ['id', 'reference', 'status'],
      order: { createdAt: 'DESC' },
    });

    return { ...inv, creditNotes: creditNotes.length ? creditNotes : undefined } as any;
  }

  /* ─── List with filters ─── */
  async findAll(query: ListFneInvoicesQuery) {
    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 25, 100);

    const qb = this.invoiceRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.items', 'items')
      .orderBy('i.createdAt', 'DESC');

    if (query.status) {
      qb.andWhere('i.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        '(i.reference LIKE :s OR i.fne_reference LIKE :s OR i.client_company_name LIKE :s OR i.fne_ncc LIKE :s)',
        { s: `%${query.search}%` },
      );
    }
    if (query.dateFrom) {
      qb.andWhere('i.created_at >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('i.created_at <= :dateTo', { dateTo: `${query.dateTo}T23:59:59` });
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * perPage)
      .take(perPage)
      .getMany();

    return { data, meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) } };
  }

  /* ─── Sticker balance (latest) ─── */
  async getLatestStickerBalance(): Promise<number> {
    const latest = await this.invoiceRepo
      .createQueryBuilder('i')
      .select('i.balanceSticker', 'balanceSticker')
      .where('i.status = :status', { status: FneInvoiceStatus.CERTIFIED })
      .orderBy('i.createdAt', 'DESC')
      .limit(1)
      .getRawOne();
    return latest?.balanceSticker ?? 0;
  }
}
