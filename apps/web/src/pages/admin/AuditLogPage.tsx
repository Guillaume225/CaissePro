import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, X, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuditLogs } from '@/hooks/useAdmin';
import type { AuditLogEntry, AuditLogFilters, AuditAction } from '@/types/admin';

const ACTIONS: AuditAction[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'PAY',
  'CANCEL',
  'LOGIN',
  'LOGOUT',
  'EXPORT',
  'CASH_CLOSING_OPEN',
  'CASH_CLOSING_CLOSE',
];

const ENTITY_TYPES = [
  'expense',
  'sale',
  'payment',
  'user',
  'role',
  'category',
  'closing',
  'report',
];

const PAGE_SIZE = 15;

function ActionBadge({ action }: { action: string }) {
  let classes = 'bg-[#eff6ff] text-[#1e40af]';
  if (['CREATE', 'APPROVE', 'PAY'].includes(action)) classes = 'bg-[#dcfce7] text-[#166534]';
  else if (['DELETE', 'REJECT', 'CANCEL'].includes(action)) classes = 'bg-[#fee2e2] text-[#991b1b]';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>{action}</span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' | null }) {
  if (!active || !dir) return <ArrowUpDown className="h-3 w-3 text-[#aab7c4]" />;
  return dir === 'asc' ? (
    <ArrowUp className="h-3 w-3 text-[#0a2540]" />
  ) : (
    <ArrowDown className="h-3 w-3 text-[#0a2540]" />
  );
}

export default function AuditLogPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const { data: logs = [], isLoading } = useAuditLogs(filters);

  const [sortKey, setSortKey] = useState<keyof AuditLogEntry | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [page, setPage] = useState(1);

  const toggleSort = (key: keyof AuditLogEntry) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir(null);
    }
    setPage(1);
  };

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return logs;
    return [...logs].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null || bv == null) return 0;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [logs, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const Th = ({ label, sortKeyName }: { label: string; sortKeyName: keyof AuditLogEntry }) => (
    <th
      className="cursor-pointer select-none px-3 py-2 text-left text-xs font-medium text-[#697386]"
      onClick={() => toggleSort(sortKeyName)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === sortKeyName} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0a2540]">{t('admin.audit.title')}</h1>
          <p className="text-sm text-[#697386]">{t('admin.audit.subtitle')}</p>
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary">
          <Filter className="h-4 w-4" />
          {t('admin.audit.filters')}
        </button>
      </div>

      {showFilters && (
        <div className="card">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label">{t('admin.audit.action')}</label>
              <select
                className="input"
                value={filters.action || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    action: (e.target.value || undefined) as AuditAction | undefined,
                  })
                }
              >
                <option value="">{t('common.all')}</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t('admin.audit.entityType')}</label>
              <select
                className="input"
                value={filters.entityType || ''}
                onChange={(e) => setFilters({ ...filters, entityType: e.target.value || undefined })}
              >
                <option value="">{t('common.all')}</option>
                {ENTITY_TYPES.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t('admin.audit.dateFrom')}</label>
              <input
                className="input"
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
              />
            </div>
            <div>
              <label className="label">{t('admin.audit.dateTo')}</label>
              <input
                className="input"
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
              />
            </div>
          </div>
          <button
            onClick={() => setFilters({})}
            className="mt-3 flex items-center gap-1 text-xs text-[#697386] hover:text-[#0a2540]"
          >
            <X className="h-3 w-3" />
            {t('admin.audit.resetFilters')}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="card animate-pulse text-sm text-[#697386]">{t('common.loading')}</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-[#e0e6eb] bg-[#f6f9fc]">
                <tr>
                  <Th label={t('common.date')} sortKeyName="createdAt" />
                  <Th label={t('admin.audit.user')} sortKeyName="userName" />
                  <Th label={t('admin.audit.action')} sortKeyName="action" />
                  <Th label={t('admin.audit.entityType')} sortKeyName="entityType" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                    {t('admin.audit.entityId')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                    {t('admin.audit.description')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                    {t('admin.audit.ip')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-[#aab7c4]">
                      {t('common.noData')}
                    </td>
                  </tr>
                )}
                {pageData.map((log, i) => (
                  <tr
                    key={log.id}
                    className={`border-b border-[#e0e6eb] ${i % 2 === 1 ? 'bg-[#fafbfc]' : ''}`}
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-[#697386]">
                      {new Date(log.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-[#0a2540]">{log.userName}</td>
                    <td className="px-3 py-2">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-3 py-2 text-xs capitalize text-[#697386]">{log.entityType}</td>
                    <td className="px-3 py-2">
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{log.entityId}</code>
                    </td>
                    <td className="px-3 py-2 text-sm text-[#697386]">{log.description}</td>
                    <td className="px-3 py-2">
                      <code className="text-xs text-[#aab7c4]">{log.ipAddress}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#e0e6eb] px-3 py-2 text-xs text-[#697386]">
              <span>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} sur{' '}
                {sorted.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  className="rounded p-1 hover:bg-zinc-100 disabled:opacity-40"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  className="rounded p-1 hover:bg-zinc-100 disabled:opacity-40"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
