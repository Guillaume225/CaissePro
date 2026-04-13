// ── FNE Enums ────────────────────────────────────────────
export type FneInvoiceStatus = 'DRAFT' | 'CERTIFIED' | 'CREDIT_NOTE' | 'ERROR';
export type FneTemplate = 'B2B' | 'B2C' | 'B2G' | 'B2F';
export type FnePaymentMethod = 'cash' | 'card' | 'check' | 'mobile-money' | 'transfer' | 'deferred';
export type FneInvoiceType = 'sale' | 'estimate' | 'credit_note';

// ── FNE Invoice Item ─────────────────────────────────────
export interface FneInvoiceItem {
  id: string;
  invoiceId: string;
  fneItemId: string | null;
  reference: string | null;
  description: string;
  quantity: number;
  amount: number;
  discount: number;
  measurementUnit: string | null;
  taxes: string[];
  customTaxes: Array<{ name: string; amount: number }> | null;
  lineTotalHt: number;
  lineVat: number;
  lineTotalTtc: number;
  quantityReturned: number;
}

// ── FNE Invoice ──────────────────────────────────────────
export interface FneInvoice {
  id: string;
  reference: string;
  fneNcc: string | null;
  fneReference: string | null;
  fneToken: string | null;
  fneResponse: Record<string, unknown> | null;
  fneInvoiceId: string | null;
  status: FneInvoiceStatus;
  invoiceType: FneInvoiceType;
  template: FneTemplate;
  paymentMethod: FnePaymentMethod;
  clientCompanyName: string;
  clientPhone: string;
  clientEmail: string;
  clientNcc: string | null;
  clientSellerName: string | null;
  pointOfSale: string;
  establishment: string;
  commercialMessage: string | null;
  footer: string | null;
  isRne: boolean;
  rne: string | null;
  foreignCurrency: string | null;
  foreignCurrencyRate: number;
  subtotalHt: number;
  totalVat: number;
  totalTtc: number;
  discountPct: number;
  discountAmount: number;
  balanceSticker: number;
  fneWarning: boolean;
  customTaxes: Array<{ name: string; amount: number }> | null;
  creditNoteOf: string | null;
  creditNoteReference: string | null;
  creditNotes?: Array<{ id: string; reference: string; status: FneInvoiceStatus }>;
  decisionComment: string | null;
  items: FneInvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

// ── Filters ──────────────────────────────────────────────
export interface FneInvoiceFilters {
  page?: number;
  perPage?: number;
  status?: FneInvoiceStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ── Payloads ─────────────────────────────────────────────
export interface CreateFneInvoiceItemPayload {
  reference?: string;
  description: string;
  quantity: number;
  amount: number;
  discount?: number;
  measurementUnit?: string;
  taxes: string[];
  customTaxes?: Array<{ name: string; amount: number }>;
}

export interface CreateFneInvoicePayload {
  template: FneTemplate;
  invoiceType: FneInvoiceType;
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
  items: CreateFneInvoiceItemPayload[];
  customTaxes?: Array<{ name: string; amount: number }>;
  discount?: number;
}

export interface RefundItemPayload {
  fneItemId: string;
  quantity: number;
}

export interface CreateCreditNotePayload {
  items: RefundItemPayload[];
}

export interface UpdateFneInvoicePayload {
  template?: FneTemplate;
  invoiceType?: FneInvoiceType;
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
  items?: CreateFneInvoiceItemPayload[];
  customTaxes?: Array<{ name: string; amount: number }>;
  discount?: number;
  decisionComment?: string | null;
}

// ── FNE Client ───────────────────────────────────────────
export interface FneClientRecord {
  id: string;
  companyName: string;
  phone: string;
  email: string;
  ncc: string | null;
  sellerName: string | null;
  accountCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFneClientPayload {
  companyName: string;
  phone: string;
  email: string;
  ncc?: string;
  sellerName?: string;
  accountCode?: string;
}

export interface UpdateFneClientPayload extends Partial<CreateFneClientPayload> {
  isActive?: boolean;
}

// ── Pagination (reuse from sale.ts) ──────────────────────
export interface FnePaginationMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface FnePaginatedResponse<T> {
  data: T[];
  meta: FnePaginationMeta;
}

// ── FNE Product ──────────────────────────────────────────
export interface FneProductRecord {
  id: string;
  description: string;
  reference: string | null;
  unitPrice: number;
  measurementUnit: string | null;
  defaultTaxes: string[];
  accountCode: string | null;
  vatAccountCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFneProductPayload {
  description: string;
  reference?: string;
  unitPrice: number;
  measurementUnit?: string;
  defaultTaxes?: string[];
  accountCode?: string;
  vatAccountCode?: string;
}

export interface UpdateFneProductPayload extends Partial<CreateFneProductPayload> {
  isActive?: boolean;
}

// ── FNE Point of Sale ────────────────────────────────────
export interface FnePointOfSaleRecord {
  id: string;
  establishmentId: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFnePointOfSalePayload {
  name: string;
  address?: string;
  establishmentId: string;
}

export interface UpdateFnePointOfSalePayload extends Partial<CreateFnePointOfSalePayload> {
  isActive?: boolean;
}

// ── FNE Establishment ────────────────────────────────────
export interface FneEstablishmentRecord {
  id: string;
  companyId: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFneEstablishmentPayload {
  name: string;
  address?: string;
  companyId: string;
}

export interface UpdateFneEstablishmentPayload extends Partial<CreateFneEstablishmentPayload> {
  isActive?: boolean;
}

// ── FNE Settings (per-company API config) ────────────────
export interface FneSettingRecord {
  id: string;
  companyId: string;
  apiUrl: string;
  apiKey: string;
  nif: string | null;
  maxRetries: number;
  journalSales: string;
  journalCash: string;
  regimeImposition: string | null;
  centreImpots: string | null;
  bankRef: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertFneSettingPayload {
  companyId: string;
  apiUrl?: string;
  apiKey: string;
  nif?: string;
  maxRetries?: number;
  journalSales?: string;
  journalCash?: string;
  regimeImposition?: string;
  centreImpots?: string;
  bankRef?: string;
}

// ── FNE Accounting Entry ─────────────────────────────────
export interface FneAccountingEntryRecord {
  id: string;
  invoiceId: string;
  invoiceReference: string;
  journalCode: string;
  entryDate: string;
  accountNumber: string;
  accountLabel: string;
  debit: number;
  credit: number;
  label: string;
  operationType: string;
  createdBy: string;
  createdAt: string;
}

export interface FneAccountingFilters {
  page?: number;
  perPage?: number;
  dateFrom?: string;
  dateTo?: string;
  invoiceReference?: string;
}

export interface GenerateEntriesResult {
  generated: number;
  skipped: number;
  errors: string[];
}

// ── FNE Dashboard ────────────────────────────────────────
export interface FneDashboardKpis {
  monthInvoices: number;
  monthRevenue: number;
  monthCertified: number;
  monthCreditNotes: number;
  monthErrors: number;
  monthDrafts: number;
  totalInvoices: number;
  totalRevenue: number;
  invoicesTrend: number;
  revenueTrend: number;
}

export interface FneMonthlyTrendItem {
  month: string;
  revenue: number;
  count: number;
}

export interface FneTopClient {
  clientName: string;
  clientPhone: string;
  invoiceCount: number;
  revenue: number;
}

export interface FneStatusBreakdownItem {
  status: string;
  count: number;
}
