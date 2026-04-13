import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  FneClientRecord,
  CreateFneClientPayload,
  UpdateFneClientPayload,
  FnePaginatedResponse,
} from '@/types/fne';

const FNE_CLIENT_KEYS = {
  all: ['fne-clients'] as const,
  lists: () => [...FNE_CLIENT_KEYS.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...FNE_CLIENT_KEYS.lists(), params] as const,
  details: () => [...FNE_CLIENT_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...FNE_CLIENT_KEYS.details(), id] as const,
};

export function useFneClients(params: { search?: string; page?: number; perPage?: number } = {}) {
  return useQuery({
    queryKey: FNE_CLIENT_KEYS.list(params),
    queryFn: async () => {
      const { data } = await api.get<FnePaginatedResponse<FneClientRecord>>('/fne-clients', { params });
      return data;
    },
  });
}

export function useFneClient(id: string) {
  return useQuery({
    queryKey: FNE_CLIENT_KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get<FneClientRecord>(`/fne-clients/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateFneClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateFneClientPayload) => {
      const { data } = await api.post<FneClientRecord>('/fne-clients', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_CLIENT_KEYS.lists() });
    },
  });
}

export function useUpdateFneClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateFneClientPayload }) => {
      const { data } = await api.put<FneClientRecord>(`/fne-clients/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_CLIENT_KEYS.all });
    },
  });
}

export function useDeleteFneClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/fne-clients/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FNE_CLIENT_KEYS.lists() });
    },
  });
}
