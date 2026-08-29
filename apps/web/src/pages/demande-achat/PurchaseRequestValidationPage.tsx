import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, RotateCcw, Eye, ClipboardCheck, X } from 'lucide-react';
import {
  usePurchaseRequestsToValidate,
  useApprovePurchaseRequest,
  useRejectPurchaseRequest,
  useReturnPurchaseRequest,
} from '@/hooks/usePurchaseRequestApprovals';
import { formatCFA, formatDate } from '@/lib/format';
import { extractApiErrorMessage } from '@/lib/errors';
import { PRIORITY_BADGE_CLASSES } from './constants';
import type { PurchaseRequest } from '@/types/demande-achat';

function ModalShell({
  open,
  onClose,
  title,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-md bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e0e6eb] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#0a2540]">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#697386] hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-[#e0e6eb] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PurchaseRequestValidationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isLoading } = usePurchaseRequestsToValidate({ perPage: 100 });
  const approveMutation = useApprovePurchaseRequest();
  const rejectMutation = useRejectPurchaseRequest();
  const returnMutation = useReturnPurchaseRequest();

  const [selected, setSelected] = useState<PurchaseRequest | null>(null);
  const [modal, setModal] = useState<'reject' | 'return' | null>(null);
  const [motif, setMotif] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const onErr = { onError: (err: unknown) => setActionError(extractApiErrorMessage(err)) };

  const requests = data?.data ?? [];

  const closeModal = () => {
    setModal(null);
    setSelected(null);
    setMotif('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0a2540]">{t('demandeAchat.validation.title')}</h1>
        <p className="text-sm text-[#697386]">{t('demandeAchat.validation.subtitle')}</p>
      </div>

      {actionError && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

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
                    <th className="px-3 py-2">{t('demandeAchat.fields.subject')}</th>
                    <th className="px-3 py-2">{t('common.amount')}</th>
                    <th className="px-3 py-2">{t('common.date')}</th>
                    <th className="px-3 py-2">{t('demandeAchat.fields.priority')}</th>
                    <th className="px-3 py-2">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-sm text-[#aab7c4]">
                        <ClipboardCheck className="mx-auto mb-2 h-8 w-8 text-[#e0e6eb]" />
                        {t('demandeAchat.validation.empty')}
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
                      <td className="px-3 py-2 text-[#0a2540]">{r.subject}</td>
                      <td className="px-3 py-2 font-semibold text-[#0a2540]">
                        {formatCFA(r.totalEstimatedAmount)}
                      </td>
                      <td className="px-3 py-2 text-[#697386]">{formatDate(r.createdAt)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE_CLASSES[r.priority]}`}
                        >
                          {t(`demandeAchat.priority.${r.priority}`)}
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              approveMutation.mutate({ id: r.id }, onErr);
                            }}
                            className="rounded-md p-1.5 text-green-500 hover:bg-green-50 hover:text-green-700"
                            title={t('demandeAchat.actions.approve')}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(r);
                              setModal('return');
                            }}
                            className="rounded-md p-1.5 text-amber-500 hover:bg-amber-50 hover:text-amber-700"
                            title={t('demandeAchat.actions.return')}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(r);
                              setModal('reject');
                            }}
                            className="rounded-md p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700"
                            title={t('demandeAchat.actions.reject')}
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
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

      <ModalShell
        open={modal === 'reject'}
        onClose={closeModal}
        title={t('demandeAchat.actions.reject')}
        footer={
          <>
            <button className="btn-secondary" onClick={closeModal}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
              disabled={!motif.trim() || rejectMutation.isPending}
              onClick={() =>
                selected &&
                rejectMutation.mutate(
                  { id: selected.id, motif: motif.trim() },
                  { onSuccess: closeModal, ...onErr },
                )
              }
            >
              <XCircle className="h-4 w-4" />
              {t('common.confirm')}
            </button>
          </>
        }
      >
        <label className="label">{t('demandeAchat.detail.motifRequired')}</label>
        <textarea className="input" rows={3} autoFocus value={motif} onChange={(e) => setMotif(e.target.value)} />
      </ModalShell>

      <ModalShell
        open={modal === 'return'}
        onClose={closeModal}
        title={t('demandeAchat.actions.return')}
        footer={
          <>
            <button className="btn-secondary" onClick={closeModal}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary disabled:opacity-50"
              disabled={!motif.trim() || returnMutation.isPending}
              onClick={() =>
                selected &&
                returnMutation.mutate(
                  { id: selected.id, motif: motif.trim() },
                  { onSuccess: closeModal, ...onErr },
                )
              }
            >
              <RotateCcw className="h-4 w-4" />
              {t('common.confirm')}
            </button>
          </>
        }
      >
        <label className="label">{t('demandeAchat.detail.motifRequired')}</label>
        <textarea className="input" rows={3} autoFocus value={motif} onChange={(e) => setMotif(e.target.value)} />
      </ModalShell>
    </div>
  );
}
