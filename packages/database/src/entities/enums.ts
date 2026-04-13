/* ─── Expense Module ─── */

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

/* ─── Sales Module ─── */

export enum SaleStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
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

/* ─── Transversal ─── */

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

export enum CashClosingModule {
  EXPENSE = 'EXPENSE',
  SALE = 'SALE',
}

export enum CashClosingStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  VALIDATED = 'VALIDATED',
}

/* ─── Journée de caisse ─── */

export enum CashType {
  EXPENSE = 'EXPENSE',
  SALES = 'SALES',
}

export enum CashDayStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum CashMovementType {
  ENTRY = 'ENTRY',
  EXIT = 'EXIT',
}

export enum CashMovementCategory {
  SALE = 'SALE',
  EXPENSE = 'EXPENSE',
  PAYMENT = 'PAYMENT',
  ADJUSTMENT = 'ADJUSTMENT',
  OTHER = 'OTHER',
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

/* ─── Demandes de décaissement ─── */

export enum DisbursementRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PROCESSED = 'PROCESSED',
}

/* ─── Circuits de validation ─── */

export enum ApprovalCircuitStepRole {
  CHEF_COMPTABLE = 'CHEF_COMPTABLE',
  DAF = 'DAF',
  DG = 'DG',
}

/* ─── Historique de validation ─── */

export enum ValidationAction {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ValidationTargetType {
  EXPENSE = 'EXPENSE',
  DISBURSEMENT_REQUEST = 'DISBURSEMENT_REQUEST',
}
