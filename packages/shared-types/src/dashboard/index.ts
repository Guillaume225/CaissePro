/* ═══════════════════════════════════════════
 *  Dashboard Types
 * ═══════════════════════════════════════════ */

/* ─── KPI ─── */

export interface KPIData {
  label: string;
  value: number;
  previousValue: number | null;
  changePercent: number | null;
  changeDirection: 'UP' | 'DOWN' | 'STABLE';
  unit: 'currency' | 'count' | 'percent';
  period: string;
}

/* ─── Charts ─── */

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color?: string;
}

export interface ChartData {
  title: string;
  type: 'bar' | 'line' | 'pie' | 'donut' | 'area' | 'stacked-bar';
  series: ChartSeries[];
  xAxisLabel?: string;
  yAxisLabel?: string;
}

/* ─── Cash Flow ─── */

export interface CashFlowData {
  period: string;
  openingBalance: number;
  totalInflows: number;
  totalOutflows: number;
  closingBalance: number;
  breakdown: {
    inflows: CashFlowBreakdownItem[];
    outflows: CashFlowBreakdownItem[];
  };
}

export interface CashFlowBreakdownItem {
  category: string;
  amount: number;
  percentOfTotal: number;
}

/* ─── Budget Consumption ─── */

export interface BudgetConsumption {
  budgetId: string;
  categoryName: string;
  departmentName: string;
  allocatedAmount: number;
  consumedAmount: number;
  consumedPercent: number;
  remainingAmount: number;
  status: 'OK' | 'WARNING' | 'DANGER' | 'EXCEEDED';
  currentThreshold: number | null; // the threshold level crossed
  projectedConsumption: number | null; // end-of-period projection
}

/* ─── Dashboard Summary ─── */

export interface DashboardSummary {
  /** Expense module KPIs */
  expenses: {
    totalThisPeriod: number;
    pendingApproval: number;
    averageProcessingDays: number;
    topCategories: Array<{ name: string; amount: number; percent: number }>;
  };
  /** Sales module KPIs */
  sales: {
    revenueThisPeriod: number;
    salesCount: number;
    averageBasket: number;
    topProducts: Array<{ name: string; revenue: number; quantity: number }>;
  };
  /** Receivables */
  receivables: {
    totalOutstanding: number;
    overdueAmount: number;
    agingDistribution: Record<string, number>;
  };
  /** Cash position */
  cashPosition: {
    currentBalance: number;
    todayInflows: number;
    todayOutflows: number;
  };
  /** Budget overview */
  budgets: BudgetConsumption[];
  /** Recent activity */
  recentActivity: ActivityItem[];
  /** Period info */
  period: {
    from: string;
    to: string;
    label: string; // e.g. "Mars 2026"
  };
}

export interface ActivityItem {
  id: string;
  type: 'expense' | 'sale' | 'payment' | 'approval' | 'alert';
  title: string;
  description: string;
  userId: string;
  userName: string;
  entityId: string;
  timestamp: string;
}

/* ─── Widgets config (for customizable dashboards) ─── */

export interface WidgetConfig {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'activity-feed' | 'budget-gauge';
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, unknown>;
}

export interface DashboardLayout {
  id: string;
  name: string;
  userId: string;
  widgets: WidgetConfig[];
  isDefault: boolean;
}
