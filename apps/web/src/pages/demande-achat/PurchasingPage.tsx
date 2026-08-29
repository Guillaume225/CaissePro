import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PackageSearch, PackageCheck, Wrench, Eye, Calculator } from 'lucide-react';
import { usePurchasingQueue, usePurchasingToPrice, useTakeoverPurchaseRequest } from '@/hooks/usePurchasing';
import { formatCFA, formatDate } from '@/lib/format';
import { extractApiErrorMessage } from '@/lib/errors';
import { PRIORITY_BADGE_CLASSES, PURCHASING_QUEUE_STATUSES, STATUS_BADGE_CLASSES } from './constants';
import type { PurchaseRequestPriority, PurchaseRequestStatus } from '@/types/demande-achat';

export default function PurchasingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [view, setView] = useState<'to-price' | 'to-process'>('to-price');
  const [service, setService] = useState('');
  const [priority, setPriority] = useState<PurchaseRequestPriority | ''>('');
  const [status, setStatus] = useState<PurchaseRequestStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const toPriceQuery = usePurchasingToPrice({
    service: service || undefined,
    priority: priority || undefined,
    perPage: 100,
  });
  const toProcessQuery = usePurchasingQueue({
    service: service || undefined,
    priority: priority || undefined,
    status: status || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    perPage: 100,
  });
  const { data, isLoading } = view === 'to-price' ? toPriceQuery : toProcessQuery;
  const takeoverMutation = useTakeoverPurchaseRequest();
  const [actionError, setActionError] = useState<string | null>(null);

  const requests = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0a2540]">{t('demandeAchat.purchasing.title')}</h1>
        <p className="text-sm text-[#697386]">{t('demandeAchat.purchasing.subtitle')}</p>
      </div>

      <div className="flex gap-2 border-b border-[#e0e6eb]">
        <button
          onClick={() => setView('to-price')}
          className={`px-3 py-2 text-sm font-medium ${
            view === 'to-price'
              ? 'border-b-2 border-brand-gold text-brand-gold'
              : 'text-[#697386] hover:text-[#0a2540]'
          }`}
        >
          {t('demandeAchat.purchasing.toPrice', 'À chiffrer')}
          {view === 'to-price' && toPriceQuery.data?.meta.total ? ` (${toPriceQuery.data.meta.total})` : ''}
        </button>
        <button
          onClick={() => setView('to-process')}
          className={`px-3 py-2 text-sm font-medium ${
            view === 'to-process'
              ? 'border-b-2 border-brand-gold text-brand-gold'
              : 'text-[#697386] hover:text-[#0a2540]'
          }`}
        >
          {t('demandeAchat.purchasing.toProcess', 'À traiter')}
        </button>
      </div>

      {actionError && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      {/* Filters */}
      <div className="card">
        <div className={`grid grid-cols-2 gap-3 ${view === 'to-price' ? 'sm:grid-cols-2' : 'sm:grid-cols-5'}`}>
          {view === 'to-process' && (
            <>
              <div>
                <label className="label">{t('common.date')}</label>
                <input
                  type="date"
                  className="input h-9"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="label">&nbsp;</label>
                <input
                  type="date"
                  className="input h-9"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </>
          )}
          <div>
            <label className="label">{t('demandeAchat.fields.service')}</label>
            <input
              className="input h-9"
              value={service}
              onChange={(e) => setService(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t('demandeAchat.fields.priority')}</label>
            <select
              className="input h-9"
              value={priority}
              onChange={(e) => setPriority(e.target.value as PurchaseRequestPriority | '')}
            >
              <option value="">{t('demandeAchat.list.allStatuses')}</option>
              <option value="NORMAL">{t('demandeAchat.priority.NORMAL')}</option>
              <option value="URGENT">{t('demandeAchat.priority.URGENT')}</option>
              <option value="VERY_URGENT">{t('demandeAchat.priority.VERY_URGENT')}</option>
            </select>
          </div>
          {view === 'to-process' && (
            <div>
              <label className="label">{t('common.status')}</label>
              <select
                className="input h-9"
                value={status}
                onChange={(e) => setStatus(e.target.value as PurchaseRequestStatus | '')}
              >
                <option value="">{t('demandeAchat.list.allStatuses')}</option>
                {PURCHASING_QUEUE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`demandeAchat.status.${s}`)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-[#e0e6eb]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="border-b border-[#e0e6eb] bg-[#f6f9fc]">
                  <tr className="text-left text-xs font-medium text-[#697386]">
                    <th className="px-3 py-2">{t('demandeAchat.fields.number')}</th>
                    <th className="px-3 py-2">{t('demandeAchat.fields.requester')}</th>
                    <th className="px-3 py-2">{t('demandeAchat.fields.service')}</th>
                    <th className="px-3 py-2">{t('demandeAchat.fields.subject')}</th>
                    <th className="px-3 py-2">{t('common.amount')}</th>
                    <th className="px-3 py-2">{t('common.status')}</th>
                    <th className="px-3 py-2">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-sm text-[#aab7c4]">
                        <PackageSearch className="mx-auto mb-2 h-8 w-8 text-[#e0e6eb]" />
                        {t('demandeAchat.purchasing.empty')}
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
                      <td className="px-3 py-2 text-[#0a2540]">{r.requesterName ?? '—'}</td>
                      <td className="px-3 py-2 text-[#697386]">{r.service}</td>
                      <td className="px-3 py-2 text-[#0a2540]">{r.subject}</td>
                      <td className="px-3 py-2 font-semibold text-[#0a2540]">
                        {formatCFA(r.totalEstimatedAmount)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[r.status]}`}
                        >
                          {t(`demandeAchat.status.${r.status}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/demande-achat/${r.id}`);
                            }}
                            className="rounded-md p-1.5 text-[#697386] hover:bg-zinc-100"
                            title={t('demandeAchat.validation.viewDetail')}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {view === 'to-price' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/demande-achat/${r.id}`);
                              }}
                              className="rounded-md p-1.5 text-amber-600 hover:bg-amber-50"
                              title={t('demandeAchat.actions.pricing', 'Chiffrer')}
                            >
                              <Calculator className="h-4 w-4" />
                            </button>
                          )}
                          {r.status === 'TRANSMITTED' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                takeoverMutation.mutate(r.id, {
                                  onError: (err) => setActionError(extractApiErrorMessage(err)),
                                });
                              }}
                              className="rounded-md p-1.5 text-blue-500 hover:bg-blue-50 hover:text-blue-700"
                              title={t('demandeAchat.actions.takeover')}
                            >
                              <PackageCheck className="h-4 w-4" />
                            </button>
                          )}
                          {(r.status === 'TAKEN_OVER' || r.status === 'IN_PROCESS') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/demande-achat/${r.id}`);
                              }}
                              className="rounded-md p-1.5 text-purple-500 hover:bg-purple-50 hover:text-purple-700"
                              title={t('demandeAchat.actions.process')}
                            >
                              <Wrench className="h-4 w-4" />
                            </button>
                          )}
                        </div>
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
