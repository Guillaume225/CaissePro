import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
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
  Users,
  UserCheck,
  Shield,
  ClipboardList,
  ArrowRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Stat, Badge } from '@/components/ui';
import {
  useAdminDashKpis,
  useRecentAuditLogs,
  useRoleDistribution,
  useHourlyActivity,
} from '@/hooks/useDashboard';

const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444'];

const TOOLTIP_STYLE = {
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
};

const ACTION_VARIANTS: Record<string, 'success' | 'warning' | 'destructive' | 'default'> = {
  CREATE: 'success',
  UPDATE: 'warning',
  DELETE: 'destructive',
  LOGIN: 'default',
  APPROVE: 'success',
  REJECT: 'destructive',
  SUBMIT: 'warning',
  EXPORT: 'default',
  PAY: 'success',
};

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

export default function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: kpis } = useAdminDashKpis();
  const { data: recentLogs = [] } = useRecentAuditLogs();
  const { data: roleDistrib = [] } = useRoleDistribution();
  const { data: hourlyActivity = [] } = useHourlyActivity();

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboards.admin.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('dashboards.admin.subtitle')}</p>
      </div>

      {/* ═══ KPI Cards ══════════════════════════ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t('dashboards.admin.totalUsers')}
          value={kpis?.totalUsers?.toString() ?? '—'}
          icon={<Users className="h-5 w-5" />}
        />
        <Stat
          label={t('dashboards.admin.activeUsers')}
          value={kpis?.activeUsers?.toString() ?? '—'}
          icon={<UserCheck className="h-5 w-5" />}
        />
        <Stat
          label={t('dashboards.admin.totalRoles')}
          value={kpis?.totalRoles?.toString() ?? '—'}
          icon={<Shield className="h-5 w-5" />}
        />
        <Stat
          label={t('dashboards.admin.auditEventsToday')}
          value={kpis?.auditEventsToday?.toString() ?? '—'}
          icon={<ClipboardList className="h-5 w-5" />}
        />
      </div>

      {/* ═══ Charts Section ═════════════════════ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Bar: Hourly activity ──────── */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboards.admin.hourlyActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            {hourlyActivity.length > 0 ? (
                <ResponsiveContainer width="100%" height={288}>
                  <BarChart data={hourlyActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }}
                      interval={2} />
                    <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="events" name={t('dashboards.admin.events')} fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* ── Pie: Role distribution ─────── */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboards.admin.roleDistribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            {roleDistrib.length > 0 ? (
                <ResponsiveContainer width="100%" height={288}>
                  <PieChart>
                    <Pie data={roleDistrib} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="count" nameKey="name">
                      {roleDistrib.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend verticalAlign="bottom" iconType="circle" iconSize={8}
                      formatter={(value: string) => <span className="text-xs text-gray-600">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Recent Audit Logs ════════════════════ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-emerald-500" />
            {t('dashboards.admin.recentAuditLogs')}
          </CardTitle>
          <button onClick={() => navigate('/admin/audit')} className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700">
            {t('dashboards.admin.viewAll')} <ArrowRight className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent>
          {recentLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 font-medium">{t('dashboards.admin.user')}</th>
                    <th className="pb-2 font-medium">{t('dashboards.admin.action')}</th>
                    <th className="pb-2 font-medium">{t('dashboards.admin.description')}</th>
                    <th className="pb-2 font-medium text-right">{t('dashboards.admin.time')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 font-medium text-gray-700">{log.userName}</td>
                      <td className="py-2.5">
                        <Badge variant={ACTION_VARIANTS[log.action] ?? 'default'} className="text-[10px]">
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-gray-500 max-w-[300px] truncate">{log.description}</td>
                      <td className="py-2.5 text-right text-xs text-gray-400">{timeAgo(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyChart />}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyChart() {
  return <p className="flex h-48 items-center justify-center text-sm text-gray-400">Aucune donnée disponible</p>;
}
