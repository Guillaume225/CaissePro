import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  Expense,
  PaginatedExpenses,
  ExpenseFilters,
  ExpenseCategory,
  CreateExpensePayload,
  UpdateExpensePayload,
  AiCategorySuggestion,
  AiAnomalyResult,
} from '@/types/expense';

const EXPENSE_KEYS = {
  all: ['expenses'] as const,
  lists: () => [...EXPENSE_KEYS.all, 'list'] as const,
  list: (filters: ExpenseFilters) => [...EXPENSE_KEYS.lists(), filters] as const,
  details: () => [...EXPENSE_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...EXPENSE_KEYS.details(), id] as const,
  categories: ['expense-categories'] as const,
};

// ── List expenses ────────────────────────────────────────
export function useExpenses(filters: ExpenseFilters) {
  return useQuery({
    queryKey: EXPENSE_KEYS.list(filters),
    queryFn: async (): Promise<PaginatedExpenses> => {
      const params: Record<string, string | number> = {};
      if (filters.page) params.page = filters.page;
      if (filters.perPage) params.perPage = filters.perPage;
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.sortOrder) params.sortOrder = filters.sortOrder;
      if (filters.status) {
        params.status = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;
      }
      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.search) params.search = filters.search;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.amountMin !== undefined) params.amountMin = filters.amountMin;
      if (filters.amountMax !== undefined) params.amountMax = filters.amountMax;
      if (filters.cashDayId) params.cashDayId = filters.cashDayId;
      const { data } = await api.get('/expenses', { params });
      return data;
    },
  });
}

// ── Get expense detail ───────────────────────────────────
export function useExpense(id: string) {
  return useQuery({
    queryKey: EXPENSE_KEYS.detail(id),
    queryFn: async (): Promise<Expense> => {
      const { data } = await api.get(`/expenses/${id}`);
      return data.data ?? data;
    },
    enabled: !!id,
  });
}

// ── Categories ───────────────────────────────────────────
export function useExpenseCategories() {
  return useQuery({
    queryKey: EXPENSE_KEYS.categories,
    queryFn: async (): Promise<ExpenseCategory[]> => {
      const { data } = await api.get('/expenses/categories');
      return data.data;
    },
    staleTime: 30 * 60 * 1000, // 30 min: categories rarely change
  });
}

// ── Create expense ───────────────────────────────────────
export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateExpensePayload): Promise<Expense> => {
      const { data } = await api.post('/expenses', payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.lists() });
    },
  });
}

// ── Update expense ───────────────────────────────────────
export function useUpdateExpense(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateExpensePayload): Promise<Expense> => {
      const { data } = await api.put(`/expenses/${id}`, payload);
      return data.data ?? data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.lists() });
    },
  });
}

// ── Submit expense (DRAFT → PENDING) ─────────────────────
export function useSubmitExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.post(`/expenses/${id}/submit`);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.lists() });
    },
  });
}

// ── Delete expense ───────────────────────────────────────
export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.lists() });
    },
  });
}

// ── Approve expense ──────────────────────────────────────
export function useApproveExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }): Promise<void> => {
      await api.post(`/expenses/${id}/approve`, { comment });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.lists() });
    },
  });
}

// ── Reject expense ───────────────────────────────────────
export function useRejectExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment: string }): Promise<void> => {
      await api.post(`/expenses/${id}/reject`, { comment });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.lists() });
    },
  });
}

// ── Pay expense ──────────────────────────────────────────
export function usePayExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.post(`/expenses/${id}/pay`);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.lists() });
    },
  });
}

// ── Upload attachment ────────────────────────────────────
export function useUploadAttachment(expenseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`/expenses/${expenseId}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.detail(expenseId) });
    },
  });
}

// ── AI: suggest category ─────────────────────────────────
export function useAiCategorySuggestion() {
  return useMutation({
    mutationFn: async (payload: {
      description?: string;
      beneficiary?: string;
      amount: number;
    }): Promise<AiCategorySuggestion> => {
      const { data } = await api.post('/ai/expenses/categorize', payload);
      return data.data;
    },
    onError: () => {
      /* AI service unavailable — non-blocking */
    },
  });
}

// ── AI: anomaly score ────────────────────────────────────
export function useAiAnomalyCheck() {
  return useMutation({
    mutationFn: async (payload: {
      amount: number;
      categoryId: string;
      beneficiary?: string;
      date: string;
    }): Promise<AiAnomalyResult> => {
      const { data } = await api.post('/ai/expenses/anomaly-check', payload);
      return data.data;
    },
    onError: () => {
      /* AI service unavailable — non-blocking */
    },
  });
}

// ── Export ────────────────────────────────────────────────
export function useExportExpenses() {
  return useMutation({
    mutationFn: async ({
      format,
      filters,
    }: {
      format: 'csv' | 'xlsx';
      filters?: ExpenseFilters;
    }) => {
      const { data } = await api.get('/expenses/export', {
        params: { format, ...filters },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `depenses_${new Date().toISOString().slice(0, 10)}.${format}`;
      link.click();
      window.URL.revokeObjectURL(url);
    },
  });
}
