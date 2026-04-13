import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Vault, Eye } from 'lucide-react';
import { Badge, DataTable, Button } from '@/components/ui';
import type { Column } from '@/components/ui/DataTable';
import { useOpenCashDays, type CashDayRow } from '@/hooks/useClosing';
import { useUsers } from '@/hooks/useAdmin';

type AnyRow = Record<string, unknown>;

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'decimal' }).format(n) + ' FCFA';

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

export default function ManagerClosingListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: openDays = [], isLoading } = useOpenCashDays();
  const { data: users = [] } = useUsers();

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      map.set(u.id, `${u.firstName} ${u.lastName}`);
    }
    return map;
  }, [users]);

  const columns: Column<AnyRow>[] = [
    {
      key: 'openedAt',
      header: t('common.date'),
      sortable: true,
      render: (r) => {
        const row = r as unknown as CashDayRow;
        return <span className="text-sm">{new Date(row.openedAt).toLocaleDateString('fr-FR')}</span>;
      },
    },
    {
      key: 'reference',
      header: t('closing.history.reference'),
      render: (r) => {
        const row = r as unknown as CashDayRow;
        return <span className="font-mono text-xs text-brand-gold">{row.reference}</span>;
      },
    },
    {
      key: 'openedById',
      header: t('managerClosing.openedByCol'),
      render: (r) => {
        const row = r as unknown as CashDayRow;
        return <span className="text-sm">{userMap.get(row.openedById) ?? row.openedById}</span>;
      },
    },
    {
      key: 'openingBalance',
      header: t('closing.openModal.openingBalance'),
      className: 'text-right',
      render: (r) => {
        const row = r as unknown as CashDayRow;
        return <span className="text-sm">{fmt(row.openingBalance)}</span>;
      },
    },
    {
      key: 'theoreticalBalance',
      header: t('closing.history.theoretical'),
      className: 'text-right',
      render: (r) => {
        const row = r as unknown as CashDayRow;
        return <span className="text-sm font-semibold">{fmt(row.theoreticalBalance)}</span>;
      },
    },
    {
      key: 'status',
      header: t('closing.status'),
      className: 'text-center',
      render: (r) => {
        const row = r as unknown as CashDayRow;
        const hours = Math.floor((Date.now() - new Date(row.openedAt).getTime()) / 3_600_000);
        const isPending = row.status === 'PENDING_CLOSE';
        return (
          <div className="flex flex-col items-center gap-1">
            <Badge variant={isPending ? 'warning' : hours > 12 ? 'destructive' : 'success'}>
              {isPending ? t('closing.statusPendingClose') : t('closing.statusOpen')}
            </Badge>
            <span className={`text-[10px] ${hours > 12 ? 'font-medium text-red-500' : 'text-gray-400'}`}>
              {timeSince(row.openedAt)}
            </span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'text-center w-24',
      render: (r) => {
        const row = r as unknown as CashDayRow;
        return (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/manager-caisse/closing/${row.id}`);
            }}
          >
            <Eye className="mr-1 h-3.5 w-3.5" />
            {t('managerClosing.detail')}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Vault className="h-6 w-6 text-amber-500" />
          {t('managerClosing.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t('managerClosing.subtitle')}</p>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      ) : (
        <DataTable
          columns={columns}
          data={openDays as unknown as AnyRow[]}
          pageSize={15}
          emptyMessage={t('managerClosing.empty')}
        />
      )}
    </div>
  );
}
