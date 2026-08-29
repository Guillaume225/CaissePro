import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Vault,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Lock,
  TrendingUp,
  Eye,
  History,
  Landmark,
  Banknote,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import {
  useOpenCashDays,
  useClosingHistory,
  useCashState,
  useAccountingEntries,
} from '@/hooks/useClosing';
import { useUsers } from '@/hooks/useAdmin';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'decimal' }).format(n) + ' FCFA';

function timeSince(dateStr: string): string {
  const now = new Date();
  const opened = new Date(dateStr);
  const diffMs = now.getTime() - opened.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}j ${hours % 24}h`;
  const mins = Math.floor(diffMs / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins % 60}min`;
  return `${mins}min`;
}

export default function ManagerDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: openDays = [], isLoading: openLoading } = useOpenCashDays();
  const { data: history = [], isLoading: historyLoading } = useClosingHistory();
  useCashState();
  const { data: accounting } = useAccountingEntries(true);
  const { data: users = [] } = useUsers();

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.id, `${u.firstName} ${u.lastName}`);
    return map;
  }, [users]);

  const openCount = openDays.length;
  const pendingCloseCount = openDays.filter((d) => d.status === 'PENDING_CLOSE').length;

  const totalTheoreticalBalance = openDays.reduce((s, d) => s + (d.theoreticalBalance || 0), 0);
  const totalOpenEntries = openDays.reduce((s, d) => s + (d.totalEntries || 0), 0);
  const totalOpenExits = openDays.reduce((s, d) => s + (d.totalExits || 0), 0);

  const lateOpenDays = openDays.filter((d) => {
    const hours = (Date.now() - new Date(d.openedAt).getTime()) / 3_600_000;
    return hours > 12;
  });

  const recentClosings = useMemo(() => {
    return [...history]
      .filter((c) => c.closedAt)
      .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime())
      .slice(0, 5);
  }, [history]);

  const monthStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthClosings = history.filter((c) => c.closedAt && new Date(c.closedAt) >= monthStart);
    const totalGap = monthClosings.reduce((s, c) => s + Math.abs(c.variance || 0), 0);
    const avgGap = monthClosings.length > 0 ? totalGap / monthClosings.length : 0;
    const maxGap =
      monthClosings.length > 0
        ? Math.max(...monthClosings.map((c) => Math.abs(c.variance || 0)))
        : 0;
    const totalMovements = monthClosings.length;
    return { count: monthClosings.length, avgGap, maxGap, totalMovements };
  }, [history]);

  const isLoading = openLoading || historyLoading;

  if (isLoading) {
    return <p className="text-sm text-gray-500">{t('common.loading')}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0a2540]">
          <Landmark className="h-6 w-6 text-amber-500" />
          {t('managerDashboard.title')}
        </h1>
        <p className="text-sm text-[#697386]">{t('managerDashboard.subtitle')}</p>
      </div>

      {/* ── Top KPIs ──────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className="card cursor-pointer border-l-4 border-l-amber-400 py-4 transition hover:shadow-md"
          onClick={() => navigate('/manager-caisse/closing')}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <Vault className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-[#697386]">{t('managerDashboard.openRegisters')}</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[#0a2540]">{openCount}</span>
                {pendingCloseCount > 0 && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {pendingCloseCount} {t('managerDashboard.pendingClose')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-l-green-400 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <ArrowUpRight className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-[#697386]">{t('managerDashboard.todayEntries')}</p>
              <span className="text-2xl font-bold text-green-700">{fmt(totalOpenEntries)}</span>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-l-red-400 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <ArrowDownRight className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-[#697386]">{t('managerDashboard.todayExits')}</p>
              <span className="text-2xl font-bold text-red-700">{fmt(totalOpenExits)}</span>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-l-blue-400 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Banknote className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-[#697386]">{t('managerDashboard.theoreticalBalance')}</p>
              <span className="text-2xl font-bold text-blue-700">
                {fmt(totalTheoreticalBalance)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Alerts ────────────────────────────────────────── */}
      {lateOpenDays.length > 0 && (
        <div className="card border-l-4 border-l-red-500 bg-red-50 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                {t('managerDashboard.alertLate.title')}
              </p>
              <p className="text-xs text-red-600">
                {t('managerDashboard.alertLate.description', { count: lateOpenDays.length })}
              </p>
            </div>
            <button
              className="btn-primary bg-red-600 px-3 py-1.5 text-xs hover:bg-red-700"
              onClick={() => navigate('/manager-caisse/closing')}
            >
              {t('managerDashboard.alertLate.action')}
            </button>
          </div>
        </div>
      )}

      {/* ── Two-column layout ─────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Open registers list */}
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0a2540]">
              <Vault className="h-4 w-4 text-amber-500" />
              {t('managerDashboard.openRegistersList')}
            </h3>
            <button
              className="flex items-center text-xs text-[#697386] hover:text-[#0a2540]"
              onClick={() => navigate('/manager-caisse/closing')}
            >
              {t('managerDashboard.seeAll')}
              <ArrowUpRight className="ml-1 h-3 w-3" />
            </button>
          </div>
          {openDays.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-400" />
              <p className="text-sm text-[#697386]">{t('managerDashboard.allClosed')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {openDays.slice(0, 5).map((day) => {
                const hours = (Date.now() - new Date(day.openedAt).getTime()) / 3_600_000;
                const isLate = hours > 12;
                const isPending = day.status === 'PENDING_CLOSE';
                const badgeClasses = isPending
                  ? 'bg-amber-50 text-amber-800'
                  : isLate
                    ? 'bg-[#fee2e2] text-[#991b1b]'
                    : 'bg-[#dcfce7] text-[#166534]';
                return (
                  <div
                    key={day.id}
                    className="flex cursor-pointer items-center gap-3 py-3 transition hover:bg-zinc-50"
                    onClick={() => navigate(`/manager-caisse/closing/${day.id}`)}
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${isPending ? 'bg-orange-50' : isLate ? 'bg-red-50' : 'bg-green-50'}`}
                    >
                      {isPending ? (
                        <Lock className="h-4 w-4 text-orange-600" />
                      ) : (
                        <Vault className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-brand-gold">{day.reference}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClasses}`}
                        >
                          {isPending ? t('closing.statusPendingClose') : t('closing.statusOpen')}
                        </span>
                      </div>
                      <p className="truncate text-xs text-[#697386]">
                        {userMap.get(day.openedById) ?? day.openedById} · {timeSince(day.openedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[#0a2540]">
                        {fmt(day.theoreticalBalance)}
                      </p>
                      <p className="text-[10px] text-[#aab7c4]">
                        {t('closing.theoreticalBalance')}
                      </p>
                    </div>
                    <Eye className="h-4 w-4 text-[#aab7c4]" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent closings */}
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0a2540]">
              <History className="h-4 w-4 text-[#697386]" />
              {t('managerDashboard.recentClosings')}
            </h3>
            <button
              className="flex items-center text-xs text-[#697386] hover:text-[#0a2540]"
              onClick={() => navigate('/manager-caisse/closing-history')}
            >
              {t('managerDashboard.seeAll')}
              <ArrowUpRight className="ml-1 h-3 w-3" />
            </button>
          </div>
          {recentClosings.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#aab7c4]">
              {t('managerDashboard.noClosings')}
            </p>
          ) : (
            <div className="divide-y">
              {recentClosings.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
                    <CheckCircle2 className="h-4 w-4 text-[#697386]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-brand-gold">{c.reference}</span>
                      <span className="text-[10px] text-[#aab7c4]">
                        {c.closedAt ? new Date(c.closedAt).toLocaleDateString('fr-FR') : '—'}
                      </span>
                    </div>
                    <p className="truncate text-xs text-[#697386]">
                      {new Date(c.closedAt!).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${c.variance === 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {c.variance === 0 ? '0' : (c.variance > 0 ? '+' : '') + fmt(c.variance)}
                    </p>
                    <p className="text-[10px] text-[#aab7c4]">{t('managerDashboard.gap')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Monthly stats + Budget + Accounting ───────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Monthly performance */}
        <div className="card">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#0a2540]">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            {t('managerDashboard.monthlyStats.title')}
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2">
              <span className="text-xs text-[#697386]">
                {t('managerDashboard.monthlyStats.closingsCount')}
              </span>
              <span className="text-sm font-bold text-[#0a2540]">{monthStats.count}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2">
              <span className="text-xs text-[#697386]">
                {t('managerDashboard.monthlyStats.totalMovements')}
              </span>
              <span className="text-sm font-bold text-[#0a2540]">{monthStats.totalMovements}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2">
              <span className="text-xs text-[#697386]">
                {t('managerDashboard.monthlyStats.avgGap')}
              </span>
              <span
                className={`text-sm font-bold ${monthStats.avgGap === 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {fmt(Math.round(monthStats.avgGap))}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2">
              <span className="text-xs text-[#697386]">
                {t('managerDashboard.monthlyStats.maxGap')}
              </span>
              <span
                className={`text-sm font-bold ${monthStats.maxGap === 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {fmt(monthStats.maxGap)}
              </span>
            </div>
          </div>
        </div>

        {/* Accounting today */}
        <div
          className="card cursor-pointer transition hover:shadow-md"
          onClick={() => navigate('/manager-caisse/accounting-entries')}
        >
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#0a2540]">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            {t('managerDashboard.accounting.title')}
          </h3>
          <div className="space-y-3">
            {accounting ? (
              <>
                <div className="flex items-center justify-between rounded-md bg-green-50 px-3 py-2">
                  <span className="text-xs text-green-600">
                    {t('managerDashboard.accounting.totalDebit')}
                  </span>
                  <span className="text-sm font-bold text-green-700">
                    {fmt(accounting.totalDebit)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-red-50 px-3 py-2">
                  <span className="text-xs text-red-600">
                    {t('managerDashboard.accounting.totalCredit')}
                  </span>
                  <span className="text-sm font-bold text-red-700">
                    {fmt(accounting.totalCredit)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2">
                  <span className="text-xs text-[#697386]">
                    {t('managerDashboard.accounting.entries')}
                  </span>
                  <span className="text-sm font-bold text-[#0a2540]">
                    {accounting.entriesCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#697386]">
                    {t('managerDashboard.accounting.balanced')}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      accounting.isBalanced
                        ? 'bg-[#dcfce7] text-[#166534]'
                        : 'bg-[#fee2e2] text-[#991b1b]'
                    }`}
                  >
                    {accounting.isBalanced ? t('common.yes') : t('common.no')}
                  </span>
                </div>
              </>
            ) : (
              <p className="py-4 text-center text-sm text-[#aab7c4]">
                {t('managerDashboard.accounting.noData')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────── */}
      <div className="card">
        <h3 className="mb-3 text-sm font-semibold text-[#0a2540]">
          {t('managerDashboard.quickActions')}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            className="btn-secondary justify-start gap-2"
            onClick={() => navigate('/manager-caisse/closing')}
          >
            <Lock className="h-4 w-4 text-amber-500" />
            {t('modules.manager-caisse.closing')}
          </button>
          <button
            className="btn-secondary justify-start gap-2"
            onClick={() => navigate('/manager-caisse/closing-history')}
          >
            <History className="h-4 w-4 text-[#697386]" />
            {t('modules.manager-caisse.closingHistory')}
          </button>
          <button
            className="btn-secondary justify-start gap-2"
            onClick={() => navigate('/manager-caisse/settings')}
          >
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            {t('modules.manager-caisse.settings')}
          </button>
        </div>
      </div>
    </div>
  );
}
