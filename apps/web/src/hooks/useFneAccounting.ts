import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  FneAccountingEntryRecord,
  FneAccountingFilters,
  FnePaginatedResponse,
  GenerateEntriesResult,
} from '@/types/fne';

const QK = 'fne-accounting';

export function useFneAccountingEntries(filters: FneAccountingFilters) {
  return useQuery({
    queryKey: [QK, filters],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (filters.page) params.page = filters.page;
      if (filters.perPage) params.perPage = filters.perPage;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.invoiceReference) params.invoiceReference = filters.invoiceReference;
      const { data } = await api.get<FnePaginatedResponse<FneAccountingEntryRecord>>(
        '/fne-accounting',
        { params },
      );
      return data;
    },
  });
}

export function useGenerateFneAccounting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceIds: string[]) => {
      const { data } = await api.post<GenerateEntriesResult>('/fne-accounting/generate', {
        invoiceIds,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
  });
}

export function useDeleteFneAccountingByInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      await api.delete(`/fne-accounting/${invoiceId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
  });
}

export function useDeleteAllFneAccounting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete<{ deleted: number; protected: number }>(
        '/fne-accounting',
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
  });
}

/** Count of Sage-posted entries that can still be reversed (contre-passation). */
export function useReversibleFneAccountingCount() {
  return useQuery({
    queryKey: [QK, 'reversible-count'],
    queryFn: async () => {
      const { data } = await api.get<{ count: number }>('/fne-accounting/reversible-count');
      return data;
    },
  });
}

/** Cancel all Sage-posted entries via a contre-passation (reversal entries), not deletion. */
export function useReverseFneAccounting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ reversed: number; invoicesAffected: number }>(
        '/fne-accounting/reverse',
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
  });
}

export function useFneProcessedInvoiceIds(invoiceIds: string[]) {
  return useQuery({
    queryKey: [QK, 'processed-ids', invoiceIds],
    queryFn: async () => {
      if (!invoiceIds.length) return [];
      const { data } = await api.post<string[]>('/fne-accounting/processed-ids', { invoiceIds });
      return data;
    },
    enabled: invoiceIds.length > 0,
  });
}
