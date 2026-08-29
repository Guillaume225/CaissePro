import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  PaginatedPurchaseRequests,
  PurchasingFilters,
  PurchaseRequestDashboard,
  ProcessPurchaseRequestPayload,
} from '@/types/demande-achat';
import { PR_KEYS } from './usePurchaseRequests';

const PURCHASING_KEYS = {
  queueLists: () => ['purchase-requests', 'achats'] as const,
  queue: (filters?: PurchasingFilters) => [...PURCHASING_KEYS.queueLists(), filters] as const,
  toPriceLists: () => ['purchase-requests', 'to-price'] as const,
  toPrice: (filters?: PurchasingFilters) => [...PURCHASING_KEYS.toPriceLists(), filters] as const,
  dashboard: ['purchase-requests', 'dashboard'] as const,
};

// ── À chiffrer (avant entrée dans le circuit de validation) ──
export function usePurchasingToPrice(filters: PurchasingFilters = {}) {
  return useQuery({
    queryKey: PURCHASING_KEYS.toPrice(filters),
    queryFn: async (): Promise<PaginatedPurchaseRequests> => {
      const params: Record<string, string | number> = {};
      if (filters.service) params.service = filters.service;
      if (filters.requesterId) params.requesterId = filters.requesterId;
      if (filters.priority) params.priority = filters.priority;
      if (filters.page) params.page = filters.page;
      if (filters.perPage) params.perPage = filters.perPage;
      const { data } = await api.get('/demandes-achat/achats/to-price', { params });
      return data;
    },
  });
}

// ── Purchasing queue ──────────────────────────────────────
export function usePurchasingQueue(filters: PurchasingFilters = {}) {
  return useQuery({
    queryKey: PURCHASING_KEYS.queue(filters),
    queryFn: async (): Promise<PaginatedPurchaseRequests> => {
      const params: Record<string, string | number> = {};
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.service) params.service = filters.service;
      if (filters.requesterId) params.requesterId = filters.requesterId;
      if (filters.priority) params.priority = filters.priority;
      if (filters.amountMin !== undefined) params.amountMin = filters.amountMin;
      if (filters.amountMax !== undefined) params.amountMax = filters.amountMax;
      if (filters.category) params.category = filters.category;
      if (filters.status) {
        params.status = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;
      }
      if (filters.page) params.page = filters.page;
      if (filters.perPage) params.perPage = filters.perPage;
      const { data } = await api.get('/demandes-achat/achats/to-process', { params });
      return data;
    },
  });
}

function invalidateAfterAction(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: PR_KEYS.detail(id) });
  qc.invalidateQueries({ queryKey: PURCHASING_KEYS.queueLists() });
  qc.invalidateQueries({ queryKey: PURCHASING_KEYS.dashboard });
}

// ── Take over ─────────────────────────────────────────────
export function useTakeoverPurchaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.post(`/demandes-achat/achats/${id}/takeover`);
    },
    onSuccess: (_, id) => invalidateAfterAction(qc, id),
  });
}

// ── Process ───────────────────────────────────────────────
export function useProcessPurchaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: { id: string } & ProcessPurchaseRequestPayload): Promise<void> => {
      await api.post(`/demandes-achat/achats/${id}/process`, payload);
    },
    onSuccess: (_, { id }) => invalidateAfterAction(qc, id),
  });
}

// ── Close ─────────────────────────────────────────────────
export function useClosePurchaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment: string }): Promise<void> => {
      await api.post(`/demandes-achat/achats/${id}/close`, { comment });
    },
    onSuccess: (_, { id }) => invalidateAfterAction(qc, id),
  });
}

// ── Dashboard ─────────────────────────────────────────────
export function usePurchaseRequestDashboard() {
  return useQuery({
    queryKey: PURCHASING_KEYS.dashboard,
    queryFn: async (): Promise<PurchaseRequestDashboard> => {
      const { data } = await api.get('/dashboard-demande-achat');
      return data.data ?? data;
    },
  });
}
