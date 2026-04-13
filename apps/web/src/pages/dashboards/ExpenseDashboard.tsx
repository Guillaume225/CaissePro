import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Wallet, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Stat, Badge } from '@/components/ui';
import {
  useExpenseDashKpis,
  useExpenseMonthlyTrend,
  useCategoryBreakdown,
  useRecentExpenses,
} from '@/hooks/useDashboard';
import { formatCFA } from '@/lib/format';

const PIE_COLORS = ['#EA761D', '#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6'];

const TOOLTIP_STYLE = {
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
};

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'destructive' | 'default'> = {
  DRAFT: 'default',
  PENDING: 'warning',
  APPROVED: 'success',
  PAID: 'success',
  REJECTED: 'destructive',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  PENDING: 'En attente',
  APPROVED: 'Approuvée',
  PAID: 'Payée',
  REJECTED: 'Rejetée',
};

export default function ExpenseDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: kpis } = useExpenseDashKpis();
  const { data: monthlyTrend = [] } = useExpenseMonthlyTrend();
  const { data: categories = [] } = useCategoryBreakdown();
  const { data: recentExpenses = [] } = useRecentExpenses();

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboards.expense.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('dashboards.expense.subtitle')}</p>
      </div>

      {/* ═══ KPI Cards ══════════════════════════ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t('dashboards.expense.totalExpenses')}
          value={kpis ? formatCFA(kpis.totalExpenses) : '—'}
          icon={<Wallet className="h-5 w-5" />}
          trend={kpis?.totalExpensesTrend ? -Math.abs(kpis.totalExpensesTrend) : undefined}
          trendLabel={t('dashboard.vsLastMonth')}
        />
        <Stat
          label={t('dashboards.expense.pendingApprovals')}
          value={kpis?.pendingApprovals?.toString() ?? '—'}
          icon={<Clock className="h-5 w-5" />}
          trend={kpis?.pendingTrend}
        />
        <Stat
          label={t('dashboards.expense.overduePayments')}
          value={kpis?.overduePayments?.toString() ?? '—'}
          icon={<AlertTriangle className="h-5 w-5" />}
          trend={kpis?.overdueTrend ? -Math.abs(kpis.overdueTrend) : undefined}
        />
      </div>

      {/* ═══ Charts Section ═════════════════════ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Area: Monthly expense trend ──── */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboards.expense.monthlyTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={288}>
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EA761D" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#EA761D" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : `${(v / 1_000).toFixed(0)}K`
                    }
                  />
                  <Tooltip
                    formatter={(value) => formatCFA(Number(value))}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    name={t('dashboard.expenses')}
                    stroke="#EA761D"
                    strokeWidth={2.5}
                    fill="url(#expenseGrad)"
                    dot={{ r: 3, fill: '#EA761D', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>

        {/* ── Pie: Expense categories ─────── */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.expensesByCategory')}</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length > 0 ? (
              <ResponsiveContainer width="100%" height={288}>
                <PieChart>
                  <Pie
                    data={categories}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categories.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCFA(Number(value))}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => (
                      <span className="text-xs text-gray-600">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>

        {/* ── Recent expenses table ──────── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('dashboards.expense.recentExpenses')}</CardTitle>
            <button
              onClick={() => navigate('/expenses')}
              className="flex items-center gap-1 text-sm text-brand-gold hover:text-brand-gold-dark"
            >
              {t('dashboards.expense.viewAll')} <ArrowRight className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent>
            {recentExpenses.length > 0 ? (
              <div className="space-y-3">
                {recentExpenses.map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => navigate(`/expenses/${exp.id}`)}
                    className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{exp.reference}</p>
                      <p className="text-xs text-gray-500">
                        {exp.categoryName}
                        {exp.beneficiary ? ` — ${exp.beneficiary}` : ''}
                      </p>
                    </div>
                    <div className="ml-3 flex items-center gap-3">
                      <Badge
                        variant={STATUS_VARIANTS[exp.status] ?? 'default'}
                        className="text-[10px]"
                      >
                        {STATUS_LABELS[exp.status] ?? exp.status}
                      </Badge>
                      <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                        {formatCFA(exp.amount)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <p className="flex h-48 items-center justify-center text-sm text-gray-400">
      Aucune donnée disponible
    </p>
  );
}
