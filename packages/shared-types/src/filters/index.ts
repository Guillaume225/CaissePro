/* ═══════════════════════════════════════════
 *  Filters, Pagination & Sort
 * ═══════════════════════════════════════════ */

import {
  ExpenseStatus,
  PaymentMethod,
  SaleStatus,
  RiskClass,
  AgingBucket,
  SortOrder,
} from '../enums/index.js';

/* ─── Generic ─── */

export interface PaginationParams {
  page?: number;
  perPage?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface DateRange {
  from?: string; // ISO date
  to?: string;   // ISO date
}

/* ─── Expense ─── */

export interface ExpenseFilters extends PaginationParams, SortParams {
  status?: ExpenseStatus | ExpenseStatus[];
  paymentMethod?: PaymentMethod | PaymentMethod[];
  categoryId?: string;
  createdById?: string;
  beneficiary?: string;
  dateRange?: DateRange;
  amountMin?: number;
  amountMax?: number;
  search?: string;
}

/* ─── Sale ─── */

export interface SaleFilters extends PaginationParams, SortParams {
  status?: SaleStatus | SaleStatus[];
  clientId?: string;
  sellerId?: string;
  dateRange?: DateRange;
  totalMin?: number;
  totalMax?: number;
  search?: string;
}

/* ─── Client ─── */

export interface ClientFilters extends PaginationParams, SortParams {
  type?: string;
  riskClass?: RiskClass | RiskClass[];
  isActive?: boolean;
  search?: string;
}

/* ─── Product ─── */

export interface ProductFilters extends PaginationParams, SortParams {
  category?: string;
  isActive?: boolean;
  priceMin?: number;
  priceMax?: number;
  search?: string;
}

/* ─── Receivable ─── */

export interface ReceivableFilters extends PaginationParams, SortParams {
  clientId?: string;
  agingBucket?: AgingBucket | AgingBucket[];
  status?: string;
  dateRange?: DateRange;
}

/* ─── Audit ─── */

export interface AuditLogFilters extends PaginationParams, SortParams {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateRange?: DateRange;
}

/* ─── Notification ─── */

export interface NotificationFilters extends PaginationParams {
  isRead?: boolean;
  type?: string;
}
