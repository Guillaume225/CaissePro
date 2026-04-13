import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  FneDashboardKpis,
  FneMonthlyTrendItem,
  FneTopClient,
  FneStatusBreakdownItem,
} from '@/types/fne';

const KEYS = {
  kpis: ['fne-dashboard', 'kpis'] as const,
  monthlyTrend: ['fne-dashboard', 'monthly-trend'] as const,
  topClients: ['fne-dashboard', 'top-clients'] as const,
  statusBreakdown: ['fne-dashboard', 'status-breakdown'] as const,
};

export function useFneDashboardKpis() {
  return useQuery({
    queryKey: KEYS.kpis,
    queryFn: async (): Promise<FneDashboardKpis> => {
      const { data } = await api.get('/dashboard/fne/kpis');
      return data.data;
    },
    refetchInterval: 60_000,
  });
}

export function useFneMonthlyTrend() {
  return useQuery({
    queryKey: KEYS.monthlyTrend,
    queryFn: async (): Promise<FneMonthlyTrendItem[]> => {
      const { data } = await api.get('/dashboard/fne/monthly-trend');
      return data.data;
    },
  });
}

export function useFneTopClients() {
  return useQuery({
    queryKey: KEYS.topClients,
    queryFn: async (): Promise<FneTopClient[]> => {
      const { data } = await api.get('/dashboard/fne/top-clients');
      return data.data;
    },
  });
}

export function useFneStatusBreakdown() {
  return useQuery({
    queryKey: KEYS.statusBreakdown,
    queryFn: async (): Promise<FneStatusBreakdownItem[]> => {
      const { data } = await api.get('/dashboard/fne/status-breakdown');
      return data.data;
    },
  });
}
