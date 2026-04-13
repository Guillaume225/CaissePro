// ── Enums ────────────────────────────────────────────────
export type ExpenseStatus = 'DRAFT' | 'PENDING' | 'APPROVED_L1' | 'APPROVED_L2' | 'PAID' | 'REJECTED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CHECK' | 'TRANSFER' | 'MOBILE_MONEY';

// ── Entities ─────────────────────────────────────────────
export interface Expense {
  id: string;
  reference: string;
  date: string;
  amount: number;
  description: string | null;
  beneficiary: string | null;
  paymentMethod: PaymentMethod;
  status: ExpenseStatus;
  observations: string | null;
  categoryId: string;
  categoryName: string;
  subCategoryId?: string | null;
  subCategoryName?: string | null;
  createdById: string;
  createdByName: string;
  cashDayId?: string | null;
  cashDayRef?: string | null;
  costCenterId: string | null;
  projectId: string | null;
  disbursementRequestId?: string | null;
  currentApprovalLevel?: number | null;
  approvals: ExpenseApproval[];
  attachments: ExpenseAttachment[];
  aiCategoryConfidence?: number | null;
  aiAnomalyScore?: number | null;
  aiAnomalyReasons?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseApproval {
  id: string;
  approverId: string;
  approverName: string;
  level: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comment: string | null;
  approvedAt: string | null;
}

export interface ExpenseAttachment {
  id: string;
  filePath: string;
  fileType: string;
  originalFilename: string;
  ocrData: OcrResult | null;
  createdAt: string;
}

export interface OcrResult {
  detectedAmount?: number;
  detectedDate?: string;
  detectedVendor?: string;
  confidence: number;
  rawText?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  parentName: string | null;
  budgetLimit: number | null;
  isActive: boolean;
  direction?: 'ENTRY' | 'EXIT';
  children: ExpenseCategory[];
}

export interface MonthlyTrendItem {
  month: string;
  amount: number;
}

// ── Filters ──────────────────────────────────────────────
export interface ExpenseFilters {
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  status?: ExpenseStatus | ExpenseStatus[];
  categoryId?: string;
  beneficiary?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  search?: string;
  cashDayId?: string;
}

// ── Form DTOs ────────────────────────────────────────────
export interface CreateExpensePayload {
  date: string;
  amount: number;
  description?: string;
  beneficiary?: string;
  paymentMethod: PaymentMethod;
  categoryId: string;
  subCategoryId?: string;
  observations?: string;
  costCenterId?: string;
  projectId?: string;
  disbursementRequestId?: string;
  isDraft?: boolean;
}

export type UpdateExpensePayload = Partial<CreateExpensePayload>;

// ── API Responses ────────────────────────────────────────
export interface PaginatedExpenses {
  data: Expense[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface AiCategorySuggestion {
  categoryId: string;
  categoryName: string;
  confidence: number;
  alternatives: { categoryId: string; categoryName: string; confidence: number }[];
}

export interface AiAnomalyResult {
  score: number;
  reasons: string[];
}
