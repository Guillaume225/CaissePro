import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type {
  CashRegisterState,
  DayOperation,
  CashClosingRecord,
  CloseCashDto,
  CreateCashMovementDto,
  AccountingEntriesSummary,
} from '@/types/admin';

// ── Query keys (user-scoped) ─────────────────────────────
function useClosingKeys() {
  const userId = useAuthStore((s) => s.user?.id ?? '__anon__');
  return {
    state: ['closing', 'state', userId] as const,
    operations: ['closing', 'operations', userId] as const,
    history: ['closing', 'history'] as const,
    accountingEntries: ['closing', 'accounting-entries', userId] as const,
  };
}

// ═══════════════ CASH STATE ══════════════════════════════

export function useCashState() {
  const keys = useClosingKeys();
  return useQuery({
    queryKey: keys.state,
    queryFn: async (): Promise<CashRegisterState> => {
      const { data } = await api.get('/closing/state');
      return data.data;
    },
    refetchInterval: 30_000,
  });
}

export function useDayOperations() {
  const keys = useClosingKeys();
  return useQuery({
    queryKey: keys.operations,
    queryFn: async (): Promise<DayOperation[]> => {
      const { data } = await api.get('/closing/operations');
      return data.data;
    },
    refetchInterval: 30_000,
  });
}

// ═══════════════ OPEN / CLOSE ════════════════════════════

export function useOpenCash() {
  const qc = useQueryClient();
  const keys = useClosingKeys();
  return useMutation({
    mutationFn: async (openingBalance: number) => {
      const { data } = await api.post('/closing/open', { openingBalance });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.state });
      qc.invalidateQueries({ queryKey: keys.operations });
    },
  });
}

export function useCloseCash() {
  const qc = useQueryClient();
  const keys = useClosingKeys();
  return useMutation({
    mutationFn: async (dto: CloseCashDto) => {
      const { data } = await api.post('/closing/close', dto);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.state });
      qc.invalidateQueries({ queryKey: keys.history });
      qc.invalidateQueries({ queryKey: keys.operations });
    },
  });
}

// ═══════════════ ADD MOVEMENT ════════════════════════════

export function useAddCashMovement() {
  const qc = useQueryClient();
  const keys = useClosingKeys();
  return useMutation({
    mutationFn: async (dto: CreateCashMovementDto) => {
      const { data } = await api.post('/closing/movements', dto);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.state });
      qc.invalidateQueries({ queryKey: keys.operations });
    },
  });
}

// ═══════════════ HISTORY ═════════════════════════════════

export function useClosingHistory() {
  const keys = useClosingKeys();
  return useQuery({
    queryKey: keys.history,
    queryFn: async (): Promise<CashClosingRecord[]> => {
      const { data } = await api.get('/closing/history');
      return data.data;
    },
  });
}

/** Fetch closed cash days within a date range (for period reports) */
export function usePeriodClosingHistory(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['closing', 'period-history', dateFrom, dateTo] as const,
    queryFn: async (): Promise<CashClosingRecord[]> => {
      const { data } = await api.get('/closing/history', {
        params: { status: 'CLOSED', dateFrom, dateTo, perPage: 500, sortBy: 'openedAt', sortOrder: 'ASC' },
      });
      return data.data;
    },
    enabled: !!dateFrom && !!dateTo,
  });
}

// ═══════════════ OPEN CASH DAYS (for Manager) ════════════

export interface CashDayRow {
  id: string;
  reference: string;
  status: 'OPEN' | 'PENDING_CLOSE' | 'CLOSED';
  openingBalance: number;
  totalEntries: number;
  totalExits: number;
  theoreticalBalance: number;
  actualBalance: number | null;
  variance: number;
  comment: string | null;
  openedById: string;
  closedById: string | null;
  openedAt: string;
  closedAt: string | null;
}

export function useOpenCashDays() {
  return useQuery({
    queryKey: ['closing', 'open-days'],
    queryFn: async (): Promise<CashDayRow[]> => {
      const { data } = await api.get('/closing/history', {
        params: { status: 'OPEN,PENDING_CLOSE', perPage: 100 },
      });
      return data.data;
    },
    refetchInterval: 30_000,
  });
}

// ═══════════════ CASH DAY DETAIL (by ID) ═════════════════

