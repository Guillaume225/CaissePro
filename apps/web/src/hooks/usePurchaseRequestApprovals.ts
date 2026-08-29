import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { PaginatedPurchaseRequests, PurchaseRequestFilters } from '@/types/demande-achat';
import { PR_KEYS } from './usePurchaseRequests';

const APPROVAL_KEYS = {
  toValidateLists: () => ['purchase-requests', 'to-validate'] as const,
  toValidate: (filters?: PurchaseRequestFilters) =>
    [...APPROVAL_KEYS.toValidateLists(), filters] as const,
};

// ── Queue: requests pending my approval ──────────────────
export function usePurchaseRequestsToValidate(filters: PurchaseRequestFilters = {}) {
  return useQuery({
    queryKey: APPROVAL_KEYS.toValidate(filters),
    queryFn: async (): Promise<PaginatedPurchaseRequests> => {
      const params: Record<string, string | number> = {};
      if (filters.status) {
        params.status = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;
      }
      if (filters.page) params.page = filters.page;
      if (filters.perPage) params.perPage = filters.perPage;
      if (filters.search) params.search = filters.search;
      const { data } = await api.get('/demandes-achat/to-validate', { params });
      return data;
    },
  });
}

function invalidateAfterAction(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: PR_KEYS.detail(id) });
  qc.invalidateQueries({ queryKey: PR_KEYS.mineLists() });
  qc.invalidateQueries({ queryKey: APPROVAL_KEYS.toValidateLists() });
}

// ── Approve ───────────────────────────────────────────────
export function useApprovePurchaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }): Promise<void> => {
      await api.post(`/demandes-achat/${id}/approve`, { comment });
    },
    onSuccess: (_, { id }) => invalidateAfterAction(qc, id),
  });
}

// ── Reject ────────────────────────────────────────────────
export function useRejectPurchaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, motif }: { id: string; motif: string }): Promise<void> => {
      await api.post(`/demandes-achat/${id}/reject`, { motif });
    },
    onSuccess: (_, { id }) => invalidateAfterAction(qc, id),
  });
}

// ── Return ────────────────────────────────────────────────
export function useReturnPurchaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, motif }: { id: string; motif: string }): Promise<void> => {
      await api.post(`/demandes-achat/${id}/return`, { motif });
    },
    onSuccess: (_, { id }) => invalidateAfterAction(qc, id),
  });
}
