// ── Enums ────────────────────────────────────────────────
export type PurchaseRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_VALIDATION'
  | 'VALIDATED'
  | 'TRANSMITTED'
  | 'TAKEN_OVER'
  | 'IN_PROCESS'
  | 'PROCESSED'
  | 'CLOSED'
  | 'REJECTED'
  | 'RETURNED'
  | 'CANCELLED';

export type PurchaseRequestPriority = 'NORMAL' | 'URGENT' | 'VERY_URGENT';

export type PurchaseRequestDocumentType =
  | 'DEVIS'
  | 'FACTURE_PROFORMA'
  | 'CAHIER_CHARGES'
  | 'IMAGE'
  | 'FICHE_TECHNIQUE'
  | 'PDF'
  | 'EXCEL'
  | 'AUTRE';

export type PurchaseRequestHistoryAction =
  | 'CREATED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'RETURNED'
  | 'VALIDATED'
  | 'TRANSMITTED'
  | 'TAKEN_OVER'
  | 'PROCESSED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'COMMENT';

// ── Entities ─────────────────────────────────────────────
export interface PurchaseRequestLine {
  id: string;
  articleReference?: string;
  designation: string;
  description?: string;
  isOffCatalog: boolean;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
  estimatedAmount: number;
  desiredDate?: string;
  comment?: string;
}

export interface PurchaseRequestAttachment {
  id: string;
  fileId: string;
  fileName: string;
  documentType: PurchaseRequestDocumentType;
  uploadedById: string;
  uploadedByName?: string;
  uploadedAt: string;
}

export interface PurchaseRequestApproval {
  id: string;
  circuitId?: string | null;
  cycle: number;
  level: number;
  role: string;
  approverId?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  actionById?: string | null;
  actionAt?: string | null;
  comment?: string | null;
}

export interface PurchaseRequestHistoryEntry {
  id: string;
  actorId?: string;
  actorName?: string;
  action: PurchaseRequestHistoryAction;
  fromStatus?: PurchaseRequestStatus;
  toStatus?: PurchaseRequestStatus;
  comment?: string;
  createdAt: string;
}

export interface PurchaseRequest {
  id: string;
  number: string;
  requesterId: string;
  requesterName?: string;
  service: string;
  department: string;
  subject: string;
  justification: string;
  desiredDate: string;
  priority: PurchaseRequestPriority;
  urgencyReason?: string;
  project?: string;
  costCenter?: string;
  budget?: string;
  site?: string;
  generalComment?: string;
  status: PurchaseRequestStatus;
  totalEstimatedAmount: number;
  currentApprovalLevel?: number;
  cycle: number;
  submittedAt?: string;
  validatedAt?: string;
  transmittedAt?: string;
  takenOverAt?: string;
  takenOverById?: string;
  takenOverByName?: string;
  supplierId?: string | null;
  supplierName?: string | null;
  supplierCode?: string | null;
  supplierTaxNumber?: string | null;
  supplierRccm?: string | null;
  sagePosted?: boolean;
  sagePostedAt?: string | null;
  sageError?: string | null;
  processedAt?: string;
  closedAt?: string;
  closeComment?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseRequestLine[];
  attachments: PurchaseRequestAttachment[];
  history: PurchaseRequestHistoryEntry[];
  approvals: PurchaseRequestApproval[];
}

// ── Approval circuit ─────────────────────────────────────
export interface PurchaseRequestApprovalCircuitStep {
  id?: string;
  level: number;
  role: string;
  approverId: string | null;
  approverName?: string;
}

export interface PurchaseRequestApprovalCircuit {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number | null;
  isActive: boolean;
  steps: PurchaseRequestApprovalCircuitStep[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePurchaseRequestCircuitDto {
  name: string;
  minAmount: number;
  maxAmount: number | null;
  steps: PurchaseRequestApprovalCircuitStep[];
}

export interface UpdatePurchaseRequestCircuitDto {
  name?: string;
  minAmount?: number;
  maxAmount?: number | null;
  steps?: PurchaseRequestApprovalCircuitStep[];
  isActive?: boolean;
}

// ── Filters ──────────────────────────────────────────────
export interface PurchaseRequestFilters {
  status?: PurchaseRequestStatus | PurchaseRequestStatus[];
  page?: number;
  perPage?: number;
  search?: string;
}

export interface PurchasingFilters {
  dateFrom?: string;
  dateTo?: string;
  service?: string;
  requesterId?: string;
  priority?: PurchaseRequestPriority;
  amountMin?: number;
  amountMax?: number;
  category?: string;
  status?: PurchaseRequestStatus | PurchaseRequestStatus[];
  page?: number;
  perPage?: number;
}

// ── Form DTOs ────────────────────────────────────────────
export interface PurchaseRequestLinePayload {
  id?: string;
  articleReference?: string;
  designation: string;
  description?: string;
  isOffCatalog: boolean;
  quantity: number;
  unit: string;
  // Jamais renseigné par le demandeur — le prix est saisi par le service
  // achats lors du chiffrage (cf. LinePricingPayload / usePriceLines).
  estimatedUnitPrice?: number;
  desiredDate?: string;
  comment?: string;
}

export interface LinePricingPayload {
  lineId: string;
  estimatedUnitPrice: number;
}

export interface CreatePurchaseRequestPayload {
  service: string;
  department: string;
  subject: string;
  justification: string;
  desiredDate: string;
  priority: PurchaseRequestPriority;
  urgencyReason?: string;
  project?: string;
  costCenter?: string;
  budget?: string;
  site?: string;
  generalComment?: string;
  lines: PurchaseRequestLinePayload[];
}

export type UpdatePurchaseRequestPayload = Partial<CreatePurchaseRequestPayload>;

export interface ProcessPurchaseRequestPayload {
  supplierName: string;
  supplierCode: string;
  supplierTaxNumber: string;
  supplierRccm: string;
  comment?: string;
  additionalInfo?: string;
  expectedDate?: string;
  observation?: string;
}

// ── Fournisseur ──────────────────────────────────────────
export interface Supplier {
  id: string;
  name: string;
  code: string;
  taxNumber: string;
  rccm: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── API Responses ────────────────────────────────────────
export interface PaginatedPurchaseRequests {
  data: PurchaseRequest[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface PurchaseRequestDashboard {
  counts: Record<PurchaseRequestStatus, number>;
  totalAmount: number;
}
