import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, XCircle, CheckCircle2, Eye, Check, X, Send } from 'lucide-react';
import { Button, Badge, DataTable, Modal } from '@/components/ui';
import type { Column } from '@/components/ui/DataTable';
import {
  usePendingDisbursementRequests,
  useApproveDisbursementRequest,
  useRejectDisbursementRequest,
  useProcessDisbursementRequest,
} from '@/hooks/useDisbursementRequests';
import type { DisbursementRequest } from '@/hooks/useDisbursementRequests';

type AnyRow = Record<string, unknown>;

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'decimal' }).format(n) + ' FCFA';

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

    // Optimistically remove from cache so it won't reappear on navigate back
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

  const pendingOnly = pendingRequests.filter((r) => r.status === 'PENDING' && !hiddenIds.has(r.id));
  const approvedRequests = pendingRequests.filter(
    (r) => r.status === 'APPROVED' && !hiddenIds.has(r.id),
  );

  const pendingColumns: Column<Record<string, unknown>>[] = [
    {
      key: 'reference',
      header: t('closing.pendingRequests.reference'),
      render: (r) => {
        const row = r as unknown as DisbursementRequest;
        return <span className="font-mono text-xs text-brand-gold">{row.reference}</span>;
      },
    },
    {
      key: 'requester',
      header: t('closing.pendingRequests.requester'),
      render: (r) => {
        const row = r as unknown as DisbursementRequest;
        return (
          <div>
            <p className="text-sm font-medium">
              {row.firstName} {row.lastName}
            </p>
            <p className="text-xs text-gray-400">{row.matricule}</p>
          </div>
        );
      },
    },
    {
      key: 'service',
      header: t('closing.pendingRequests.service'),
      render: (r) => (
        <span className="text-sm">{(r as unknown as DisbursementRequest).service}</span>
      ),
    },
    {
      key: 'amount',
      header: t('common.amount'),
      sortable: true,
      className: 'text-right',
      render: (r) => {
        const row = r as unknown as DisbursementRequest;
        return <span className="font-semibold text-gray-900">{fmt(row.amount)}</span>;
      },
    },
    {
      key: 'reason',
      header: t('closing.pendingRequests.reason'),
      render: (r) => {
        const row = r as unknown as DisbursementRequest;
        return (
          <span className="text-sm text-gray-600 truncate max-w-[200px] block">{row.reason}</span>
        );
      },
    },
    {
      key: 'createdAt',
      header: t('closing.pendingRequests.date'),
      sortable: true,
      render: (r) => {
        const row = r as unknown as DisbursementRequest;
        return (
          <span className="text-xs text-gray-500">
            {new Date(row.createdAt).toLocaleDateString('fr-FR')}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: t('closing.pendingRequests.actions'),
      className: 'text-right',
      render: (r) => {
        const row = r as unknown as DisbursementRequest;
        if (row.status === 'APPROVED') {
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedRequest(row);
                  setShowDetailModal(true);
                }}
                className="text-gray-500 hover:text-brand-gold"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={() => handleProcess(row)} className="text-xs">
                <Send className="h-4 w-4 mr-1" />
                {t('closing.pendingRequests.process')}
              </Button>
            </div>
          );
        }
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedRequest(row);
                setShowDetailModal(true);
              }}
              className="text-gray-500 hover:text-brand-gold"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleApprove(row.id)}
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleReject(row.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

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
            <Badge variant="warning" className="tabular-nums">
              {pendingOnly.length}
            </Badge>
          )}
        </div>
        <DataTable
          columns={pendingColumns}
          data={pendingOnly as unknown as AnyRow[]}
          pageSize={10}
          emptyMessage={t('closing.pendingRequests.empty')}
        />
      </div>

      {/* Approved requests (waiting to be processed) */}
      {approvedRequests.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-800">
            {t('closing.pendingRequests.approved')}
          </h2>
          <DataTable
            columns={pendingColumns}
            data={approvedRequests as unknown as AnyRow[]}
            pageSize={5}
            emptyMessage=""
          />
        </div>
      )}

      {/* Request Detail Modal */}
      <Modal
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={t('closing.pendingRequests.detailTitle')}
        size="md"
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-brand-gold">{selectedRequest.reference}</span>
              <Badge variant="warning" className="flex items-center gap-1.5 px-3 py-1">
                <Clock className="h-3.5 w-3.5" />
                {t('demande.status.pending')}
              </Badge>
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
                  <Button variant="destructive" onClick={() => handleReject(selectedRequest.id)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    {t('closing.pendingRequests.reject')}
                  </Button>
                  <Button variant="ghost" onClick={() => handleApprove(selectedRequest.id)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {t('closing.pendingRequests.approve')}
                  </Button>
                </>
              )}
              {selectedRequest.status === 'APPROVED' && (
                <Button onClick={() => handleProcess(selectedRequest)}>
                  <Send className="mr-2 h-4 w-4" />
                  {t('closing.pendingRequests.process')}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
