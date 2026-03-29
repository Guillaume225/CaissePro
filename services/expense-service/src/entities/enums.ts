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
