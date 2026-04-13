import type { ModuleId } from '@/stores/module-store';

// ══════════════ ADMIN TYPES ══════════════════════════════

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roleId?: string;
  roleName?: string;
  isActive: boolean;
  mfaEnabled: boolean;
  mfaConfigured: boolean;
  lastLogin?: string;
  createdAt: string;
  allowedModules?: ModuleId[];
  companyIds?: string[];
  companyNames?: string[];
}

export interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
  roleId?: string;
  password: string;
  allowedModules?: ModuleId[];
  companyIds?: string[];
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  role?: string;
  roleId?: string;
  isActive?: boolean;
  mfaEnabled?: boolean;
  allowedModules?: ModuleId[];
  companyIds?: string[];
}

// ── Roles & Permissions ──────────────────────────────────
export interface Permission {
  key: string;
  label: string;
  module: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  usersCount: number;
}

export interface CreateRoleDto {
  name: string;
  description: string;
  permissions: string[];
}

// ── Companies ────────────────────────────────────────────
export interface Company {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  tradeRegister: string | null;
  currency: string;
  logo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyDto {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  tradeRegister?: string;
  currency?: string;
}

export interface UpdateCompanyDto {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  tradeRegister?: string;
  currency?: string;
  isActive?: boolean;
}

// ── Employees (Salariés) ─────────────────────────────────
export interface EmployeeAccount {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  email: string;
  service: string;
  position: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateEmployeeDto {
  matricule: string;
  firstName: string;
  lastName: string;
  email: string;
  service: string;
  position: string;
  phone: string;
}

export interface UpdateEmployeeDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  service?: string;
  position?: string;
  phone?: string;
  isActive?: boolean;
}

// ── Settings ─────────────────────────────────────────────
export interface AppSettings {
  validation: {
    maxDisbursementAmount: number;
    advanceJustificationDays: number;
  };
  finance: {
    defaultTvaRate: number;
    maxDiscountByRole: Record<string, number>;
  };
  ai: {
    anomalyThreshold: number;
    forecastHorizonDays: number;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    password: string;
    fromName: string;
    fromEmail: string;
  };
  company: {
    name: string;
    logo?: string;
    address: string;
    phone: string;
    taxId: string;
  };
}

// ── Audit Log ────────────────────────────────────────────
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'SUBMIT'
  | 'APPROVE'
  | 'REJECT'
  | 'PAY'
  | 'CANCEL'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'CASH_CLOSING_OPEN'
  | 'CASH_CLOSING_CLOSE';

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description: string;
  ipAddress: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogFilters {
  action?: AuditAction;
  entityType?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ── Categories ───────────────────────────────────────────
export interface ExpenseCategory {
  id: string;
  name: string;
  code?: string;
  parentId: string | null;
  order: number;
  isActive: boolean;
  direction?: 'ENTRY' | 'EXIT';
  budgetLimit?: number | null;
  accountingDebitAccount: string | null;
  accountingCreditAccount: string | null;
  children?: ExpenseCategory[];
}

export interface CreateCategoryDto {
  name: string;
  code?: string;
  parentId?: string | null;
  budgetLimit?: number;
  direction?: 'ENTRY' | 'EXIT';
  accountingDebitAccount?: string;
  accountingCreditAccount?: string;
}

export interface UpdateCategoryDto {
  name?: string;
  budgetLimit?: number;
  isActive?: boolean;
  direction?: 'ENTRY' | 'EXIT';
  accountingDebitAccount?: string;
  accountingCreditAccount?: string;
}

// ══════════════ APPROVAL CIRCUITS (Circuits de validation) ═

export interface ApprovalCircuitStep {
  level: number;
  role: 'chef_comptable' | 'responsable_rh' | 'daf' | 'secretaire_general' | 'dg';
  approverId: string; // assigned user id
  approverName: string; // assigned user display name
}

export interface ApprovalCircuit {
  id: string;
  name: string;
  minAmount: number; // threshold min (inclusive)
  maxAmount: number | null; // threshold max (inclusive), null = unlimited
  steps: ApprovalCircuitStep[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApprovalCircuitDto {
  name: string;
  minAmount: number;
  maxAmount: number | null;
  steps: ApprovalCircuitStep[];
}

export interface UpdateApprovalCircuitDto {
  name?: string;
  minAmount?: number;
  maxAmount?: number | null;
  steps?: ApprovalCircuitStep[];
  isActive?: boolean;
}

// ══════════════ REPORTS TYPES ════════════════════════════

export type ReportType =
  | 'monthly-expenses'
  | 'fne-monthly-revenue'
  | 'fne-accounting-summary'
  | 'cash-closing-summary'
  | 'tax-report';

export interface ReportRequest {
  type: ReportType;
  dateFrom: string;
  dateTo: string;
  module?: string;
  department?: string;
  format?: 'pdf' | 'xlsx';
}

export interface GeneratedReport {
  id: string;
  type: ReportType;
  name: string;
  dateFrom: string;
  dateTo: string;
  format: 'pdf' | 'xlsx';
  size: number;
  downloadUrl: string;
  createdAt: string;
  createdBy: string;
}

export interface NarrativeReport {
  id: string;
  period: string;
  markdownContent: string;
  generatedAt: string;
  generatedBy: string;
}

// ══════════════ CASH CLOSING TYPES ══════════════════════

export type ClosingStatus = 'OPEN' | 'PENDING_CLOSE' | 'CLOSED';
export type CashMovementType = 'ENTRY' | 'EXIT';
export type CashMovementCategory = 'SALE' | 'EXPENSE' | 'PAYMENT' | 'ADJUSTMENT' | 'OTHER';

export interface CashRegisterState {
  status: ClosingStatus;
  cashDayId?: string;
  openedAt?: string;
  openedBy?: string;
  reference?: string;
  openingBalance: number;
  theoreticalBalance: number;
  todayEntries: number;
  todayExits: number;
  todayPaymentsReceived: number;
  totalEntries: number;
  totalExits: number;
  movementsCount: number;
}

export interface CashMovement {
  id: string;
  cashDayId: string;
  cashDayRef: string;
  time: string;
  type: CashMovementType;
  category: CashMovementCategory;
  reference: string | null;
  description: string;
  amount: number;
}

export interface CreateCashMovementDto {
  type: CashMovementType;
  category: CashMovementCategory;
  amount: number;
  reference?: string;
  description: string;
}

export interface DayOperation {
  id: string;
  cashDayId: string;
  cashDayRef: string;
  time: string;
  type: CashMovementType;
  category: CashMovementCategory;
  reference: string | null;
  description: string;
  amount: number;
}

export interface CashClosingRecord {
  id: string;
  reference: string;
  status: string;
  openingBalance: number;
  totalEntries: number;
  totalExits: number;
  theoreticalBalance: number;
  actualBalance: number | null;
  variance: number;
  comment?: string | null;
  openedById: string;
  closedById: string | null;
  openedAt: string;
  closedAt: string | null;
  accountingProcessed?: boolean;
  accountingProcessedAt?: string | null;
  accountingProcessedBy?: string | null;
}

export interface CloseCashDto {
  actualBalance: number;
  comment?: string;
}

// ══════════════ ACCOUNTING ENTRIES (ÉCRITURES COMPTABLES) ═

export type AccountingEntryType = 'DEBIT' | 'CREDIT';

export interface AccountingEntry {
  id: string;
  date: string;
  journalCode: string; // e.g. 'OD', 'BQ', 'CA'
  accountNumber: string; // e.g. '571000', '411000'
  accountLabel: string;
  entryType: AccountingEntryType;
  debit: number;
  credit: number;
  reference: string; // operation ref e.g. 'VNT-2026-0201'
  label: string; // description of the entry
  operationType: 'SALE' | 'EXPENSE' | 'PAYMENT' | 'CLOSING_GAP';
}

export interface AccountingEntriesSummary {
  date: string;
  cashDayId?: string;
  cashDayReference?: string;
  cashDayStatus?: string;
  accountingProcessed?: boolean;
  accountingProcessedAt?: string;
  totalDebit: number;
  totalCredit: number;
  entriesCount: number;
  isBalanced: boolean;
  entries: AccountingEntry[];
}
