import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { History, Eye } from 'lucide-react';
import { DataTable } from '@/components/ui';
import type { Column } from '@/components/ui/DataTable';
import { useClosingHistory } from '@/hooks/useClosing';
import type { CashClosingRecord } from '@/types/admin';

type AnyRow = Record<string, unknown>;

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'decimal' }).format(n) + ' FCFA';

export default function ClosingHistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: history = [], isLoading: historyLoading } = useClosingHistory();

  const historyColumns: Column<Record<string, unknown>>[] = [
    {
      key: 'closedAt',
      header: t('closing.history.closedAt'),
      sortable: true,
      render: (r) => {
        const row = r as unknown as CashClosingRecord;
        const date = row.closedAt ? new Date(row.closedAt) : null;
        return <span className="text-sm">{date ? date.toLocaleDateString('fr-FR') : '—'}</span>;
      },
    },
    {
      key: 'reference',
      header: t('closing.history.reference'),
      render: (r) => {
        const row = r as unknown as CashClosingRecord;
        return <span className="font-mono text-xs text-brand-gold">{row.reference}</span>;
      },
    },
    {
      key: 'openingBalance',
      header: t('closing.openModal.openingBalance'),
      className: 'text-right',
      render: (r) => {
        const row = r as unknown as CashClosingRecord;
        return <span className="text-sm">{fmt(row.openingBalance ?? 0)}</span>;
      },
    },
    {
      key: 'theoreticalBalance',
      header: t('closing.history.theoretical'),
      className: 'text-right',
      render: (r) => {
        const row = r as unknown as CashClosingRecord;
        return <span className="text-sm">{fmt(row.theoreticalBalance ?? 0)}</span>;
      },
    },
    {
      key: 'actualBalance',
      header: t('closing.history.actual'),
      className: 'text-right',
      render: (r) => {
        const row = r as unknown as CashClosingRecord;
        return <span className="text-sm">{fmt(row.actualBalance ?? 0)}</span>;
      },
    },
    {
      key: 'variance',
      header: t('closing.history.gap'),
      className: 'text-right',
      render: (r) => {
        const row = r as unknown as CashClosingRecord;
        const gap = row.variance ?? 0;
        return (
          <span
            className={`font-medium ${gap === 0 ? 'text-gray-500' : gap > 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {gap > 0 ? '+' : ''}
            {fmt(gap)}
          </span>
        );
      },
    },
    {
      key: 'closedAtTime',
      header: t('common.time'),
      render: (r) => {
        const row = r as unknown as CashClosingRecord;
        const date = row.closedAt ? new Date(row.closedAt) : null;
        return (
          <span className="text-xs text-gray-500">
            {date ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'text-center w-12',
      render: (r) => {
        const row = r as unknown as CashClosingRecord;
        return (
          <button
            onClick={() => navigate(`/manager-caisse/closing/${row.id}`)}
            className="rounded p-1.5 text-gray-400 hover:bg-brand-gold/10 hover:text-brand-gold transition-colors"
            title={t('closing.history.viewOperations')}
          >
            <Eye className="h-4 w-4" />
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <History className="h-6 w-6 text-brand-gold" />
          {t('closing.history.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t('closing.history.subtitle')}</p>
      </div>

      {/* History table */}
      {historyLoading ? (
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      ) : (
        <DataTable
          columns={historyColumns}
          data={history as unknown as AnyRow[]}
          pageSize={15}
          emptyMessage={t('closing.history.empty')}
        />
      )}
    </div>
  );
}
