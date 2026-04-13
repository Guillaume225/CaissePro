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

export enum CashClosingStatus {
  OPEN = 'OPEN',
  PENDING_CLOSE = 'PENDING_CLOSE',
  CLOSED = 'CLOSED',
}

export enum CashType {
  EXPENSE = 'EXPENSE',
  SALES = 'SALES',
}

export enum CashDayStatus {
  OPEN = 'OPEN',
  PENDING_CLOSE = 'PENDING_CLOSE',
  CLOSED = 'CLOSED',
}

export enum DisbursementRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  VALIDATING = 'VALIDATING',
  VALIDATED = 'VALIDATED',
  PROCESSED = 'PROCESSED',
}

export enum CategoryDirection {
  ENTRY = 'ENTRY',
  EXIT = 'EXIT',
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
