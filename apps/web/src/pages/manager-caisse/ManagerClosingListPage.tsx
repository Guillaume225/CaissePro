import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Vault, Eye } from 'lucide-react';
import { useOpenCashDays, type CashDayRow } from '@/hooks/useClosing';
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0a2540]">
          <Vault className="h-6 w-6 text-amber-500" />
          {t('managerClosing.title')}
        </h1>
        <p className="mt-1 text-sm text-[#697386]">{t('managerClosing.subtitle')}</p>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="card animate-pulse text-sm text-[#697386]">{t('common.loading')}</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="border-b border-[#e0e6eb] bg-[#f6f9fc]">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                    {t('common.date')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                    {t('closing.history.reference')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                    {t('managerClosing.openedByCol')}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[#697386]">
                    {t('closing.openModal.openingBalance')}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[#697386]">
                    {t('closing.history.theoretical')}
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-[#697386]">
                    {t('closing.status')}
                  </th>
                  <th className="w-24 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {openDays.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-[#aab7c4]">
                      {t('managerClosing.empty')}
                    </td>
                  </tr>
                )}
                {openDays.map((row: CashDayRow, i: number) => {
                  const hours = Math.floor((Date.now() - new Date(row.openedAt).getTime()) / 3_600_000);
                  const isPending = row.status === 'PENDING_CLOSE';
                  const badgeClasses = isPending
                    ? 'bg-amber-50 text-amber-800'
                    : hours > 12
                      ? 'bg-[#fee2e2] text-[#991b1b]'
                      : 'bg-[#dcfce7] text-[#166534]';
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-[#e0e6eb] ${i % 2 === 1 ? 'bg-[#fafbfc]' : ''}`}
                    >
                      <td className="px-3 py-2">
                        {new Date(row.openedAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-brand-gold">
                        {row.reference}
                      </td>
                      <td className="px-3 py-2">{userMap.get(row.openedById) ?? row.openedById}</td>
                      <td className="px-3 py-2 text-right">{fmt(row.openingBalance)}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {fmt(row.theoreticalBalance)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClasses}`}
                          >
                            {isPending ? t('closing.statusPendingClose') : t('closing.statusOpen')}
                          </span>
                          <span
                            className={`text-[10px] ${hours > 12 ? 'font-medium text-red-500' : 'text-[#aab7c4]'}`}
                          >
                            {timeSince(row.openedAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#697386] hover:bg-zinc-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/manager-caisse/closing/${row.id}`);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t('managerClosing.detail')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
