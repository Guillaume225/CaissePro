import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  FneProductRecord,
  CreateFneProductPayload,
  UpdateFneProductPayload,
  FnePaginatedResponse,
} from '@/types/fne';

const FNE_PRODUCT_KEYS = {
  all: ['fne-products'] as const,
  lists: () => [...FNE_PRODUCT_KEYS.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...FNE_PRODUCT_KEYS.lists(), params] as const,
  details: () => [...FNE_PRODUCT_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...FNE_PRODUCT_KEYS.details(), id] as const,
};

export function useFneProducts(params: { search?: string; page?: number; perPage?: number } = {}) {
  return useQuery({
    queryKey: FNE_PRODUCT_KEYS.list(params),
    queryFn: async () => {
      const { data } = await api.get<FnePaginatedResponse<FneProductRecord>>('/fne-products', { params });
      return data;
    },
  });
}

export function useFneProduct(id: string) {
  return useQuery({
    queryKey: FNE_PRODUCT_KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get<FneProductRecord>(`/fne-products/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateFneProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateFneProductPayload) => {
      const { data } = await api.post<FneProductRecord>('/fne-products', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_PRODUCT_KEYS.lists() });
    },
  });
}

export function useUpdateFneProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateFneProductPayload }) => {
      const { data } = await api.put<FneProductRecord>(`/fne-products/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_PRODUCT_KEYS.all });
    },
  });
}

export function useDeleteFneProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/fne-products/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_PRODUCT_KEYS.lists() });
    },
  });
}
