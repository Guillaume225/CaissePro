import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  ErpSettingRecord,
  UpsertErpSettingPayload,
  ErpPostResult,
  ErpTestResult,
} from '@/types/fne';

const ERP_KEYS = {
  all: ['erp-settings'] as const,
  byCompany: (companyId: string) => [...ERP_KEYS.all, companyId] as const,
};

export function useErpSetting(companyId: string) {
  return useQuery({
    queryKey: ERP_KEYS.byCompany(companyId),
    queryFn: async () => {
      const { data } = await api.get<ErpSettingRecord | null>('/erp-settings', {
        params: { companyId },
      });
      return data;
    },
    enabled: !!companyId,
  });
}

export function useUpsertErpSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpsertErpSettingPayload) => {
      const { data } = await api.post<ErpSettingRecord>('/erp-settings', payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ERP_KEYS.byCompany(variables.companyId) });
    },
  });
}

export function useTestErpConnection() {
  return useMutation({
    mutationFn: async (companyId: string) => {
      const { data } = await api.post<ErpTestResult>('/erp-settings/test', { companyId });
      return data;
    },
  });
}

export function usePostToErp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceIds: string[]) => {
      const { data } = await api.post<ErpPostResult>('/erp/post-entries', { invoiceIds });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fne-accounting'] });
    },
  });
}

export function usePostAllToErp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ErpPostResult>('/erp/post-all');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fne-accounting'] });
    },
  });
}
