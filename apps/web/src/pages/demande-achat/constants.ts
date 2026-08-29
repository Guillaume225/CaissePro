import type { PurchaseRequestPriority, PurchaseRequestStatus } from '@/types/demande-achat';

// ── Status badge classes (mirrors STATUS_CONFIG pattern used elsewhere) ──
export const STATUS_BADGE_CLASSES: Record<PurchaseRequestStatus, string> = {
  DRAFT: 'border border-zinc-300 text-zinc-600',
  SUBMITTED: 'bg-amber-50 text-amber-800',
  IN_VALIDATION: 'bg-amber-50 text-amber-800',
  VALIDATED: 'bg-[#eff6ff] text-[#1e40af]',
  TRANSMITTED: 'bg-[#eff6ff] text-[#1e40af]',
  TAKEN_OVER: 'bg-purple-50 text-purple-700',
  IN_PROCESS: 'bg-purple-50 text-purple-700',
  PROCESSED: 'bg-[#dcfce7] text-[#166534]',
  CLOSED: 'bg-zinc-100 text-zinc-600',
  REJECTED: 'bg-[#fee2e2] text-[#991b1b]',
  RETURNED: 'bg-orange-50 text-orange-700',
  CANCELLED: 'bg-[#fee2e2] text-[#991b1b]',
};

export const PRIORITY_BADGE_CLASSES: Record<PurchaseRequestPriority, string> = {
  NORMAL: 'bg-zinc-100 text-zinc-600',
  URGENT: 'bg-amber-50 text-amber-800',
  VERY_URGENT: 'bg-red-50 text-red-700',
};

export const ALL_STATUSES: PurchaseRequestStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'IN_VALIDATION',
  'VALIDATED',
  'TRANSMITTED',
  'TAKEN_OVER',
  'IN_PROCESS',
  'PROCESSED',
  'CLOSED',
  'REJECTED',
  'RETURNED',
  'CANCELLED',
];

export const DASHBOARD_STATUSES: PurchaseRequestStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'IN_VALIDATION',
  'RETURNED',
  'REJECTED',
  'VALIDATED',
  'TRANSMITTED',
  'TAKEN_OVER',
  'IN_PROCESS',
  'PROCESSED',
  'CLOSED',
];

export const PURCHASING_QUEUE_STATUSES: PurchaseRequestStatus[] = [
  'TRANSMITTED',
  'TAKEN_OVER',
  'IN_PROCESS',
];

// ── Lifecycle tracker (§4 du cahier des charges) ──
// Le parcours nominal d'une DA. REJETÉE/RETOURNÉE/ANNULÉE sont des sorties
// alternatives, pas des étapes de ce parcours — elles s'affichent à part.
export const MAIN_LIFECYCLE_STEPS: PurchaseRequestStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'IN_VALIDATION',
  'VALIDATED',
  'TRANSMITTED',
  'TAKEN_OVER',
  'IN_PROCESS',
  'PROCESSED',
  'CLOSED',
];

export const BRANCH_STATUSES: PurchaseRequestStatus[] = ['REJECTED', 'RETURNED', 'CANCELLED'];

export const DOCUMENT_TYPES = [
  'DEVIS',
  'FACTURE_PROFORMA',
  'CAHIER_CHARGES',
  'IMAGE',
  'FICHE_TECHNIQUE',
  'PDF',
  'EXCEL',
  'AUTRE',
] as const;

export function statusLabelKey(status: PurchaseRequestStatus): string {
  return `demandeAchat.status.${status}`;
}

export function priorityLabelKey(priority: PurchaseRequestPriority): string {
  return `demandeAchat.priority.${priority}`;
}
