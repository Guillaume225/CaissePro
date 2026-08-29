import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  PurchaseRequest,
  PaginatedPurchaseRequests,
  PurchaseRequestFilters,
  CreatePurchaseRequestPayload,
  UpdatePurchaseRequestPayload,
  PurchaseRequestAttachment,
  PurchaseRequestDocumentType,
  LinePricingPayload,
} from '@/types/demande-achat';

// ── Query keys ───────────────────────────────────────────
const PR_KEYS = {
  all: ['purchase-requests'] as const,
  mineLists: () => [...PR_KEYS.all, 'mine'] as const,
  mine: (filters?: PurchaseRequestFilters) => [...PR_KEYS.mineLists(), filters] as const,
  allLists: () => [...PR_KEYS.all, 'all'] as const,
  allList: (filters?: PurchaseRequestFilters) => [...PR_KEYS.allLists(), filters] as const,
  details: () => [...PR_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...PR_KEYS.details(), id] as const,
};

// ── List: my requests ────────────────────────────────────
export function useMyPurchaseRequests(filters: PurchaseRequestFilters = {}, enabled = true) {
  return useQuery({
    queryKey: PR_KEYS.mine(filters),
    queryFn: async (): Promise<PaginatedPurchaseRequests> => {
      const params: Record<string, string | number> = {};
      if (filters.status) {
        params.status = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;
      }
      if (filters.page) params.page = filters.page;
      if (filters.perPage) params.perPage = filters.perPage;
      if (filters.search) params.search = filters.search;
      const { data } = await api.get('/demandes-achat/mine', { params });
      return data;
    },
    enabled,
  });
}

// ── List: all requests (requires da.view_all) ────────────
export function useAllPurchaseRequests(filters: PurchaseRequestFilters = {}, enabled = true) {
  return useQuery({
    queryKey: PR_KEYS.allList(filters),
    queryFn: async (): Promise<PaginatedPurchaseRequests> => {
      const params: Record<string, string | number> = {};
      if (filters.status) {
        params.status = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;
      }
      if (filters.page) params.page = filters.page;
      if (filters.perPage) params.perPage = filters.perPage;
      if (filters.search) params.search = filters.search;
      const { data } = await api.get('/demandes-achat', { params });
      return data;
    },
    enabled,
  });
}

// ── Detail ────────────────────────────────────────────────
export function usePurchaseRequest(id: string) {
  return useQuery({
    queryKey: PR_KEYS.detail(id),
    queryFn: async (): Promise<PurchaseRequest> => {
      const { data } = await api.get(`/demandes-achat/${id}`);
      return data.data ?? data;
    },
    enabled: !!id,
  });
}

// ── Create draft ──────────────────────────────────────────
export function useCreatePurchaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePurchaseRequestPayload): Promise<PurchaseRequest> => {
      const { data } = await api.post('/demandes-achat', payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_KEYS.mineLists() });
    },
  });
}

// ── Update draft ──────────────────────────────────────────
export function useUpdatePurchaseRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdatePurchaseRequestPayload): Promise<PurchaseRequest> => {
      const { data } = await api.patch(`/demandes-achat/${id}`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: PR_KEYS.mineLists() });
    },
  });
}

// ── Delete draft ──────────────────────────────────────────
export function useDeletePurchaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/demandes-achat/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_KEYS.mineLists() });
    },
  });
}

// ── Submit ────────────────────────────────────────────────
export function useSubmitPurchaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.post(`/demandes-achat/${id}/submit`);
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: PR_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: PR_KEYS.mineLists() });
    },
  });
}

// ── Cancel ────────────────────────────────────────────────
export function useCancelPurchaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }): Promise<void> => {
      await api.post(`/demandes-achat/${id}/cancel`, { reason });
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: PR_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: PR_KEYS.mineLists() });
    },
  });
}

// ── Comments ──────────────────────────────────────────────
export function useAddPurchaseRequestComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }): Promise<void> => {
      await api.post(`/demandes-achat/${id}/comments`, { message });
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: PR_KEYS.detail(id) });
    },
  });
}

// ── Attachments ───────────────────────────────────────────
export function useUploadPurchaseRequestAttachment(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      documentType,
    }: {
      file: File;
      documentType: PurchaseRequestDocumentType;
    }): Promise<PurchaseRequestAttachment> => {
      const form = new FormData();
      form.append('files', file);
      form.append('documentType', documentType);
      const { data } = await api.post(`/demandes-achat/${requestId}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_KEYS.detail(requestId) });
    },
  });
}

export function useDeletePurchaseRequestAttachment(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attachmentId: string): Promise<void> => {
      await api.delete(`/demandes-achat/${requestId}/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_KEYS.detail(requestId) });
    },
  });
}

// ── Chiffrage (service achats, avant entrée dans le circuit) ─
export function useUpdateLinePricing(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lines: LinePricingPayload[]): Promise<PurchaseRequest> => {
      const { data } = await api.patch(`/demandes-achat/${requestId}/pricing`, { lines });
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_KEYS.detail(requestId) });
    },
  });
}

export function useSubmitToCircuit(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<PurchaseRequest> => {
      const { data } = await api.post(`/demandes-achat/${requestId}/submit-to-circuit`);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_KEYS.detail(requestId) });
      qc.invalidateQueries({ queryKey: PR_KEYS.mineLists() });
    },
  });
}

export function useReopenToPricing(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<PurchaseRequest> => {
      const { data } = await api.post(`/demandes-achat/${requestId}/reopen-to-pricing`);
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PR_KEYS.detail(requestId) });
      qc.invalidateQueries({ queryKey: PR_KEYS.mineLists() });
    },
  });
}

export { PR_KEYS };
