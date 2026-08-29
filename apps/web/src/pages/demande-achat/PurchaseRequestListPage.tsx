import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ShoppingCart } from 'lucide-react';
import { useMyPurchaseRequests, useAllPurchaseRequests } from '@/hooks/usePurchaseRequests';
import { useAuthStore } from '@/stores/auth-store';
import { formatCFA, formatDate } from '@/lib/format';
import { ALL_STATUSES, PRIORITY_BADGE_CLASSES, STATUS_BADGE_CLASSES } from './constants';
import type { PurchaseRequestStatus } from '@/types/demande-achat';

interface PurchaseRequestListPageProps {
  /** 'mine' (default) = only requests the current user created; 'all' = every request (requires da.view_all). */
  mode?: 'mine' | 'all';
}

export default function PurchaseRequestListPage({ mode = 'mine' }: PurchaseRequestListPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();

  const [statusFilter, setStatusFilter] = useState<PurchaseRequestStatus | ''>('');
  const [search, setSearch] = useState('');

  const filters = { status: statusFilter || undefined, perPage: 100 };
  const mineQuery = useMyPurchaseRequests(filters, mode === 'mine');
  const allQuery = useAllPurchaseRequests(filters, mode === 'all');
  const { data, isLoading } = mode === 'all' ? allQuery : mineQuery;

  const requests = useMemo(() => {
    const list = data?.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (r) => r.number.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0a2540]">
            {t(mode === 'all' ? 'demandeAchat.list.allTitle' : 'demandeAchat.list.title')}
          </h1>
          <p className="text-sm text-[#697386]">
            {t(mode === 'all' ? 'demandeAchat.list.allSubtitle' : 'demandeAchat.list.subtitle')}
          </p>
        </div>
        {hasPermission('da.create') && (
          <button className="btn-primary" onClick={() => navigate('/demande-achat/new')}>
            <Plus className="h-4 w-4" />
            {t('demandeAchat.list.newRequest')}
          </button>
        )}
      </div>

      <div className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PurchaseRequestStatus | '')}
              className="input h-9 w-52"
            >
              <option value="">{t('demandeAchat.list.allStatuses')}</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`demandeAchat.status.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#aab7c4]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('demandeAchat.list.searchPlaceholder')}
              className="input h-9 w-full pl-9 sm:w-64"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-md border border-[#e0e6eb]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="border-b border-[#e0e6eb] bg-[#f6f9fc]">
                  <tr className="text-left text-xs font-medium text-[#697386]">
                    <th className="px-3 py-2">{t('demandeAchat.fields.number')}</th>
                    <th className="px-3 py-2">{t('demandeAchat.fields.subject')}</th>
                    {mode === 'all' && (
                      <th className="px-3 py-2">{t('demandeAchat.fields.requester')}</th>
                    )}
                    <th className="px-3 py-2">{t('common.amount')}</th>
                    <th className="px-3 py-2">{t('demandeAchat.fields.desiredDate')}</th>
                    <th className="px-3 py-2">{t('demandeAchat.fields.priority')}</th>
                    <th className="px-3 py-2">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 && (
                    <tr>
                      <td
                        colSpan={mode === 'all' ? 7 : 6}
                        className="px-3 py-10 text-center text-sm text-[#aab7c4]"
                      >
                        <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-[#e0e6eb]" />
                        {t('demandeAchat.list.empty')}
                      </td>
                    </tr>
                  )}
                  {requests.map((r, i) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/demande-achat/${r.id}`)}
                      className={`cursor-pointer border-b border-[#e0e6eb] hover:bg-[#f6f9fc] ${
                        i % 2 === 1 ? 'bg-[#fafbfc]' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-mono font-medium text-brand-gold">{r.number}</td>
                      <td className="px-3 py-2 text-[#0a2540]">{r.subject}</td>
                      {mode === 'all' && (
                        <td className="px-3 py-2 text-[#697386]">{r.requesterName ?? '—'}</td>
                      )}
                      <td className="px-3 py-2 font-semibold text-[#0a2540]">
                        {formatCFA(r.totalEstimatedAmount)}
                      </td>
                      <td className="px-3 py-2 text-[#697386]">{formatDate(r.desiredDate)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE_CLASSES[r.priority]}`}
                        >
                          {t(`demandeAchat.priority.${r.priority}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[r.status]}`}
                        >
                          {t(`demandeAchat.status.${r.status}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
