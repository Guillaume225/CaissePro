import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Department, OrgService } from '@/types/admin';

const ORG_KEYS = {
  departments: ['organization', 'departments'] as const,
  services: ['organization', 'services'] as const,
};

// ── Departments ──────────────────────────────────────────
export function useDepartments() {
  return useQuery({
    queryKey: ORG_KEYS.departments,
    queryFn: async (): Promise<Department[]> => {
      const { data } = await api.get('/departments');
      return data.data ?? data;
    },
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<Department> => {
      const { data } = await api.post('/departments', { name });
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ORG_KEYS.departments }),
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }): Promise<Department> => {
      const { data } = await api.patch(`/departments/${id}`, { name });
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ORG_KEYS.departments }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/departments/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ORG_KEYS.departments }),
  });
}

// ── Services ─────────────────────────────────────────────
export function useOrgServices() {
  return useQuery({
    queryKey: ORG_KEYS.services,
    queryFn: async (): Promise<OrgService[]> => {
      const { data } = await api.get('/services');
      return data.data ?? data;
    },
  });
}

export function useCreateOrgService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: { name: string; departmentId: string }): Promise<OrgService> => {
      const { data } = await api.post('/services', dto);
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ORG_KEYS.services }),
  });
}

export function useUpdateOrgService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...dto
    }: { id: string; name?: string; departmentId?: string }): Promise<OrgService> => {
      const { data } = await api.patch(`/services/${id}`, dto);
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ORG_KEYS.services }),
  });
}

export function useDeleteOrgService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/services/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ORG_KEYS.services }),
  });
}
