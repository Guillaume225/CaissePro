import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  XCircle,
  CheckCircle2,
  Eye,
  Check,
  X,
  Send,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  usePendingDisbursementRequests,
  useApproveDisbursementRequest,
  useRejectDisbursementRequest,
  useProcessDisbursementRequest,
} from '@/hooks/useDisbursementRequests';
import type { DisbursementRequest } from '@/hooks/useDisbursementRequests';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'decimal' }).format(n) + ' FCFA';
const PAGE_SIZE_DEFAULT = 10;

function ModalShell({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
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
        <div className="max-h-[75vh] overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function RequestsTable({
  t,
  rows,
  pageSize,
  emptyMessage,
  onView,
  onApprove,
  onReject,
  onProcess,
}: {
  t: (key: string) => string;
  rows: DisbursementRequest[];
  pageSize: number;
  emptyMessage: string;
  onView: (r: DisbursementRequest) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onProcess: (r: DisbursementRequest) => void;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageData = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-[#e0e6eb] bg-[#f6f9fc]">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                {t('closing.pendingRequests.reference')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                {t('closing.pendingRequests.requester')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                {t('closing.pendingRequests.service')}
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[#697386]">
                {t('common.amount')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                {t('closing.pendingRequests.reason')}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                {t('closing.pendingRequests.date')}
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[#697386]">
                {t('closing.pendingRequests.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-[#aab7c4]">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {pageData.map((row, i) => (
              <tr
                key={row.id}
                className={`border-b border-[#e0e6eb] ${i % 2 === 1 ? 'bg-[#fafbfc]' : ''}`}
              >
                <td className="px-3 py-2 font-mono text-xs text-brand-gold">{row.reference}</td>
                <td className="px-3 py-2">
                  <p className="text-sm font-medium text-[#0a2540]">
                    {row.firstName} {row.lastName}
                  </p>
                  <p className="text-xs text-[#aab7c4]">{row.matricule}</p>
                </td>
                <td className="px-3 py-2 text-sm text-[#0a2540]">{row.service}</td>
                <td className="px-3 py-2 text-right font-semibold text-[#0a2540]">
                  {fmt(row.amount)}
                </td>
                <td className="px-3 py-2">
                  <span className="block max-w-[200px] truncate text-sm text-[#697386]">
                    {row.reason}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-[#697386]">
                  {new Date(row.createdAt).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onView(row)}
                      className="rounded p-1.5 text-[#697386] hover:text-brand-gold"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {row.status === 'APPROVED' ? (
                      <button
                        onClick={() => onProcess(row)}
                        className="btn-primary px-2 py-1 text-xs"
                      >
                        <Send className="h-4 w-4" />
                        {t('closing.pendingRequests.process')}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => onApprove(row.id)}
                          className="rounded p-1.5 text-green-600 hover:bg-green-50"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onReject(row.id)}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#e0e6eb] px-3 py-2 text-xs text-[#697386]">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, rows.length)} sur {rows.length}
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
  );
}

export default function PendingRequestsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: pendingRequests = [] } = usePendingDisbursementRequests();
  const approveMutation = useApproveDisbursementRequest();
  const rejectMutation = useRejectDisbursementRequest();
  const processMutation = useProcessDisbursementRequest();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<DisbursementRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const handleApprove = (id: string) => {
    setHiddenIds((prev) => new Set(prev).add(id));
    setShowDetailModal(false);
    approveMutation.mutate(id, {
      onError: () =>
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }),
    });
  };

  const handleReject = (id: string) => {
    setHiddenIds((prev) => new Set(prev).add(id));
    setShowDetailModal(false);
    rejectMutation.mutate(
      { id },
      {
        onError: () =>
          setHiddenIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          }),
      },
    );
  };

  const handleProcess = (request: DisbursementRequest) => {
    if (request.status !== 'APPROVED') return;
    setHiddenIds((prev) => new Set(prev).add(request.id));
    setShowDetailModal(false);

    queryClient.setQueryData<DisbursementRequest[]>(
      ['disbursement-requests', 'pending'],
      (old) => old?.filter((r) => r.id !== request.id) ?? [],
    );

    processMutation.mutate(
      { id: request.id },
      {
        onError: () => {
          setHiddenIds((prev) => {
            const next = new Set(prev);
            next.delete(request.id);
            return next;
          });
          queryClient.invalidateQueries({ queryKey: ['disbursement-requests', 'pending'] });
        },
      },
    );
    navigate('/expenses/new', {
      state: {
        fromRequest: true,
        requestId: request.id,
        reference: request.reference,
        beneficiary: `${request.firstName} ${request.lastName}`,
        amount: request.amount,
        description: request.reason,
        service: request.service,
        matricule: request.matricule,
      },
    });
  };

  const pendingOnly = useMemo(
    () => pendingRequests.filter((r) => r.status === 'PENDING' && !hiddenIds.has(r.id)),
    [pendingRequests, hiddenIds],
  );
  const approvedRequests = useMemo(
    () => pendingRequests.filter((r) => r.status === 'APPROVED' && !hiddenIds.has(r.id)),
    [pendingRequests, hiddenIds],
  );

  const openDetail = (r: DisbursementRequest) => {
    setSelectedRequest(r);
    setShowDetailModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('closing.pendingRequests.title')}</h1>
        <p className="text-sm text-gray-500">{t('pendingRequests.subtitle')}</p>
      </div>

      {/* Pending requests */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-800">
            {t('closing.pendingRequests.title')}
          </h2>
          {pendingOnly.length > 0 && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-800">
              {pendingOnly.length}
            </span>
          )}
        </div>
        <RequestsTable
          t={t}
          rows={pendingOnly}
          pageSize={PAGE_SIZE_DEFAULT}
          emptyMessage={t('closing.pendingRequests.empty')}
          onView={openDetail}
          onApprove={handleApprove}
          onReject={handleReject}
          onProcess={handleProcess}
        />
      </div>

      {/* Approved requests (waiting to be processed) */}
      {approvedRequests.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-800">
            {t('closing.pendingRequests.approved')}
          </h2>
          <RequestsTable
            t={t}
            rows={approvedRequests}
            pageSize={5}
            emptyMessage=""
            onView={openDetail}
            onApprove={handleApprove}
            onReject={handleReject}
            onProcess={handleProcess}
          />
        </div>
      )}

      {/* Request Detail Modal */}
      <ModalShell
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={t('closing.pendingRequests.detailTitle')}
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-brand-gold">{selectedRequest.reference}</span>
              <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                <Clock className="h-3.5 w-3.5" />
                {t('demande.status.pending')}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-gray-500">{t('demande.form.lastName')}</p>
                <p className="text-sm font-medium">
                  {selectedRequest.lastName} {selectedRequest.firstName}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('demande.form.service')}</p>
                <p className="text-sm font-medium">{selectedRequest.service}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('demande.form.position')}</p>
                <p className="text-sm font-medium">{selectedRequest.position}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('demande.form.matricule')}</p>
                <p className="text-sm font-medium">{selectedRequest.matricule}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('demande.form.phone')}</p>
                <p className="text-sm font-medium">{selectedRequest.phone}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('demande.form.email')}</p>
                <p className="text-sm font-medium">{selectedRequest.email}</p>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 p-4">
              <p className="text-xs text-gray-500">{t('common.amount')}</p>
              <p className="text-xl font-bold text-gray-900">{fmt(selectedRequest.amount)}</p>
            </div>

            <div>
              <p className="text-xs text-gray-500">{t('demande.form.reason')}</p>
              <p className="mt-1 text-sm text-gray-700">{selectedRequest.reason}</p>
            </div>

            <div>
              <p className="text-xs text-gray-500">{t('closing.pendingRequests.date')}</p>
              <p className="text-sm text-gray-600">
                {new Date(selectedRequest.createdAt).toLocaleString('fr-FR')}
              </p>
            </div>

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:justify-end">
              {selectedRequest.status === 'PENDING' && (
                <>
                  <button
                    className="btn-primary bg-red-600 hover:bg-red-700"
                    onClick={() => handleReject(selectedRequest.id)}
                  >
                    <XCircle className="h-4 w-4" />
                    {t('closing.pendingRequests.reject')}
                  </button>
                  <button className="btn-secondary" onClick={() => handleApprove(selectedRequest.id)}>
                    <CheckCircle2 className="h-4 w-4" />
                    {t('closing.pendingRequests.approve')}
                  </button>
                </>
              )}
              {selectedRequest.status === 'APPROVED' && (
                <button className="btn-primary" onClick={() => handleProcess(selectedRequest)}>
                  <Send className="h-4 w-4" />
                  {t('closing.pendingRequests.process')}
                </button>
              )}
            </div>
          </div>
        )}
      </ModalShell>
    </div>
  );
}
