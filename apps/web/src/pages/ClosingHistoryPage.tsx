import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  History,
  Eye,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useClosingHistory } from '@/hooks/useClosing';
import type { CashClosingRecord } from '@/types/admin';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'decimal' }).format(n) + ' FCFA';
const PAGE_SIZE = 15;

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' | null }) {
  if (!active || !dir) return <ArrowUpDown className="h-3 w-3 text-[#aab7c4]" />;
  return dir === 'asc' ? (
    <ArrowUp className="h-3 w-3 text-[#0a2540]" />
  ) : (
    <ArrowDown className="h-3 w-3 text-[#0a2540]" />
  );
}

export default function ClosingHistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: history = [], isLoading: historyLoading } = useClosingHistory();
  const [sortKey, setSortKey] = useState<'closedAt' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [page, setPage] = useState(1);

  const toggleSort = () => {
    if (!sortKey) {
      setSortKey('closedAt');
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
    if (!sortKey || !sortDir) return history;
    return [...history].sort((a, b) => {
      const av = a.closedAt ?? '';
      const bv = b.closedAt ?? '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [history, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0a2540]">
          <History className="h-6 w-6 text-brand-gold" />
          {t('closing.history.title')}
        </h1>
        <p className="mt-1 text-sm text-[#697386]">{t('closing.history.subtitle')}</p>
      </div>

      {/* History table */}
      {historyLoading ? (
        <div className="card animate-pulse text-sm text-[#697386]">{t('common.loading')}</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="border-b border-[#e0e6eb] bg-[#f6f9fc]">
                <tr>
                  <th
                    className="cursor-pointer select-none px-3 py-2 text-left text-xs font-medium text-[#697386]"
                    onClick={toggleSort}
                  >
                    <span className="flex items-center gap-1">
                      {t('closing.history.closedAt')}
                      <SortIcon active={!!sortKey} dir={sortDir} />
                    </span>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                    {t('closing.history.reference')}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[#697386]">
                    {t('closing.openModal.openingBalance')}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[#697386]">
                    {t('closing.history.theoretical')}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[#697386]">
                    {t('closing.history.actual')}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[#697386]">
                    {t('closing.history.gap')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                    {t('common.time')}
                  </th>
                  <th className="w-12 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-sm text-[#aab7c4]">
                      {t('closing.history.empty')}
                    </td>
                  </tr>
                )}
                {pageData.map((row: CashClosingRecord, i: number) => {
                  const date = row.closedAt ? new Date(row.closedAt) : null;
                  const gap = row.variance ?? 0;
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-[#e0e6eb] ${i % 2 === 1 ? 'bg-[#fafbfc]' : ''}`}
                    >
                      <td className="px-3 py-2">{date ? date.toLocaleDateString('fr-FR') : '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs text-brand-gold">
                        {row.reference}
                      </td>
                      <td className="px-3 py-2 text-right">{fmt(row.openingBalance ?? 0)}</td>
                      <td className="px-3 py-2 text-right">{fmt(row.theoreticalBalance ?? 0)}</td>
                      <td className="px-3 py-2 text-right">{fmt(row.actualBalance ?? 0)}</td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`font-medium ${gap === 0 ? 'text-[#697386]' : gap > 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {gap > 0 ? '+' : ''}
                          {fmt(gap)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-[#697386]">
                        {date
                          ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => navigate(`/manager-caisse/closing/${row.id}`)}
                          className="rounded p-1.5 text-[#697386] hover:bg-brand-gold/10 hover:text-brand-gold"
                          title={t('closing.history.viewOperations')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
