import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Database, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button, Badge, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { useAdminQuery, useAdminUpdateStatus, type AdminEntityType } from '@/hooks/useAdmin';

/* ─── Entity config ─── */
interface EntityConfig {
  labelKey: string;
  statuses: string[];
  statusColors: Record<string, string>;
  columns: { key: string; labelKey: string; fmt?: (v: unknown) => string }[];
}

const fmtDate = (v: unknown) => {
  if (!v) return '—';
  try {
    return new Date(v as string).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(v);
  }
};

const fmtMoney = (v: unknown) => {
  const n = Number(v);
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'decimal', minimumFractionDigits: 0 }).format(n);
};

const statusBadgeColor = (status: string): string => {
  const map: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    PENDING: 'bg-yellow-100 text-yellow-800',
    PENDING_CLOSE: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-700',
    APPROVED_L1: 'bg-blue-100 text-blue-700',
    APPROVED_L2: 'bg-green-100 text-green-700',
    PAID: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-200 text-gray-500',
    OPEN: 'bg-blue-100 text-blue-700',
    CLOSED: 'bg-gray-200 text-gray-600',
    PROCESSED: 'bg-emerald-100 text-emerald-700',
    PARTIAL: 'bg-orange-100 text-orange-700',
    JUSTIFIED: 'bg-green-100 text-green-700',
    OVERDUE: 'bg-red-100 text-red-700',
    CONFIRMED: 'bg-blue-100 text-blue-700',
    PARTIALLY_PAID: 'bg-orange-100 text-orange-700',
    WRITTEN_OFF: 'bg-gray-200 text-gray-500',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
};

const ENTITIES: Record<AdminEntityType, EntityConfig> = {
  expense: {
    labelKey: 'adminQuery.entities.expense',
    statuses: ['DRAFT', 'PENDING', 'APPROVED_L1', 'APPROVED_L2', 'PAID', 'REJECTED', 'CANCELLED'],
    statusColors: {},
    columns: [
      { key: 'reference', labelKey: 'adminQuery.cols.reference' },
      { key: 'description', labelKey: 'adminQuery.cols.description' },
      { key: 'amount', labelKey: 'adminQuery.cols.amount', fmt: fmtMoney },
      { key: 'status', labelKey: 'adminQuery.cols.status' },
      { key: 'createdAt', labelKey: 'adminQuery.cols.createdAt', fmt: fmtDate },
    ],
  },
  cashDay: {
    labelKey: 'adminQuery.entities.cashDay',
    statuses: ['OPEN', 'PENDING_CLOSE', 'CLOSED'],
    statusColors: {},
    columns: [
      { key: 'reference', labelKey: 'adminQuery.cols.reference' },
      { key: 'openingBalance', labelKey: 'adminQuery.cols.openingBalance', fmt: fmtMoney },
      { key: 'theoreticalBalance', labelKey: 'adminQuery.cols.theoreticalBalance', fmt: fmtMoney },
      { key: 'status', labelKey: 'adminQuery.cols.status' },
      { key: 'openedAt', labelKey: 'adminQuery.cols.openedAt', fmt: fmtDate },
    ],
  },
  advance: {
    labelKey: 'adminQuery.entities.advance',
    statuses: ['PENDING', 'PARTIAL', 'JUSTIFIED', 'OVERDUE'],
    statusColors: {},
    columns: [
      { key: 'reference', labelKey: 'adminQuery.cols.reference' },
      { key: 'amount', labelKey: 'adminQuery.cols.amount', fmt: fmtMoney },
      { key: 'status', labelKey: 'adminQuery.cols.status' },
      { key: 'createdAt', labelKey: 'adminQuery.cols.createdAt', fmt: fmtDate },
    ],
  },
  disbursementRequest: {
    labelKey: 'adminQuery.entities.disbursementRequest',
    statuses: ['PENDING', 'APPROVED', 'REJECTED', 'PROCESSED'],
    statusColors: {},
    columns: [
      { key: 'reference', labelKey: 'adminQuery.cols.reference' },
      { key: 'amount', labelKey: 'adminQuery.cols.amount', fmt: fmtMoney },
      { key: 'status', labelKey: 'adminQuery.cols.status' },
      { key: 'createdAt', labelKey: 'adminQuery.cols.createdAt', fmt: fmtDate },
    ],
  },
};

