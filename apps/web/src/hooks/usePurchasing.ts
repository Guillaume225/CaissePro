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
  toPriceLists: () => ['purchase-requests', 'to-price'] as const,
  toPrice: (filters?: PurchasingFilters) => [...PURCHASING_KEYS.toPriceLists(), filters] as const,
  inCircuitLists: () => ['purchase-requests', 'in-circuit'] as const,
  inCircuit: (filters?: PurchasingFilters) => [...PURCHASING_KEYS.inCircuitLists(), filters] as const,
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

// ── En circuit de validation (palier de validation actif) ──
export function usePurchasingInCircuit(filters: PurchasingFilters = {}) {
  return useQuery({
    queryKey: PURCHASING_KEYS.inCircuit(filters),
    queryFn: async (): Promise<PaginatedPurchaseRequests> => {
      const params: Record<string, string | number> = {};
      if (filters.service) params.service = filters.service;
      if (filters.requesterId) params.requesterId = filters.requesterId;
      if (filters.priority) params.priority = filters.priority;
      if (filters.page) params.page = filters.page;
      if (filters.perPage) params.perPage = filters.perPage;
      const { data } = await api.get('/demandes-achat/achats/in-circuit', { params });
      return data;
    },
  });
}

function invalidateAfterAction(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: PR_KEYS.detail(id) });
  qc.invalidateQueries({ queryKey: PURCHASING_KEYS.queueLists() });
  qc.invalidateQueries({ queryKey: PURCHASING_KEYS.dashboard });
}

// ── Process (TRANSMITTED -> PROCESSED, "Générer le bon de commande") ──
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
