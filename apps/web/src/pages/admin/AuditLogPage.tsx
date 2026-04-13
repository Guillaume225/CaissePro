import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, X } from 'lucide-react';
import { Input, Select, Badge, DataTable, Card, CardContent } from '@/components/ui';
import type { Column } from '@/components/ui/DataTable';
import { useAuditLogs } from '@/hooks/useAdmin';
import type { AuditLogEntry, AuditLogFilters, AuditAction } from '@/types/admin';

type AnyRow = Record<string, unknown>;

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

export default function AuditLogPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const { data: logs = [], isLoading } = useAuditLogs(filters);

  const actionColor = (
    action: string,
  ): 'default' | 'success' | 'warning' | 'destructive' | 'info' => {
    if (['CREATE', 'APPROVE', 'PAY'].includes(action)) return 'success';
    if (['DELETE', 'REJECT', 'CANCEL'].includes(action)) return 'destructive';
    if (['UPDATE', 'SUBMIT'].includes(action)) return 'info';
    return 'default';
  };

  const columns: Column<AnyRow>[] = [
    {
      key: 'createdAt',
      header: t('common.date'),
      sortable: true,
      render: (r) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {new Date((r as unknown as AuditLogEntry).createdAt).toLocaleString('fr-FR')}
        </span>
      ),
    },
    {
      key: 'userName',
      header: t('admin.audit.user'),
      sortable: true,
      render: (r) => (
        <span className="font-medium text-gray-900">
          {(r as unknown as AuditLogEntry).userName}
        </span>
      ),
    },
    {
      key: 'action',
      header: t('admin.audit.action'),
      sortable: true,
      render: (r) => (
        <Badge variant={actionColor((r as unknown as AuditLogEntry).action)}>
          {(r as unknown as AuditLogEntry).action}
        </Badge>
      ),
    },
    {
      key: 'entityType',
      header: t('admin.audit.entityType'),
      sortable: true,
      render: (r) => (
        <span className="text-xs capitalize text-gray-600">
          {(r as unknown as AuditLogEntry).entityType}
        </span>
      ),
    },
    {
      key: 'entityId',
      header: t('admin.audit.entityId'),
      render: (r) => (
        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
          {(r as unknown as AuditLogEntry).entityId}
        </code>
      ),
    },
    {
      key: 'description',
      header: t('admin.audit.description'),
      render: (r) => (
        <span className="text-sm text-gray-600">{(r as unknown as AuditLogEntry).description}</span>
      ),
    },
    {
      key: 'ipAddress',
      header: t('admin.audit.ip'),
      render: (r) => (
        <code className="text-xs text-gray-400">{(r as unknown as AuditLogEntry).ipAddress}</code>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.audit.title')}</h1>
          <p className="text-sm text-gray-500">{t('admin.audit.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <Filter className="h-4 w-4" />
          {t('admin.audit.filters')}
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                label={t('admin.audit.action')}
                value={filters.action || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    action: (e.target.value || undefined) as AuditAction | undefined,
                  })
                }
                options={[
                  { value: '', label: t('common.all') },
                  ...ACTIONS.map((a) => ({ value: a, label: a })),
                ]}
              />
              <Select
                label={t('admin.audit.entityType')}
                value={filters.entityType || ''}
                onChange={(e) =>
                  setFilters({ ...filters, entityType: e.target.value || undefined })
                }
                options={[
                  { value: '', label: t('common.all') },
                  ...ENTITY_TYPES.map((et) => ({ value: et, label: et })),
                ]}
              />
              <Input
                label={t('admin.audit.dateFrom')}
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
              />
              <Input
                label={t('admin.audit.dateTo')}
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
              />
            </div>
            <button
              onClick={() => setFilters({})}
              className="mt-3 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              <X className="h-3 w-3" />
              {t('admin.audit.resetFilters')}
            </button>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      ) : (
        <DataTable columns={columns} data={logs as unknown as AnyRow[]} pageSize={15} />
      )}
    </div>
  );
}
