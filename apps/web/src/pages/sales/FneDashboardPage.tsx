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
import { FileText, TrendingUp, Stamp, ReceiptText, AlertTriangle, FileEdit } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Stat } from '@/components/ui';
import {
  useFneDashboardKpis,
  useFneMonthlyTrend,
  useFneTopClients,
  useFneStatusBreakdown,
} from '@/hooks/useFneDashboard';
import { formatCFA } from '@/lib/format';

const TOOLTIP_STYLE = {
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
};

const STATUS_COLORS: Record<string, string> = {
  CERTIFIED: '#10B981',
  DRAFT: '#6B7280',
  CREDIT_NOTE: '#F59E0B',
  ERROR: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  CERTIFIED: 'Certifiée',
  DRAFT: 'Brouillon',
  CREDIT_NOTE: 'Avoir',
  ERROR: 'Erreur',
};

function EmptyChart() {
  return (
    <div className="flex h-72 items-center justify-center text-sm text-gray-400">
      Aucune donnée disponible
    </div>
  );
}

export default function FneDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: kpis } = useFneDashboardKpis();
  const { data: monthlyTrend = [] } = useFneMonthlyTrend();
  const { data: topClients = [] } = useFneTopClients();
  const { data: statusBreakdown = [] } = useFneStatusBreakdown();

  const maxClientRevenue =
    topClients.length > 0 ? Math.max(...topClients.map((c) => c.revenue)) : 1;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t('modules.fne.dashboardTitle', 'Tableau de bord FNE')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('modules.fne.dashboardSubtitle', "Vue d'ensemble de la facturation normalisée")}
        </p>
      </div>

      {/* ═══ KPI Cards ══════════════════════════ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t('modules.fne.kpi.monthInvoices', 'Factures ce mois')}
          value={kpis?.monthInvoices?.toString() ?? '—'}
          icon={<FileText className="h-5 w-5" />}
          trend={kpis?.invoicesTrend}
          trendLabel={t('dashboard.vsLastMonth', 'vs mois dernier')}
        />
        <Stat
          label={t('modules.fne.kpi.monthRevenue', 'CA certifié (mois)')}
          value={kpis ? formatCFA(kpis.monthRevenue) : '—'}
          icon={<TrendingUp className="h-5 w-5" />}
          trend={kpis?.revenueTrend}
          trendLabel={t('dashboard.vsLastMonth', 'vs mois dernier')}
        />
        <Stat
          label={t('modules.fne.kpi.monthCertified', 'Certifiées (mois)')}
          value={kpis?.monthCertified?.toString() ?? '—'}
          icon={<Stamp className="h-5 w-5" />}
        />
        <Stat
          label={t('modules.fne.kpi.monthCreditNotes', 'Avoirs (mois)')}
          value={kpis?.monthCreditNotes?.toString() ?? '—'}
          icon={<ReceiptText className="h-5 w-5" />}
        />
      </div>

      {/* ── Secondary KPIs ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={t('modules.fne.kpi.monthDrafts', 'Brouillons')}
          value={kpis?.monthDrafts?.toString() ?? '—'}
          icon={<FileEdit className="h-5 w-5" />}
        />
        <Stat
          label={t('modules.fne.kpi.monthErrors', 'Erreurs')}
          value={kpis?.monthErrors?.toString() ?? '—'}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <Stat
          label={t('modules.fne.kpi.totalRevenue', 'CA total certifié')}
          value={kpis ? formatCFA(kpis.totalRevenue) : '—'}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {/* ═══ Charts Section ═════════════════════ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Area: Monthly revenue ──────── */}
        <Card>
          <CardHeader>
            <CardTitle>
              {t('modules.fne.chart.revenueEvolution', 'Évolution du CA certifié')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={288}>
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient id="fneGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4884BD" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#4884BD" stopOpacity={0.02} />
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
                    dataKey="revenue"
                    name={t('modules.fne.chart.revenue', 'CA')}
                    stroke="#4884BD"
                    strokeWidth={2.5}
                    fill="url(#fneGrad)"
                    dot={{ r: 3, fill: '#4884BD', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>

        {/* ── Pie: Status breakdown ──────── */}
        <Card>
          <CardHeader>
            <CardTitle>
              {t('modules.fne.chart.statusBreakdown', 'Répartition par statut')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={288}>
                <PieChart>
                  <Pie
                    data={statusBreakdown.map((s) => ({
                      name: STATUS_LABELS[s.status] ?? s.status,
                      value: s.count,
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusBreakdown.map((s, i) => (
                      <Cell key={i} fill={STATUS_COLORS[s.status] ?? '#9CA3AF'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>

        {/* ── Bar: Monthly invoice count ── */}
        <Card>
          <CardHeader>
            <CardTitle>
              {t('modules.fne.chart.invoiceCount', 'Nombre de factures par mois')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={288}>
                <BarChart data={monthlyTrend}>
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
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar
                    dataKey="count"
                    name={t('modules.fne.chart.count', 'Factures')}
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>

        {/* ── Top 5 clients ──────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>{t('modules.fne.chart.topClients', 'Top 5 clients FNE')}</CardTitle>
          </CardHeader>
          <CardContent>
            {topClients.length > 0 ? (
              <div className="space-y-4">
                {topClients.slice(0, 5).map((client, i) => {
                  const pct = (client.revenue / maxClientRevenue) * 100;
                  return (
                    <div key={client.clientPhone} className="group">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          {i + 1}. {client.clientName}
                        </span>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-gray-900">
                            {formatCFA(client.revenue)}
                          </span>
                          <span className="ml-2 text-xs text-gray-400">
                            ({client.invoiceCount} fact.)
                          </span>
                        </div>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-gray-100">
                        <div
                          className="h-2.5 rounded-full bg-blue-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick links ──────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: '/fne/invoices', label: t('modules.fne.list', 'Factures'), icon: FileText },
          {
            to: '/fne/invoices/new',
            label: t('modules.fne.new', 'Nouvelle facture'),
            icon: FileEdit,
          },
          { to: '/fne/clients', label: t('modules.fne.clients', 'Clients'), icon: FileText },
          {
            to: '/fne/accounting',
            label: t('modules.fne.accounting', 'Écritures comptables'),
            icon: ReceiptText,
          },
        ].map(({ to, label, icon: Icon }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <Icon className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
