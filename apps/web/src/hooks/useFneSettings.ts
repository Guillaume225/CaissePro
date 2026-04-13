import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { FneSettingRecord, UpsertFneSettingPayload } from '@/types/fne';

const FNE_SETTINGS_KEYS = {
  all: ['fne-settings'] as const,
  byCompany: (companyId: string) => [...FNE_SETTINGS_KEYS.all, companyId] as const,
};

export function useFneSetting(companyId: string) {
  return useQuery({
    queryKey: FNE_SETTINGS_KEYS.byCompany(companyId),
    queryFn: async () => {
      const { data } = await api.get<FneSettingRecord | null>('/fne-settings', {
        params: { companyId },
      });
      return data;
    },
    enabled: !!companyId,
  });
}

export function useUpsertFneSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpsertFneSettingPayload) => {
      const { data } = await api.post<FneSettingRecord>('/fne-settings', payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: FNE_SETTINGS_KEYS.byCompany(variables.companyId) });
    },
  });
}
