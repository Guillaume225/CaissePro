import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  FnePointOfSaleRecord,
  CreateFnePointOfSalePayload,
  UpdateFnePointOfSalePayload,
  FnePaginatedResponse,
} from '@/types/fne';

const FNE_POS_KEYS = {
  all: ['fne-points-of-sale'] as const,
  lists: () => [...FNE_POS_KEYS.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...FNE_POS_KEYS.lists(), params] as const,
  details: () => [...FNE_POS_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...FNE_POS_KEYS.details(), id] as const,
};

export function useFnePointsOfSale(params: { search?: string; page?: number; perPage?: number; establishmentId?: string } = {}) {
  return useQuery({
    queryKey: FNE_POS_KEYS.list(params),
    queryFn: async () => {
      const { data } = await api.get<FnePaginatedResponse<FnePointOfSaleRecord>>('/fne-points-of-sale', { params });
      return data;
    },
    enabled: !!params.establishmentId,
  });
}

export function useFnePointOfSale(id: string) {
  return useQuery({
    queryKey: FNE_POS_KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get<FnePointOfSaleRecord>(`/fne-points-of-sale/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateFnePointOfSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateFnePointOfSalePayload) => {
      const { data } = await api.post<FnePointOfSaleRecord>('/fne-points-of-sale', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_POS_KEYS.lists() });
    },
  });
}

export function useUpdateFnePointOfSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateFnePointOfSalePayload }) => {
      const { data } = await api.put<FnePointOfSaleRecord>(`/fne-points-of-sale/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_POS_KEYS.all });
    },
  });
}

export function useDeleteFnePointOfSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/fne-points-of-sale/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_POS_KEYS.lists() });
    },
  });
}
