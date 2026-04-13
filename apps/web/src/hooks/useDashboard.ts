import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  DashboardKpis,
  TreasuryPoint,
  MonthlyComparison,
  CategoryBreakdown,
  AiAlert,
  AppNotification,
  NotificationFilters,
  ChatMessage,
  ExpenseDashKpis,
  AdminDashKpis,
  RecentExpenseItem,
  AuditLogEntry,
  RoleDistribution,
} from '@/types/dashboard';

// ── Query keys ───────────────────────────────────────────
const DASH_KEYS = {
  all: ['dashboard'] as const,
  kpis: ['dashboard', 'kpis'] as const,
  treasury: ['dashboard', 'treasury'] as const,
  comparison: ['dashboard', 'comparison'] as const,
  categoryBreakdown: ['dashboard', 'category-breakdown'] as const,
  alerts: ['dashboard', 'ai-alerts'] as const,
  expenseKpis: ['dashboard', 'expense-kpis'] as const,
  expenseMonthlyTrend: ['dashboard', 'expense-monthly-trend'] as const,
  expenseRecent: ['dashboard', 'expense-recent'] as const,
  adminKpis: ['dashboard', 'admin-kpis'] as const,
  adminRecentLogs: ['dashboard', 'admin-recent-logs'] as const,
  adminRoleDistribution: ['dashboard', 'admin-role-distribution'] as const,
  adminHourlyActivity: ['dashboard', 'admin-hourly-activity'] as const,
};

const NOTIF_KEYS = {
  all: ['notifications'] as const,
  list: (f?: NotificationFilters) => [...NOTIF_KEYS.all, 'list', f] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};

// ═══════════════ DASHBOARD KPIs ══════════════════════════

export function useDashboardKpis() {
  return useQuery({
    queryKey: DASH_KEYS.kpis,
    queryFn: async (): Promise<DashboardKpis> => {
      const { data } = await api.get('/dashboard/kpis');
      return data.data;
    },
    refetchInterval: 60_000,
  });
}

// ═══════════════ CHARTS ══════════════════════════════════

export function useTreasuryChart() {
  return useQuery({
    queryKey: DASH_KEYS.treasury,
    queryFn: async (): Promise<TreasuryPoint[]> => {
      const { data } = await api.get('/dashboard/treasury');
      return data.data;
    },
  });
}

export function useMonthlyComparison() {
  return useQuery({
    queryKey: DASH_KEYS.comparison,
    queryFn: async (): Promise<MonthlyComparison[]> => {
      const { data } = await api.get('/dashboard/monthly-comparison');
      return data.data;
    },
  });
}

export function useCategoryBreakdown() {
  return useQuery({
    queryKey: DASH_KEYS.categoryBreakdown,
    queryFn: async (): Promise<CategoryBreakdown[]> => {
      const { data } = await api.get('/dashboard/expense-categories');
      return data.data;
    },
  });
}

// ═══════════════ AI ALERTS ═══════════════════════════════

export function useAiAlerts() {
  return useQuery({
    queryKey: DASH_KEYS.alerts,
    queryFn: async (): Promise<AiAlert[]> => {
      const { data } = await api.get('/ai/alerts');
      return data.data;
    },
    refetchInterval: 120_000,
  });
}

// ═══════════════ EXPENSE MODULE ══════════════════════════

export function useExpenseDashKpis() {
  return useQuery({
    queryKey: DASH_KEYS.expenseKpis,
    queryFn: async (): Promise<ExpenseDashKpis> => {
      const { data } = await api.get('/dashboard/expense/kpis');
      return data.data;
    },
    refetchInterval: 60_000,
  });
}

export function useExpenseMonthlyTrend() {
  return useQuery({
    queryKey: DASH_KEYS.expenseMonthlyTrend,
    queryFn: async (): Promise<TreasuryPoint[]> => {
      const { data } = await api.get('/dashboard/expense/monthly-trend');
      return data.data;
    },
  });
}

export function useRecentExpenses() {
  return useQuery({
    queryKey: DASH_KEYS.expenseRecent,
    queryFn: async (): Promise<RecentExpenseItem[]> => {
      const { data } = await api.get('/dashboard/expense/recent');
      return data.data;
    },
  });
}

// ═══════════════ ADMIN MODULE ════════════════════════════

export function useAdminDashKpis() {
  return useQuery({
    queryKey: DASH_KEYS.adminKpis,
    queryFn: async (): Promise<AdminDashKpis> => {
      const { data } = await api.get('/dashboard/admin/kpis');
      return data.data;
    },
    refetchInterval: 60_000,
  });
}

export function useRecentAuditLogs() {
  return useQuery({
    queryKey: DASH_KEYS.adminRecentLogs,
    queryFn: async (): Promise<AuditLogEntry[]> => {
      const { data } = await api.get('/dashboard/admin/recent-logs');
      return data.data;
    },
  });
}

export function useRoleDistribution() {
  return useQuery({
    queryKey: DASH_KEYS.adminRoleDistribution,
    queryFn: async (): Promise<RoleDistribution[]> => {
      const { data } = await api.get('/dashboard/admin/role-distribution');
      return data.data;
    },
  });
}

export function useHourlyActivity() {
  return useQuery({
    queryKey: DASH_KEYS.adminHourlyActivity,
    queryFn: async (): Promise<{ hour: string; events: number }[]> => {
      const { data } = await api.get('/dashboard/admin/hourly-activity');
      return data.data;
    },
  });
}

// ═══════════════ NOTIFICATIONS ═══════════════════════════

export function useNotifications(filters?: NotificationFilters) {
  return useQuery({
    queryKey: NOTIF_KEYS.list(filters),
    queryFn: async (): Promise<AppNotification[]> => {
      const params: Record<string, string | boolean> = {};
      if (filters?.type) params.type = filters.type;
      if (filters?.isRead !== undefined) params.isRead = filters.isRead;
      const { data } = await api.get('/notifications', { params });
      return data.data;
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: NOTIF_KEYS.unreadCount,
    queryFn: async (): Promise<number> => {
      const { data } = await api.get('/notifications/unread-count');
      return data.data;
    },
    refetchInterval: 30_000,
  });
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIF_KEYS.all });
    },
  });
}

export function useMarkAllAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await api.patch('/notifications/read-all');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIF_KEYS.all });
    },
  });
}

// ═══════════════ AI CHAT ═════════════════════════════════

interface SendChatParams {
  message: string;
  module: string;
  conversationHistory: Array<{ role: string; content: string }>;
  userRole: string;
  allowedModules: string[];
}

export function useSendChatMessage() {
  return useMutation({
    mutationFn: async (params: SendChatParams): Promise<ChatMessage> => {
      const { data } = await api.post('/ai/chat', {
        message: params.message,
        module: params.module,
        conversation_history: params.conversationHistory,
        user_role: params.userRole,
        allowed_modules: params.allowedModules,
      });
      // ai-service returns the response directly (not wrapped in { data })
      return data.data ?? data;
    },
  });
}

// ═══════════════ CONVERSATIONAL CHATBOT ══════════════════

interface SendConversationalParams {
  message: string;
  conversationHistory: Array<{ role: string; content: string }>;
}

export function useSendConversationalMessage() {
  return useMutation({
    mutationFn: async (params: SendConversationalParams): Promise<ChatMessage> => {
      const { data } = await api.post('/ai/chat/conversational', {
        message: params.message,
        conversation_history: params.conversationHistory,
      });
      return data.data ?? data;
    },
  });
}
