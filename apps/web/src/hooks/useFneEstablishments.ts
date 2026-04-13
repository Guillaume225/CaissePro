import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  FneEstablishmentRecord,
  CreateFneEstablishmentPayload,
  UpdateFneEstablishmentPayload,
  FnePaginatedResponse,
} from '@/types/fne';

const FNE_EST_KEYS = {
  all: ['fne-establishments'] as const,
  lists: () => [...FNE_EST_KEYS.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...FNE_EST_KEYS.lists(), params] as const,
  details: () => [...FNE_EST_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...FNE_EST_KEYS.details(), id] as const,
};

export function useFneEstablishments(params: { search?: string; page?: number; perPage?: number; companyId?: string } = {}) {
  return useQuery({
    queryKey: FNE_EST_KEYS.list(params),
    queryFn: async () => {
      const { data } = await api.get<FnePaginatedResponse<FneEstablishmentRecord>>('/fne-establishments', { params });
      return data;
    },
  });
}

export function useFneEstablishment(id: string) {
  return useQuery({
    queryKey: FNE_EST_KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get<FneEstablishmentRecord>(`/fne-establishments/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateFneEstablishment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateFneEstablishmentPayload) => {
      const { data } = await api.post<FneEstablishmentRecord>('/fne-establishments', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_EST_KEYS.lists() });
    },
  });
}

export function useUpdateFneEstablishment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateFneEstablishmentPayload }) => {
      const { data } = await api.put<FneEstablishmentRecord>(`/fne-establishments/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_EST_KEYS.all });
    },
  });
}

export function useDeleteFneEstablishment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/fne-establishments/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_EST_KEYS.lists() });
    },
  });
}
