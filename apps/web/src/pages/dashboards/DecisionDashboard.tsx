import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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
import {
  Wallet,
  TrendingDown,
  FileCheck2,
  FileText,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Stat, Badge } from '@/components/ui';
import {
  useDashboardKpis,
  useAiAlerts,
} from '@/hooks/useDashboard';
import { useFneInvoices } from '@/hooks/useFneInvoices';
import { useExpenses } from '@/hooks/useExpenses';
import { useSocket } from '@/hooks/useSocket';
import { formatCFA } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import type { AlertSeverity } from '@/types/dashboard';

type Period = 'day' | 'week' | 'month' | 'year';
const PERIOD_LABELS: Record<Period, string> = { day: 'Jour', week: 'Semaine', month: 'Mois', year: 'Année' };
const PERIODS: Period[] = ['day', 'week', 'month', 'year'];

const PIE_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#D4A843', '#6366F1'];

const SEVERITY_CONFIG: Record<AlertSeverity, { variant: 'success' | 'warning' | 'destructive'; label: string }> = {
  LOW: { variant: 'success', label: 'Faible' },
  MEDIUM: { variant: 'warning', label: 'Moyen' },
  HIGH: { variant: 'destructive', label: 'Élevé' },
};

const TOOLTIP_STYLE = {
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
};

/** Get ISO week number */
function getWeek(d: Date): number {
  const tmp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  return 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/** Group items by period, returning sorted {label, amount} array */
function groupByPeriod<T>(items: T[], dateAccessor: (item: T) => string, amountAccessor: (item: T) => number, period: Period): { month: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const raw = dateAccessor(item);
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) continue;
    let key: string;
    let label: string;
    switch (period) {
      case 'day':
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        break;
      case 'week': {
        const w = getWeek(d);
        key = `${d.getFullYear()}-W${String(w).padStart(2, '0')}`;
        label = `S${w} ${d.getFullYear().toString().slice(-2)}`;
        break;
      }
      case 'month':
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        break;
      case 'year':
        key = String(d.getFullYear());
        label = String(d.getFullYear());
        break;
    }
    map.set(key, (map.get(key) ?? 0) + amountAccessor(item));
    // Also store the label using a secondary map trick — we'll just reconstruct it
    if (!map.has(`__lbl__${key}`)) map.set(`__lbl__${key}`, 0);
  }
  // Rebuild with labels — we need labels, so re-derive them
  const result: { month: string; amount: number }[] = [];
  const sortedKeys = [...map.keys()].filter(k => !k.startsWith('__lbl__')).sort();
  for (const key of sortedKeys) {
    // Re-derive label from key
    let label = key;
    if (period === 'day') {
      const [, m, dd] = key.split('-');
      const tmp = new Date(2026, Number(m) - 1, Number(dd));
      label = tmp.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    } else if (period === 'week') {
      label = key.replace(/^\d{4}-/, '');
    } else if (period === 'month') {
      const [y, m] = key.split('-');
      const tmp = new Date(Number(y), Number(m) - 1, 1);
      label = tmp.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    }
    result.push({ month: label, amount: map.get(key) ?? 0 });
  }
  return result;
}

