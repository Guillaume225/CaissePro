import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ReportRequest, GeneratedReport, NarrativeReport } from '@/types/admin';

// ── Query keys ───────────────────────────────────────────
const REPORT_KEYS = {
  history: ['reports', 'history'] as const,
  narrative: (period?: string) => ['reports', 'narrative', period] as const,
};

// ═══════════════ REPORT GENERATION ═══════════════════════

export function useGenerateReport() {
  return useMutation({
    mutationFn: async (req: ReportRequest): Promise<GeneratedReport> => {
      const { data } = await api.post('/reports/generate', req);
      return data.data;
    },
  });
}

export function useReportHistory() {
  return useQuery({
    queryKey: REPORT_KEYS.history,
    queryFn: async (): Promise<GeneratedReport[]> => {
      const { data } = await api.get('/reports/history');
      return data.data;
    },
  });
}

// ═══════════════ NARRATIVE REPORT ════════════════════════

export function useNarrativeReport(period?: string) {
  return useQuery({
    queryKey: REPORT_KEYS.narrative(period),
    queryFn: async (): Promise<NarrativeReport> => {
      const { data } = await api.get('/reports/narrative', {
        params: period ? { period } : undefined,
      });
      return data.data;
    },
  });
}
