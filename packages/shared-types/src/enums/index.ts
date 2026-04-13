/* ═══════════════════════════════════════════
 *  CaisseFlow Pro — Shared Enums
 * ═══════════════════════════════════════════ */

export enum PaymentMethod {
  CASH = 'CASH',
  CHECK = 'CHECK',
  TRANSFER = 'TRANSFER',
  MOBILE_MONEY = 'MOBILE_MONEY',
}

export enum ExpenseStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED_L1 = 'APPROVED_L1',
  APPROVED_L2 = 'APPROVED_L2',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum SaleStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum AdvanceStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  JUSTIFIED = 'JUSTIFIED',
  OVERDUE = 'OVERDUE',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER',
  ACCOUNTANT = 'ACCOUNTANT',
  AUDITOR = 'AUDITOR',
  VIEWER = 'VIEWER',
}

export enum ClientType {
  INDIVIDUAL = 'INDIVIDUAL',
  COMPANY = 'COMPANY',
}

export enum RiskClass {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
}

export enum AgingBucket {
  CURRENT = 'CURRENT',
  DAYS_30 = '30',
  DAYS_60 = '60',
  DAYS_90 = '90',
  OVERDUE = 'OVERDUE',
}

export enum ReceivableStatus {
  OPEN = 'OPEN',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  WRITTEN_OFF = 'WRITTEN_OFF',
}

export enum ApprovalLevel {
  L1 = 1,
  L2 = 2,
}

export enum NotificationType {
  APPROVAL_REQUEST = 'APPROVAL_REQUEST',
  EXPENSE_APPROVED = 'EXPENSE_APPROVED',
  EXPENSE_REJECTED = 'EXPENSE_REJECTED',
  BUDGET_ALERT = 'BUDGET_ALERT',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  ADVANCE_OVERDUE = 'ADVANCE_OVERDUE',
  SYSTEM = 'SYSTEM',
}

export enum Module {
  EXPENSE = 'EXPENSE',
  SALE = 'SALE',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  EXPORT = 'EXPORT',
}

export enum CashClosingStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  VALIDATED = 'VALIDATED',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}