/** Period toggle button group */
function PeriodSelector({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
      {PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            p === value
              ? 'bg-brand-gold text-white shadow-sm'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
          )}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

export default function DecisionDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useSocket();

  const { data: kpis } = useDashboardKpis();
  const { data: alerts = [] } = useAiAlerts();

  // Pending expenses
  const { data: pendingData } = useExpenses({ status: 'PENDING', perPage: 1 });
  const pendingCount = pendingData?.meta?.total ?? 0;

  // All expenses for chart grouping
  const { data: allExpensesData } = useExpenses({ perPage: 500, sortBy: 'date', sortOrder: 'DESC' });
  const allExpenses = allExpensesData?.data ?? [];

  // FNE data
  const { data: fneInvoicesData } = useFneInvoices({ status: 'CERTIFIED', perPage: 500 });
  const certifiedInvoices = fneInvoicesData?.data ?? [];
  const { data: allFneData } = useFneInvoices({ perPage: 500 });
  const devisCount = (allFneData?.data ?? []).filter((inv) => inv.invoiceType === 'estimate').length;

  // FNE stats
  const fneTotalTtc = certifiedInvoices.reduce((sum, inv) => sum + (Number(inv.totalTtc) || 0), 0);

  // Period selectors
  const [fnePeriod, setFnePeriod] = useState<Period>('month');
  const [expPeriod, setExpPeriod] = useState<Period>('month');

  // FNE CA trend (grouped by selected period)
  const fneChartData = useMemo(
    () => groupByPeriod(certifiedInvoices, (inv) => inv.createdAt, (inv) => Number(inv.totalTtc) || 0, fnePeriod),
    [certifiedInvoices, fnePeriod],
  );

  // Expense trend (grouped by selected period)
  const expChartData = useMemo(
    () => groupByPeriod(allExpenses, (e) => e.date, (e) => e.amount, expPeriod),
    [allExpenses, expPeriod],
  );

  // Category breakdown from real expense data
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const exp of allExpenses) {
      const cat = exp.categoryName || 'Non catégorisé';
      map.set(cat, (map.get(cat) ?? 0) + exp.amount);
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [allExpenses]);

  // Real current month expenses total
  const monthExpensesTotal = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return allExpenses
      .filter((e) => e.date?.startsWith(prefix))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [allExpenses]);

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboards.decision.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">Vue exécutive — Caisse dépenses &amp; Facturation FNE</p>
      </div>

      {/* ═══ KPI Cards ══════════════════════════ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Factures FNE certifiées"
          value={String(certifiedInvoices.length)}
          icon={<FileCheck2 className="h-5 w-5" />}
          onClick={() => navigate('/fne/invoices')}
        />
        <Stat
          label="CA Factures FNE"
          value={formatCFA(fneTotalTtc)}
          icon={<Clock className="h-5 w-5" />}
          onClick={() => navigate('/fne/invoices')}
        />
        <Stat
          label="Validation en attente"
          value={String(pendingCount)}
          icon={<AlertTriangle className="h-5 w-5" />}
          onClick={() => navigate('/validation')}
        />
        <Stat
          label="Dépenses du mois"
          value={formatCFA(monthExpensesTotal)}
          icon={<TrendingDown className="h-5 w-5" />}
          onClick={() => navigate('/month-expenses')}
        />
      </div>

      {/* ═══ Charts Section — 2 columns ═════════ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Area: Évolution du CA FNE ─────── */}
        <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate('/fne/invoices')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Évolution du CA (FNE certifiées)</CardTitle>
            <PeriodSelector value={fnePeriod} onChange={setFnePeriod} />
          </CardHeader>
          <CardContent>
            {fneChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={288}>
                  <AreaChart data={fneChartData}>
                    <defs>
                      <linearGradient id="fneCAGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                      tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}K`} />
                    <Tooltip formatter={(value) => formatCFA(Number(value))} contentStyle={TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="amount" name="CA FNE TTC" stroke="#10B981" strokeWidth={2.5}
                      fill="url(#fneCAGrad)" dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
            ) : <EmptyChart t={t} />}
          </CardContent>
        </Card>

        {/* ── Bar: Dépenses ─────────────────── */}
        <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate('/month-expenses')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Évolution des dépenses</CardTitle>
            <PeriodSelector value={expPeriod} onChange={setExpPeriod} />
          </CardHeader>
          <CardContent>
            {expChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={288}>
                  <BarChart data={expChartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                      tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}K`} />
                    <Tooltip formatter={(value) => formatCFA(Number(value))} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="amount" name={t('dashboard.expenses')} fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
            ) : <EmptyChart t={t} />}
          </CardContent>
        </Card>

        {/* ── FNE Summary ─────────────────── */}
        <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate('/devis')}>
          <CardHeader>
            <CardTitle>Résumé Facturation FNE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-purple-50 p-4">
                <div>
                  <p className="text-sm text-gray-500">Factures certifiées</p>
                  <p className="text-2xl font-bold text-purple-700">{certifiedInvoices.length}</p>
                </div>
                <FileCheck2 className="h-8 w-8 text-purple-400" />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-green-50 p-4">
                <div>
                  <p className="text-sm text-gray-500">CA total TTC</p>
                  <p className="text-2xl font-bold text-green-700">{formatCFA(fneTotalTtc)}</p>
                </div>
                <Wallet className="h-8 w-8 text-green-400" />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-blue-50 p-4">
                <div>
                  <p className="text-sm text-gray-500">Devis</p>
                  <p className="text-2xl font-bold text-blue-700">{devisCount}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-400" />
              </div>
              <button
                onClick={() => navigate('/devis')}
                className="w-full text-center text-sm text-purple-600 hover:text-purple-800 font-medium py-2"
              >
                Voir les devis →
              </button>
            </div>
          </CardContent>
        </Card>

        {/* ── Pie: Expense categories ─────── */}
        <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate('/month-expenses')}>
          <CardHeader>
            <CardTitle>{t('dashboard.expensesByCategory')}</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length > 0 ? (
                <ResponsiveContainer width="100%" height={288}>
                  <PieChart>
                    <Pie data={categories} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                      {categories.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => formatCFA(Number(value))} contentStyle={TOOLTIP_STYLE} />
                    <Legend verticalAlign="bottom" iconType="circle" iconSize={8}
                      formatter={(value: string) => <span className="text-xs text-gray-600">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
            ) : <EmptyChart t={t} />}
          </CardContent>
        </Card>
      </div>

      {/* ═══ AI Section ═════════════════════════ */}
      <div>
        {/* ── AI Alerts ───────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-purple-500" />
              {t('dashboard.aiAlerts')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {alerts.map((alert) => {
                  const sev = SEVERITY_CONFIG[alert.severity];
                  return (
                    <button key={alert.id} onClick={() => navigate(alert.entityRoute)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-gray-50',
                        alert.isRead ? 'border-gray-100 bg-white' : 'border-purple-200 bg-purple-50/50',
                      )}>
                      <AlertIcon type={alert.type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">{alert.title}</span>
                          <Badge variant={sev.variant} className="text-[10px] shrink-0">{sev.label}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{alert.message}</p>
                        <span className="mt-1 text-[10px] text-gray-400">{timeAgo(alert.createdAt)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-gray-400">
                {t('dashboard.noAlerts')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

function AlertIcon({ type }: { type: string }) {
  const iconClass = 'h-4 w-4 mt-0.5 shrink-0';
  switch (type) {
    case 'ANOMALY': return <ShieldAlert className={cn(iconClass, 'text-red-500')} />;
    case 'BUDGET': return <Wallet className={cn(iconClass, 'text-amber-500')} />;
    case 'RECEIVABLE': return <Clock className={cn(iconClass, 'text-orange-500')} />;
    case 'FORECAST': return <Sparkles className={cn(iconClass, 'text-purple-500')} />;
    default: return <AlertTriangle className={cn(iconClass, 'text-gray-400')} />;
  }
}

function EmptyChart({ t }: { t: (key: string) => string }) {
  return <p className="flex h-48 items-center justify-center text-sm text-gray-400">{t('common.noData')}</p>;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
}
