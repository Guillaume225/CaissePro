export enum SaleStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CHECK = 'CHECK',
  TRANSFER = 'TRANSFER',
  MOBILE_MONEY = 'MOBILE_MONEY',
  CARD = 'CARD',
}

export enum AgingBucket {
  CURRENT = 'CURRENT',
  D30 = 'D30',
  D60 = 'D60',
  D90 = 'D90',
}

export enum CashClosingStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

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

/* ─── FNE Invoice enums ─── */

export enum FneInvoiceStatus {
  DRAFT = 'DRAFT',
  CERTIFIED = 'CERTIFIED',
  CREDIT_NOTE = 'CREDIT_NOTE',
  ERROR = 'ERROR',
}

export enum FneTemplate {
  B2B = 'B2B',
  B2C = 'B2C',
  B2G = 'B2G',
  B2F = 'B2F',
}

export enum FnePaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  CHECK = 'check',
  MOBILE_MONEY = 'mobile-money',
  TRANSFER = 'transfer',
  DEFERRED = 'deferred',
}

export enum FneInvoiceType {
  SALE = 'sale',
  ESTIMATE = 'estimate',
  CREDIT_NOTE = 'credit_note',
}

export enum FneTaxCode {
  TVA = 'TVA',
  TVAB = 'TVAB',
  TVAC = 'TVAC',
  TVAD = 'TVAD',
}