export interface CashDayDetail extends CashDayRow {
  openedByName: string;
  closedByName: string | null;
}

export interface CashDayMovement {
  id: string;
  cashDayId: string;
  cashDayRef: string;
  time: string;
  type: 'ENTRY' | 'EXIT';
  category: string;
  reference: string | null;
  description: string;
  amount: number;
}

export interface CashDayExpense {
  id: string;
  reference: string;
  amount: number;
  status: string;
  beneficiary: string;
  paymentMethod: string;
  date: string;
  observations: string | null;
  categoryName: string | null;
  categoryDirection: 'ENTRY' | 'EXIT' | null;
  createdAt: string;
}

export function useCashDayDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['closing', 'day', id],
    queryFn: async (): Promise<CashDayDetail> => {
      const { data } = await api.get(`/closing/${id}`);
      return data.data;
    },
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

export function useCashDayOperations(id: string | undefined) {
  return useQuery({
    queryKey: ['closing', 'day-operations', id],
    queryFn: async (): Promise<{ movements: CashDayMovement[]; expenses: CashDayExpense[] }> => {
      const { data } = await api.get(`/closing/${id}/operations`);
      return data.data;
    },
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

/** Fetch operations for multiple cash days (for period reports) */
export function useMultiDayOperations(dayIds: string[]) {
  return useQuery({
    queryKey: ['closing', 'multi-day-operations', ...dayIds],
    queryFn: async (): Promise<Record<string, { movements: CashDayMovement[]; expenses: CashDayExpense[] }>> => {
      const results: Record<string, { movements: CashDayMovement[]; expenses: CashDayExpense[] }> = {};
      await Promise.all(
        dayIds.map(async (id) => {
          const { data } = await api.get(`/closing/${id}/operations`);
          results[id] = data.data;
        }),
      );
      return results;
    },
    enabled: dayIds.length > 0,
  });
}

// ═══════════════ LOCK / UNLOCK ═══════════════════════════

export function useLockCash() {
  const qc = useQueryClient();
  const keys = useClosingKeys();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/closing/lock');
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.state });
      qc.invalidateQueries({ queryKey: keys.operations });
    },
  });
}

export function useUnlockCash() {
  const qc = useQueryClient();
  const keys = useClosingKeys();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/closing/unlock');
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.state });
      qc.invalidateQueries({ queryKey: keys.operations });
    },
  });
}

// ═══════════════ ACCOUNTING ENTRIES ══════════════════════

export function useAccountingEntries(enabled = true, cashDayId?: string) {
  const keys = useClosingKeys();
  return useQuery({
    queryKey: [...keys.accountingEntries, cashDayId ?? 'current'] as const,
    queryFn: async (): Promise<AccountingEntriesSummary> => {
      const params = cashDayId ? { cashDayId } : {};
      const { data } = await api.get('/closing/accounting-entries', { params });
      return data.data;
    },
    enabled,
  });
}

/** Fetch accounting entries for multiple cash days (for period reports) */
export function useMultiDayAccountingEntries(dayIds: string[]) {
  return useQuery({
    queryKey: ['closing', 'multi-accounting-entries', ...dayIds],
    queryFn: async (): Promise<AccountingEntriesSummary[]> => {
      const results = await Promise.all(
        dayIds.map(async (id) => {
          const { data } = await api.get('/closing/accounting-entries', { params: { cashDayId: id } });
          return data.data as AccountingEntriesSummary;
        }),
      );
      return results;
    },
    enabled: dayIds.length > 0,
  });
}

export function useProcessAccounting() {
  const qc = useQueryClient();
  const keys = useClosingKeys();
  return useMutation({
    mutationFn: async (cashDayId: string) => {
      const { data } = await api.post('/closing/accounting-entries/process', { cashDayId });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.accountingEntries });
      qc.invalidateQueries({ queryKey: keys.history });
    },
  });
}

export function useCancelAccounting() {
  const qc = useQueryClient();
  const keys = useClosingKeys();
  return useMutation({
    mutationFn: async (cashDayId: string) => {
      const { data } = await api.post('/closing/accounting-entries/cancel', { cashDayId });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.accountingEntries });
      qc.invalidateQueries({ queryKey: keys.history });
    },
  });
}