export default function AdminStatusQueryPage() {
  const { t } = useTranslation();

  const [entity, setEntity] = useState<AdminEntityType>('cashDay');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newStatus, setNewStatus] = useState('');
  const [reason, setReason] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{
    updated: number;
    results: { id: string; reference: string; oldStatus: string; newStatus: string }[];
  } | null>(null);

  const config = ENTITIES[entity];
  const { data, isLoading, refetch } = useAdminQuery(entity, searchTerm, filterStatus, page);
  const updateMutation = useAdminUpdateStatus();

  const records = data?.data || [];
  const total = data?.total || 0;
  const allowedStatuses = data?.allowedStatuses || config.statuses;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === records.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.map((r: Record<string, unknown>) => r.id as string));
    }
  };

  const handleEntityChange = (e: AdminEntityType) => {
    setEntity(e);
    setSearchTerm('');
    setFilterStatus('');
    setPage(1);
    setSelectedIds([]);
    setNewStatus('');
    setResult(null);
  };

  const handleApply = useCallback(async () => {
    if (!newStatus || selectedIds.length === 0) return;
    try {
      const res = await updateMutation.mutateAsync({
        entity,
        ids: selectedIds,
        newStatus,
        reason: reason || undefined,
      });
      setResult(res);
      setShowConfirm(false);
      setSelectedIds([]);
      setNewStatus('');
      setReason('');
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setResult(null);
      alert(e?.response?.data?.message || e?.message || 'Erreur');
      setShowConfirm(false);
    }
  }, [entity, selectedIds, newStatus, reason, updateMutation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Database className="h-6 w-6 text-emerald-500" />
          {t('adminQuery.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t('adminQuery.subtitle')}</p>
      </div>

      {/* Entity selector + search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            {t('adminQuery.searchTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Entity type tabs */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ENTITIES) as AdminEntityType[]).map((key) => (
              <button
                key={key}
                onClick={() => handleEntityChange(key)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  entity === key
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t(ENTITIES[key].labelKey)}
              </button>
            ))}
          </div>

          {/* Search + status filter */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1" style={{ minWidth: 200 }}>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('adminQuery.searchLabel')}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  placeholder={t('adminQuery.searchPlaceholder')}
                  className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('adminQuery.filterStatus')}
              </label>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(1);
                }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">{t('adminQuery.allStatuses')}</option>
                {config.statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-1 h-4 w-4" />
              {t('adminQuery.refresh')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('adminQuery.results', { count: total })}</CardTitle>
            {selectedIds.length > 0 && (
              <Badge variant="info">
                {t('adminQuery.selected', { count: selectedIds.length })}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-gray-400">{t('common.loading')}</div>
          ) : records.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              {t('adminQuery.noResults')}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                      <th className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === records.length && records.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300"
                        />
                      </th>
                      {config.columns.map((col) => (
                        <th key={col.key} className="px-3 py-2">
                          {t(col.labelKey)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((row: Record<string, unknown>) => (
                      <tr
                        key={row.id}
                        className={`border-b border-gray-100 transition-colors hover:bg-gray-50 ${
                          selectedIds.includes(row.id) ? 'bg-emerald-50/50' : ''
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(row.id)}
                            onChange={() => toggleSelect(row.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        {config.columns.map((col) => (
                          <td key={col.key} className="px-3 py-2">
                            {col.key === 'status' ? (
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeColor(String(row[col.key]))}`}
                              >
                                {String(row[col.key])}
                              </span>
                            ) : col.fmt ? (
                              col.fmt(row[col.key])
                            ) : (
                              String(row[col.key] ?? '—')
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {total > 50 && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Page {page} / {Math.ceil(total / 50)}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      {t('common.previous')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page * 50 >= total}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {t('common.next')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Action panel */}
      {selectedIds.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-emerald-700">
              <ArrowRight className="h-4 w-4" />
              {t('adminQuery.changeStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('adminQuery.newStatus')}
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">{t('adminQuery.selectStatus')}</option>
                  {allowedStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1" style={{ minWidth: 200 }}>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('adminQuery.reason')}
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('adminQuery.reasonPlaceholder')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <Button
                variant="default"
                disabled={!newStatus || selectedIds.length === 0}
                onClick={() => setShowConfirm(true)}
              >
                {t('adminQuery.apply')}
              </Button>
            </div>

            {/* Selected summary */}
            <div className="text-sm text-gray-600">
              {t('adminQuery.willUpdate', {
                count: selectedIds.length,
                entity: t(config.labelKey),
                status: newStatus || '...',
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{t('adminQuery.confirmTitle')}</h3>
                <p className="text-sm text-gray-500">{t('adminQuery.confirmSubtitle')}</p>
              </div>
            </div>
            <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm">
              <p>
                <strong>{t(config.labelKey)}</strong>
              </p>
              <p>{t('adminQuery.confirmCount', { count: selectedIds.length })}</p>
              <p className="flex items-center gap-1">
                {t('adminQuery.confirmNewStatus')}:
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeColor(newStatus)}`}
                >
                  {newStatus}
                </span>
              </p>
              {reason && (
                <p className="mt-1 text-gray-500">
                  {t('adminQuery.reason')}: {reason}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="default" onClick={handleApply} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? t('common.loading') : t('common.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success result */}
      {result && (
        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">
                {t('adminQuery.success', { count: result.updated })}
              </span>
            </div>
            {result.results?.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                {result.results.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium">{r.reference}</span>:{' '}
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeColor(r.oldStatus)}`}
                    >
                      {r.oldStatus}
                    </span>
                    {' → '}
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeColor(r.newStatus)}`}
                    >
                      {r.newStatus}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
