// ── Dashboard KPIs ───────────────────────────────────────
export interface DashboardKpis {
  cashBalance: number;
  monthExpenses: number;
  monthRevenue: number;
  outstandingReceivables: number;
  cashBalanceTrend: number;
  monthExpensesTrend: number;
  monthRevenueTrend: number;
  receivablesTrend: number;
}

// ── Charts ───────────────────────────────────────────────
export interface TreasuryPoint {
  month: string;
  amount: number;
}

export interface MonthlyComparison {
  month: string;
  expenses: number;
  revenue: number;
}

export interface CategoryBreakdown {
  name: string;
  value: number;
}

// ── AI Alerts ────────────────────────────────────────────
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type AlertType = 'ANOMALY' | 'BUDGET' | 'RECEIVABLE' | 'FORECAST';

export interface AiAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  entityRoute: string;
  createdAt: string;
  isRead: boolean;
}

// ── Module-specific KPIs ─────────────────────────────────

export interface ExpenseDashKpis {
  totalExpenses: number;
  pendingApprovals: number;
  budgetUtilization: number;
  overduePayments: number;
  totalExpensesTrend: number;
  pendingTrend: number;
  budgetTrend: number;
  overdueTrend: number;
}

export interface AdminDashKpis {
  totalUsers: number;
  activeUsers: number;
  totalRoles: number;
  auditEventsToday: number;
}

export interface RecentExpenseItem {
  id: string;
  reference: string;
  date: string;
  amount: number;
  categoryName: string;
  status: string;
  beneficiary: string | null;
}

export interface AuditLogEntry {
  id: string;
  userName: string;
  action: string;
  entityType: string;
  description: string;
  createdAt: string;
}

export interface RoleDistribution {
  name: string;
  count: number;
}

// ── Notifications ────────────────────────────────────────
export type NotificationType = 'EXPENSE' | 'SALE' | 'PAYMENT' | 'ALERT' | 'SYSTEM';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  entityRoute?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationFilters {
  type?: NotificationType;
  isRead?: boolean;
}

// ── Chat ─────────────────────────────────────────────────
export interface ChatSuggestedAction {
  label: string;
  action_type: 'navigate' | 'api_call' | 'filter';
  payload: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  chartData?: ChatChartData;
  suggested_actions?: ChatSuggestedAction[];
  timestamp: string;
}

export interface ChatChartData {
  type: 'bar' | 'line' | 'pie';
  data: Array<Record<string, string | number>>;
  dataKey: string;
  nameKey?: string;
  label?: string;
}
