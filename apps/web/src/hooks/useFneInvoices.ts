import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  FneInvoice,
  FneInvoiceFilters,
  CreateFneInvoicePayload,
  UpdateFneInvoicePayload,
  CreateCreditNotePayload,
  FnePaginatedResponse,
} from '@/types/fne';

// ── Query keys ───────────────────────────────────────────
const FNE_KEYS = {
  all: ['fne-invoices'] as const,
  lists: () => [...FNE_KEYS.all, 'list'] as const,
  list: (f: FneInvoiceFilters) => [...FNE_KEYS.lists(), f] as const,
  details: () => [...FNE_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...FNE_KEYS.details(), id] as const,
  stickerBalance: ['fne-sticker-balance'] as const,
};

// ═══════════════ LIST ════════════════════════════════════

export function useFneInvoices(filters: FneInvoiceFilters) {
  return useQuery({
    queryKey: FNE_KEYS.list(filters),
    queryFn: async (): Promise<FnePaginatedResponse<FneInvoice>> => {
      const params: Record<string, string | number> = {};
      if (filters.page) params.page = filters.page;
      if (filters.perPage) params.perPage = filters.perPage;
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      const { data } = await api.get('/fne-invoices', { params });
      return data;
    },
  });
}

// ═══════════════ DETAIL ══════════════════════════════════

export function useFneInvoice(id: string) {
  return useQuery({
    queryKey: FNE_KEYS.detail(id),
    queryFn: async (): Promise<FneInvoice> => {
      const { data } = await api.get(`/fne-invoices/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ═══════════════ CREATE & CERTIFY ════════════════════════

export function useCreateFneInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateFneInvoicePayload): Promise<FneInvoice> => {
      const { data } = await api.post('/fne-invoices', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_KEYS.lists() });
      qc.invalidateQueries({ queryKey: FNE_KEYS.stickerBalance });
    },
  });
}

// ═══════════════ CERTIFY DRAFT ═══════════════════════════

export function useUpdateFneInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateFneInvoicePayload;
    }): Promise<FneInvoice> => {
      const { data } = await api.patch(`/fne-invoices/${id}`, payload);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: FNE_KEYS.lists() });
      qc.invalidateQueries({ queryKey: FNE_KEYS.detail(data.id) });
    },
  });
}

// ═══════════════ DECISION COMMENT ════════════════════════

export function useUpdateDecisionComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      comment,
    }: {
      id: string;
      comment: string | null;
    }): Promise<FneInvoice> => {
      const { data } = await api.patch(`/fne-invoices/${id}/decision-comment`, { comment });
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: FNE_KEYS.lists() });
      qc.invalidateQueries({ queryKey: FNE_KEYS.detail(data.id) });
    },
  });
}

// ═══════════════ CERTIFY DRAFT (certify) ═════════════════

export function useCertifyFneInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string): Promise<FneInvoice> => {
      const { data } = await api.post(`/fne-invoices/${invoiceId}/certify`);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: FNE_KEYS.lists() });
      qc.invalidateQueries({ queryKey: FNE_KEYS.detail(data.id) });
      qc.invalidateQueries({ queryKey: FNE_KEYS.stickerBalance });
    },
  });
}

// ═══════════════ CREDIT NOTE ═════════════════════════════

export function useCreateCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoiceId,
      payload,
    }: {
      invoiceId: string;
      payload: CreateCreditNotePayload;
    }): Promise<FneInvoice> => {
      const { data } = await api.post(`/fne-invoices/${invoiceId}/credit-note`, payload);
      return data;
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: FNE_KEYS.lists() });
      qc.invalidateQueries({ queryKey: FNE_KEYS.detail(variables.invoiceId) });
      qc.invalidateQueries({ queryKey: FNE_KEYS.detail(data.id) });
      qc.invalidateQueries({ queryKey: FNE_KEYS.stickerBalance });
    },
  });
}

// ═══════════════ DELETE (non-certified only) ═════════════

export function useDeleteFneInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string): Promise<void> => {
      await api.delete(`/fne-invoices/${invoiceId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_KEYS.lists() });
    },
  });
}

// ═══════════════ BULK DELETE ══════════════════════════════

export function useBulkDeleteFneInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      ids: string[],
    ): Promise<{ deleted: number; skipped: number; errors: string[] }> => {
      const { data } = await api.post('/fne-invoices/bulk-delete', { ids });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_KEYS.lists() });
    },
  });
}

// ═══════════════ BULK CERTIFY ═════════════════════════════

export function useBulkCertifyFneInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      ids: string[],
    ): Promise<{
      certified: number;
      errors: Array<{ id: string; reference?: string; error: string }>;
    }> => {
      const { data } = await api.post('/fne-invoices/bulk-certify', { ids });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_KEYS.lists() });
      qc.invalidateQueries({ queryKey: FNE_KEYS.stickerBalance });
    },
  });
}

// ═══════════════ IMPORT ═══════════════════════════════════

export function useImportFneInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      invoices: CreateFneInvoicePayload[],
    ): Promise<{ imported: number; errors: Array<{ index: number; error: string }> }> => {
      const { data } = await api.post('/fne-invoices/import', { invoices });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_KEYS.lists() });
    },
  });
}

// ═══════════════ STICKER BALANCE ═════════════════════════

export function useStickerBalance() {
  return useQuery({
    queryKey: FNE_KEYS.stickerBalance,
    queryFn: async (): Promise<number> => {
      const { data } = await api.get('/fne-invoices/sticker-balance');
      return data;
    },
    refetchInterval: 120_000,
  });
}
