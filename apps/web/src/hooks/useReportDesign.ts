import { useMemo } from 'react';
import {
  useReportConfigStore,
  type ReportFieldConfig,
  type ReportKpiConfig,
} from '@/stores/report-config-store';

export function useReportDesign(reportId: string) {
  const config = useReportConfigStore((s) => s.getConfig(reportId));

  return useMemo(() => {
    if (!config) {
      return {
        config: null,
        isFieldVisible: () => true,
        getFieldLabel: (key: string) => key,
        getVisibleFields: () => [] as ReportFieldConfig[],
        isKpiVisible: () => true,
        getKpiLabel: (key: string) => key,
        getVisibleKpis: () => [] as ReportKpiConfig[],
        header: null,
        footer: null,
      };
    }

    const sortedFields = [...config.fields].sort((a, b) => a.order - b.order);

    return {
      config,
      isFieldVisible: (key: string) => {
        const f = config.fields.find((ff) => ff.key === key);
        return f ? f.visible : true;
      },
      getFieldLabel: (key: string, fallback?: string) => {
        const f = config.fields.find((ff) => ff.key === key);
        if (!f) return fallback || key;
        return f.customLabel || f.label;
      },
      getVisibleFields: () => sortedFields.filter((f) => f.visible),
      isKpiVisible: (key: string) => {
        const k = config.kpis.find((kk) => kk.key === key);
        return k ? k.visible : true;
      },
      getKpiLabel: (key: string, fallback?: string) => {
        const k = config.kpis.find((kk) => kk.key === key);
        if (!k) return fallback || key;
        return k.customLabel || k.label;
      },
      getVisibleKpis: () => config.kpis.filter((k) => k.visible),
      header: config.header,
      footer: config.footer,
    };
  }, [config]);
}
