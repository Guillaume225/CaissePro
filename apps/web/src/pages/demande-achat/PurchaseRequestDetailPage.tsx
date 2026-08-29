import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Pencil,
  Ban,
  CheckCircle2,
  XCircle,
  RotateCcw,
  PackageCheck,
  Wrench,
  Lock,
  FileText,
  MessageSquare,
  Paperclip,
  X,
  Clock,
  Download,
  Calculator,
  ClipboardList,
  Upload,
} from 'lucide-react';
import api from '@/lib/api';
import {
  usePurchaseRequest,
  useSubmitPurchaseRequest,
  useCancelPurchaseRequest,
  useAddPurchaseRequestComment,
  useUpdateLinePricing,
  useSubmitToCircuit,
  useReopenToPricing,
  useUploadPurchaseRequestAttachment,
  useDeletePurchaseRequestAttachment,
} from '@/hooks/usePurchaseRequests';
import {
  useApprovePurchaseRequest,
  useRejectPurchaseRequest,
  useReturnPurchaseRequest,
} from '@/hooks/usePurchaseRequestApprovals';
import {
  useTakeoverPurchaseRequest,
  useProcessPurchaseRequest,
  useClosePurchaseRequest,
} from '@/hooks/usePurchasing';
import { useAuthStore } from '@/stores/auth-store';
import { extractApiErrorMessage } from '@/lib/errors';
import { formatCFA, formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  PRIORITY_BADGE_CLASSES,
  STATUS_BADGE_CLASSES,
  MAIN_LIFECYCLE_STEPS,
  BRANCH_STATUSES,
  DOCUMENT_TYPES,
} from './constants';
import type { PurchaseRequest, PurchaseRequestDocumentType } from '@/types/demande-achat';

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

type ActionModal = 'approve' | 'reject' | 'return' | 'cancel' | 'process' | 'close' | null;

/** Where a branched-off request (rejected/returned/cancelled) left the main path. */
function branchAnchorStatus(request: PurchaseRequest): (typeof MAIN_LIFECYCLE_STEPS)[number] {
  const branchEntry = [...request.history]
    .reverse()
    .find((h) => h.toStatus === request.status && h.fromStatus);
  const anchor = branchEntry?.fromStatus;
  if (anchor && (MAIN_LIFECYCLE_STEPS as string[]).includes(anchor)) {
    return anchor as (typeof MAIN_LIFECYCLE_STEPS)[number];
  }
  return 'SUBMITTED';
}

function LifecycleTracker({ request, t }: { request: PurchaseRequest; t: TFunction }) {
  const isBranch = BRANCH_STATUSES.includes(request.status);
  const anchorStatus = isBranch ? branchAnchorStatus(request) : request.status;
  const activeIndex = MAIN_LIFECYCLE_STEPS.indexOf(anchorStatus);

  const approvalsThisCycle = request.approvals.filter((a) => a.cycle === request.cycle);
  const maxLevel = approvalsThisCycle.reduce((max, a) => Math.max(max, a.level), 0);

  const BRANCH_STYLES: Record<string, { dot: string; text: string; icon: typeof XCircle }> = {
    REJECTED: { dot: 'bg-red-600 text-white', text: 'text-red-700', icon: XCircle },
    RETURNED: { dot: 'bg-orange-500 text-white', text: 'text-orange-700', icon: RotateCcw },
    CANCELLED: { dot: 'bg-zinc-500 text-white', text: 'text-zinc-700', icon: Ban },
  };

  return (
    <div className="card">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {MAIN_LIFECYCLE_STEPS.slice(0, isBranch ? activeIndex + 1 : MAIN_LIFECYCLE_STEPS.length).map(
          (step, idx) => {
            const completed = isBranch ? idx <= activeIndex : idx < activeIndex;
            const isCurrent = !isBranch && idx === activeIndex;
            return (
              <div key={step} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      completed
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                          ? 'bg-brand-gold text-white'
                          : 'bg-zinc-100 text-zinc-400',
                    )}
                  >
                    {completed ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span
                    className={cn(
                      'whitespace-nowrap text-[11px]',
                      isCurrent ? 'font-semibold text-[#0a2540]' : completed ? 'text-emerald-700' : 'text-zinc-400',
                    )}
                  >
                    {isCurrent && step === 'IN_VALIDATION' && request.currentApprovalLevel == null
                      ? t('demandeAchat.detail.awaitingPricingShort', 'En attente de chiffrage')
                      : t(`demandeAchat.status.${step}`)}
                    {isCurrent && step === 'IN_VALIDATION' && maxLevel > 0
                      ? ` (${request.currentApprovalLevel}/${maxLevel})`
                      : ''}
                  </span>
                </div>
                {idx < MAIN_LIFECYCLE_STEPS.length - 1 && (
                  <div className={cn('mx-1 h-0.5 flex-1', completed ? 'bg-emerald-500' : 'bg-zinc-200')} />
                )}
              </div>
            );
          },
        )}
        {isBranch &&
          (() => {
            const style = BRANCH_STYLES[request.status];
            const Icon = style.icon;
            return (
              <div className="flex flex-col items-center gap-1">
                <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', style.dot)}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={cn('whitespace-nowrap text-[11px] font-semibold', style.text)}>
                  {t(`demandeAchat.status.${request.status}`)}
                </span>
              </div>
            );
          })()}
      </div>
    </div>
  );
}

function PricingSection({
  request,
  updatePricingMutation,
  submitToCircuitMutation,
}: {
  request: PurchaseRequest;
  updatePricingMutation: ReturnType<typeof useUpdateLinePricing>;
  submitToCircuitMutation: ReturnType<typeof useSubmitToCircuit>;
}) {
  const { t } = useTranslation();
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrices(
      Object.fromEntries(
        request.lines.map((l) => [l.id, l.estimatedUnitPrice ? String(l.estimatedUnitPrice) : '']),
      ),
    );
  }, [request.lines]);

  const total = request.lines.reduce(
    (sum, l) => sum + Number(l.quantity) * (Number(prices[l.id]) || 0),
    0,
  );
  const allPriced = request.lines.every((l) => Number(prices[l.id]) > 0);
  const hasQuote = request.attachments.some(
    (a) => a.documentType === 'DEVIS' || a.documentType === 'FACTURE_PROFORMA',
  );

  const savePrices = async () => {
    setError(null);
    try {
      await updatePricingMutation.mutateAsync(
        request.lines.map((l) => ({ lineId: l.id, estimatedUnitPrice: Number(prices[l.id]) || 0 })),
      );
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  const submitToCircuit = async () => {
    setError(null);
    try {
      await savePrices();
      await submitToCircuitMutation.mutateAsync();
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  return (
    <div className="card space-y-3 border-2 border-amber-200">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-amber-600" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-700">
          {t('demandeAchat.detail.pricingTitle', 'Chiffrage (service achats)')}
        </h2>
      </div>
      <p className="text-xs text-[#697386]">
        {t(
          'demandeAchat.detail.pricingHint',
          "Saisissez le prix de chaque ligne et joignez au moins un devis fournisseur (section Pièces jointes) avant de soumettre au circuit de validation.",
        )}
      </p>

      <div className="overflow-x-auto rounded-md border border-[#e0e6eb]">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-[#e0e6eb] bg-[#f6f9fc]">
            <tr className="text-left text-xs font-medium text-[#697386]">
              <th className="px-3 py-2">{t('demandeAchat.fields.designation')}</th>
              <th className="px-3 py-2">{t('demandeAchat.fields.quantity')}</th>
              <th className="px-3 py-2">{t('demandeAchat.fields.unit')}</th>
              <th className="px-3 py-2 text-right">{t('demandeAchat.fields.estimatedUnitPrice')}</th>
              <th className="px-3 py-2 text-right">{t('demandeAchat.fields.estimatedAmount')}</th>
            </tr>
          </thead>
          <tbody>
            {request.lines.map((l, i) => (
              <tr key={l.id} className={`border-b border-[#e0e6eb] ${i % 2 === 1 ? 'bg-[#fafbfc]' : ''}`}>
                <td className="px-3 py-2">
                  <p className="font-medium text-[#0a2540]">{l.designation}</p>
                </td>
                <td className="px-3 py-2 text-[#697386]">{l.quantity}</td>
                <td className="px-3 py-2 text-[#697386]">{l.unit}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="input w-28 py-1 text-right"
                    value={prices[l.id] ?? ''}
                    onChange={(e) => setPrices((p) => ({ ...p, [l.id]: e.target.value }))}
                  />
                </td>
                <td className="px-3 py-2 text-right font-medium text-[#0a2540]">
                  {formatCFA(Number(l.quantity) * (Number(prices[l.id]) || 0))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#e0e6eb] bg-[#f6f9fc]">
              <td colSpan={4} className="px-3 py-2 text-right text-sm font-semibold text-[#0a2540]">
                {t('common.total')}
              </td>
              <td className="px-3 py-2 text-right text-sm font-bold text-brand-gold">
                {formatCFA(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!hasQuote && (
        <p className="text-xs text-amber-700">
          {t(
            'demandeAchat.detail.quoteRequired',
            "Aucun devis fournisseur n'est encore joint (voir section Pièces jointes) — requis avant de soumettre au circuit.",
          )}
        </p>
      )}

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          className="btn-secondary"
          disabled={updatePricingMutation.isPending}
          onClick={savePrices}
        >
          {t('common.save')}
        </button>
        <button
          className="btn-primary disabled:opacity-50"
          disabled={!allPriced || !hasQuote || submitToCircuitMutation.isPending}
          onClick={submitToCircuit}
        >
          {t('demandeAchat.actions.submitToCircuit', 'Soumettre au circuit')}
        </button>
      </div>
    </div>
  );
}

const HISTORY_ICON: Record<string, typeof FileText> = {
  CREATED: FileText,
  SUBMITTED: Send,
  PRICED: Calculator,
  SUBMITTED_TO_CIRCUIT: ClipboardList,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  RETURNED: RotateCcw,
  VALIDATED: CheckCircle2,
  TRANSMITTED: PackageCheck,
  TAKEN_OVER: PackageCheck,
  PROCESSED: Wrench,
  CLOSED: Lock,
  CANCELLED: Ban,
  COMMENT: MessageSquare,
};

export default function PurchaseRequestDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, hasPermission } = useAuthStore();

  const { data: request, isLoading } = usePurchaseRequest(id ?? '');
  const submitMutation = useSubmitPurchaseRequest();
  const updatePricingMutation = useUpdateLinePricing(id ?? '');
  const submitToCircuitMutation = useSubmitToCircuit(id ?? '');
  const reopenToPricingMutation = useReopenToPricing(id ?? '');
  const cancelMutation = useCancelPurchaseRequest();
  const commentMutation = useAddPurchaseRequestComment();
  const approveMutation = useApprovePurchaseRequest();
  const rejectMutation = useRejectPurchaseRequest();
  const returnMutation = useReturnPurchaseRequest();
  const takeoverMutation = useTakeoverPurchaseRequest();
  const processMutation = useProcessPurchaseRequest();
  const closeMutation = useClosePurchaseRequest();
  const uploadAttachment = useUploadPurchaseRequestAttachment(id ?? '');
  const deleteAttachment = useDeletePurchaseRequestAttachment(id ?? '');

  const [activeModal, setActiveModal] = useState<ActionModal>(null);
  const [motif, setMotif] = useState('');
  const [comment, setComment] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [processFields, setProcessFields] = useState({
    additionalInfo: '',
    expectedDate: '',
    observation: '',
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const onErr = { onError: (err: unknown) => setActionError(extractApiErrorMessage(err)) };
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [docType, setDocType] = useState<PurchaseRequestDocumentType>('DEVIS');
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      uploadAttachment.mutate({ file, documentType: docType }, { ...onErr });
    }
  }

  const downloadAttachment = async (attachmentId: string, fileName: string) => {
    if (!id) return;
    setDownloadingId(attachmentId);
    setActionError(null);
    try {
      const { data } = await api.get(`/demandes-achat/${id}/attachments/${attachmentId}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(extractApiErrorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setMotif('');
    setComment('');
  };

  if (isLoading || !request) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  const isRequester = request.requesterId === user?.id;
  const canEdit =
    isRequester && hasPermission('da.update') && (request.status === 'DRAFT' || request.status === 'RETURNED');
  const canSubmit =
    isRequester && hasPermission('da.submit') && (request.status === 'DRAFT' || request.status === 'RETURNED');
  const canCancel =
    hasPermission('da.cancel') &&
    ['DRAFT', 'SUBMITTED', 'IN_VALIDATION', 'VALIDATED'].includes(request.status);
  const isEligibleApprover =
    !isRequester &&
    request.status === 'IN_VALIDATION' &&
    request.approvals.some(
      (a) =>
        a.status === 'PENDING' &&
        a.cycle === request.cycle &&
        a.level === request.currentApprovalLevel &&
        a.approverId === user?.id,
    );
  const canApprove = hasPermission('da.approve') && isEligibleApprover;
  const canReject = hasPermission('da.reject') && isEligibleApprover;
  const canReturn = hasPermission('da.return') && isEligibleApprover;
  const canTakeover = hasPermission('da.takeover') && request.status === 'TRANSMITTED';
  const canProcess = hasPermission('da.process') && request.status === 'TAKEN_OVER';
  const canClose = hasPermission('da.close') && request.status === 'IN_PROCESS';
  const isAwaitingPricing = request.status === 'IN_VALIDATION' && request.currentApprovalLevel == null;
  const canPrice = isAwaitingPricing && hasPermission('da.process');
  const canManageAttachments =
    hasPermission('da.update') && !['CLOSED', 'CANCELLED', 'REJECTED'].includes(request.status);
  const canReopen = hasPermission('da.process') && request.status === 'CANCELLED';

  const hasActions =
    canEdit || canSubmit || canCancel || canApprove || canReject || canReturn || canTakeover || canProcess || canClose || canReopen;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-xl font-bold text-gray-900">{request.number}</h1>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[request.status]}`}
              >
                {t(`demandeAchat.status.${request.status}`)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE_CLASSES[request.priority]}`}
              >
                {t(`demandeAchat.priority.${request.priority}`)}
              </span>
            </div>
            <p className="text-sm text-gray-500">{request.subject}</p>
          </div>
        </div>
        {canEdit && (
          <button
            className="btn-secondary"
            onClick={() => navigate(`/demande-achat/${request.id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
            {t('common.edit')}
          </button>
        )}
      </div>

      <LifecycleTracker request={request} t={t} />

      {actionError && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      {/* Action bar */}
      {hasActions && (
        <div className="card flex flex-wrap items-center gap-2 py-4">
          {canSubmit && (
            <button
              className="btn-primary"
              onClick={() => submitMutation.mutate(request.id, onErr)}
            >
              <Send className="h-4 w-4" />
              {t('demandeAchat.actions.submit')}
            </button>
          )}
          {canApprove && (
            <button
              className="btn-primary bg-green-600 hover:bg-green-700"
              onClick={() => setActiveModal('approve')}
            >
              <CheckCircle2 className="h-4 w-4" />
              {t('demandeAchat.actions.approve')}
            </button>
          )}
          {canReject && (
            <button
              className="btn-primary bg-red-600 hover:bg-red-700"
              onClick={() => setActiveModal('reject')}
            >
              <XCircle className="h-4 w-4" />
              {t('demandeAchat.actions.reject')}
            </button>
          )}
          {canReturn && (
            <button className="btn-secondary" onClick={() => setActiveModal('return')}>
              <RotateCcw className="h-4 w-4" />
              {t('demandeAchat.actions.return')}
            </button>
          )}
          {canTakeover && (
            <button
              className="btn-primary"
              onClick={() => takeoverMutation.mutate(request.id, onErr)}
              disabled={takeoverMutation.isPending}
            >
              <PackageCheck className="h-4 w-4" />
              {t('demandeAchat.actions.takeover')}
            </button>
          )}
          {canProcess && (
            <button className="btn-primary" onClick={() => setActiveModal('process')}>
              <Wrench className="h-4 w-4" />
              {t('demandeAchat.actions.process')}
            </button>
          )}
          {canClose && (
            <button className="btn-primary" onClick={() => setActiveModal('close')}>
              <Lock className="h-4 w-4" />
              {t('demandeAchat.actions.close')}
            </button>
          )}
          {canReopen && (
            <button
              className="btn-secondary"
              disabled={reopenToPricingMutation.isPending}
              onClick={() => reopenToPricingMutation.mutate(undefined, onErr)}
            >
              <Calculator className="h-4 w-4" />
              {t('demandeAchat.actions.reopenToPricing', 'Rouvrir pour chiffrage')}
            </button>
          )}
          {canCancel && (
            <button
              className="btn-secondary ml-auto text-red-600 hover:bg-red-50"
              onClick={() => setActiveModal('cancel')}
            >
              <Ban className="h-4 w-4" />
              {t('demandeAchat.actions.cancel')}
            </button>
          )}
        </div>
      )}

      {/* General info */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#697386]">
          {t('demandeAchat.form.generalInfo')}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label={t('demandeAchat.fields.requester')} value={request.requesterName ?? '—'} />
          <Field label={t('demandeAchat.fields.service')} value={request.service} />
          <Field label={t('demandeAchat.fields.department')} value={request.department} />
          <Field label={t('demandeAchat.fields.desiredDate')} value={formatDate(request.desiredDate)} />
          <Field label={t('demandeAchat.fields.project')} value={request.project || '—'} />
          <Field label={t('demandeAchat.fields.costCenter')} value={request.costCenter || '—'} />
          <Field label={t('demandeAchat.fields.budget')} value={request.budget || '—'} />
          <Field label={t('demandeAchat.fields.site')} value={request.site || '—'} />
        </div>
        <div className="border-t border-[#e0e6eb] pt-3">
          <p className="text-xs font-medium text-[#697386]">{t('demandeAchat.fields.justification')}</p>
          <p className="mt-1 text-sm text-[#0a2540]">{request.justification}</p>
        </div>
        {request.urgencyReason && (
          <div className="border-t border-[#e0e6eb] pt-3">
            <p className="text-xs font-medium text-[#697386]">{t('demandeAchat.fields.urgencyReason')}</p>
            <p className="mt-1 text-sm text-[#0a2540]">{request.urgencyReason}</p>
          </div>
        )}
        {request.generalComment && (
          <div className="border-t border-[#e0e6eb] pt-3">
            <p className="text-xs font-medium text-[#697386]">{t('demandeAchat.fields.generalComment')}</p>
            <p className="mt-1 text-sm text-[#0a2540]">{request.generalComment}</p>
          </div>
        )}
      </div>

      {canPrice && (
        <PricingSection
          request={request}
          updatePricingMutation={updatePricingMutation}
          submitToCircuitMutation={submitToCircuitMutation}
        />
      )}
      {isAwaitingPricing && !canPrice && (
        <div className="card flex items-center gap-2 border-amber-200 bg-amber-50 text-sm text-amber-800">
          <Calculator className="h-4 w-4 shrink-0" />
          {t(
            'demandeAchat.detail.awaitingPricing',
            'Cette demande attend le chiffrage (prix + devis) par le service achats avant son entrée dans le circuit de validation.',
          )}
        </div>
      )}

      {/* Lines */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#697386]">
          {t('demandeAchat.form.lines')}
        </h2>
        <div className="overflow-x-auto rounded-md border border-[#e0e6eb]">
          <table className="w-full border-collapse text-sm">
            <thead className="border-b border-[#e0e6eb] bg-[#f6f9fc]">
              <tr className="text-left text-xs font-medium text-[#697386]">
                <th className="px-3 py-2">{t('demandeAchat.fields.designation')}</th>
                <th className="px-3 py-2">{t('demandeAchat.fields.quantity')}</th>
                <th className="px-3 py-2">{t('demandeAchat.fields.unit')}</th>
                <th className="px-3 py-2 text-right">{t('demandeAchat.fields.estimatedUnitPrice')}</th>
                <th className="px-3 py-2 text-right">{t('demandeAchat.fields.estimatedAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {request.lines.map((l, i) => (
                <tr key={l.id} className={`border-b border-[#e0e6eb] ${i % 2 === 1 ? 'bg-[#fafbfc]' : ''}`}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-[#0a2540]">{l.designation}</p>
                    {l.description && <p className="text-xs text-[#aab7c4]">{l.description}</p>}
                  </td>
                  <td className="px-3 py-2 text-[#697386]">{l.quantity}</td>
                  <td className="px-3 py-2 text-[#697386]">{l.unit}</td>
                  <td className="px-3 py-2 text-right text-[#697386]">
                    {formatCFA(l.estimatedUnitPrice)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-[#0a2540]">
                    {formatCFA(l.estimatedAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#e0e6eb] bg-[#f6f9fc]">
                <td colSpan={4} className="px-3 py-2 text-right text-sm font-semibold text-[#0a2540]">
                  {t('common.total')}
                </td>
                <td className="px-3 py-2 text-right text-sm font-bold text-brand-gold">
                  {formatCFA(request.totalEstimatedAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Attachments */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#697386]">
          {t('demandeAchat.form.attachments')}
        </h2>

        {canManageAttachments && (
          <div className="flex items-center gap-2">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as PurchaseRequestDocumentType)}
              className="input h-9 w-56"
            >
              {DOCUMENT_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {t(`demandeAchat.documentType.${dt}`)}
                </option>
              ))}
            </select>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFiles(e.dataTransfer.files);
              }}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-sm transition-colors',
                dragOver ? 'border-brand-gold bg-brand-gold/5' : 'border-gray-300 text-gray-500',
              )}
            >
              <Upload className="h-4 w-4" />
              {t('demandeAchat.form.dropFiles')}
              <label className="cursor-pointer text-brand-gold hover:underline">
                {t('demandeAchat.form.browseFiles')}
                <input type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              </label>
            </div>
          </div>
        )}

        {request.attachments.length > 0 ? (
          <ul className="divide-y divide-[#e0e6eb]">
            {request.attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-2 py-2 text-sm">
                <Paperclip className="h-4 w-4 text-[#aab7c4]" />
                <button
                  type="button"
                  onClick={() => downloadAttachment(a.id, a.fileName)}
                  disabled={downloadingId === a.id}
                  className="text-[#0a2540] underline decoration-dotted hover:text-brand-gold disabled:opacity-50"
                >
                  {a.fileName}
                </button>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">
                  {t(`demandeAchat.documentType.${a.documentType}`)}
                </span>
                <span className="ml-auto text-xs text-[#aab7c4]">{formatDateTime(a.uploadedAt)}</span>
                <button
                  type="button"
                  onClick={() => downloadAttachment(a.id, a.fileName)}
                  disabled={downloadingId === a.id}
                  className="rounded-md p-1.5 text-[#697386] hover:bg-zinc-100 disabled:opacity-50"
                  title={t('common.download', 'Télécharger')}
                >
                  <Download className="h-4 w-4" />
                </button>
                {canManageAttachments && (
                  <button
                    type="button"
                    onClick={() => deleteAttachment.mutate(a.id, onErr)}
                    className="rounded-md p-1.5 text-[#697386] hover:bg-red-50 hover:text-red-600"
                    title={t('common.delete')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#aab7c4]">{t('demandeAchat.form.noAttachments')}</p>
        )}
      </div>

      {/* History timeline + comments */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#697386]">
          {t('demandeAchat.detail.history')}
        </h2>
        <div className="space-y-4">
          {request.history.length === 0 && (
            <p className="text-sm text-[#aab7c4]">{t('demandeAchat.detail.noHistory')}</p>
          )}
          {request.history.map((h) => {
            const Icon = HISTORY_ICON[h.action] || Clock;
            const isComment = h.action === 'COMMENT';
            return (
              <div key={h.id} className="flex gap-3">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    isComment ? 'bg-blue-100 text-blue-600' : 'bg-zinc-100 text-zinc-600',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#0a2540]">
                      {h.actorName || t('demandeAchat.detail.system')}
                    </p>
                    <span className="text-xs text-[#aab7c4]">{formatDateTime(h.createdAt)}</span>
                  </div>
                  <p className="text-xs text-[#697386]">
                    {t(`demandeAchat.history.${h.action}`)}
                    {h.toStatus && ` → ${t(`demandeAchat.status.${h.toStatus}`)}`}
                  </p>
                  {h.comment && (
                    <div className="mt-1 rounded-md bg-zinc-50 px-3 py-2 text-sm text-[#0a2540]">
                      {h.comment}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Comment box */}
        <div className="flex gap-2 border-t border-[#e0e6eb] pt-4">
          <input
            className="input"
            placeholder={t('demandeAchat.detail.commentPlaceholder')}
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
          />
          <button
            className="btn-secondary disabled:opacity-50"
            disabled={!commentInput.trim() || commentMutation.isPending}
            onClick={() => {
              commentMutation.mutate(
                { id: request.id, message: commentInput.trim() },
                { onSuccess: () => setCommentInput(''), ...onErr },
              );
            }}
          >
            <MessageSquare className="h-4 w-4" />
            {t('demandeAchat.detail.addComment')}
          </button>
        </div>
      </div>

      {/* ── Approve modal ── */}
      <ModalShell
        open={activeModal === 'approve'}
        onClose={closeModal}
        title={t('demandeAchat.actions.approve')}
        footer={
          <>
            <button className="btn-secondary" onClick={closeModal}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary bg-green-600 hover:bg-green-700 disabled:opacity-50"
              disabled={approveMutation.isPending}
              onClick={() =>
                approveMutation.mutate(
                  { id: request.id, comment: comment.trim() || undefined },
                  { onSuccess: closeModal, ...onErr },
                )
              }
            >
              <CheckCircle2 className="h-4 w-4" />
              {t('common.confirm')}
            </button>
          </>
        }
      >
        <label className="label">{t('demandeAchat.detail.commentOptional')}</label>
        <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
      </ModalShell>

      {/* ── Reject modal ── */}
      <ModalShell
        open={activeModal === 'reject'}
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
                rejectMutation.mutate({ id: request.id, motif: motif.trim() }, { onSuccess: closeModal, ...onErr })
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

      {/* ── Return modal ── */}
      <ModalShell
        open={activeModal === 'return'}
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
                returnMutation.mutate({ id: request.id, motif: motif.trim() }, { onSuccess: closeModal, ...onErr })
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

      {/* ── Cancel modal ── */}
      <ModalShell
        open={activeModal === 'cancel'}
        onClose={closeModal}
        title={t('demandeAchat.actions.cancel')}
        footer={
          <>
            <button className="btn-secondary" onClick={closeModal}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
              disabled={cancelMutation.isPending}
              onClick={() =>
                cancelMutation.mutate(
                  { id: request.id, reason: motif.trim() || undefined },
                  { onSuccess: closeModal, ...onErr },
                )
              }
            >
              <Ban className="h-4 w-4" />
              {t('common.confirm')}
            </button>
          </>
        }
      >
        <label className="label">{t('demandeAchat.detail.cancelReasonOptional')}</label>
        <textarea className="input" rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} />
      </ModalShell>

      {/* ── Process modal ── */}
      <ModalShell
        open={activeModal === 'process'}
        onClose={closeModal}
        title={t('demandeAchat.actions.process')}
        footer={
          <>
            <button className="btn-secondary" onClick={closeModal}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary disabled:opacity-50"
              disabled={processMutation.isPending}
              onClick={() =>
                processMutation.mutate(
                  {
                    id: request.id,
                    comment: comment.trim() || undefined,
                    additionalInfo: processFields.additionalInfo.trim() || undefined,
                    expectedDate: processFields.expectedDate || undefined,
                    observation: processFields.observation.trim() || undefined,
                  },
                  { onSuccess: closeModal, ...onErr },
                )
              }
            >
              <Wrench className="h-4 w-4" />
              {t('common.confirm')}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">{t('demandeAchat.detail.processComment')}</label>
            <textarea className="input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('demandeAchat.detail.additionalInfo')}</label>
            <textarea
              className="input"
              rows={2}
              value={processFields.additionalInfo}
              onChange={(e) => setProcessFields((p) => ({ ...p, additionalInfo: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">{t('demandeAchat.detail.expectedDate')}</label>
            <input
              type="date"
              className="input"
              value={processFields.expectedDate}
              onChange={(e) => setProcessFields((p) => ({ ...p, expectedDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">{t('demandeAchat.detail.observation')}</label>
            <textarea
              className="input"
              rows={2}
              value={processFields.observation}
              onChange={(e) => setProcessFields((p) => ({ ...p, observation: e.target.value }))}
            />
          </div>
        </div>
      </ModalShell>

      {/* ── Close modal ── */}
      <ModalShell
        open={activeModal === 'close'}
        onClose={closeModal}
        title={t('demandeAchat.actions.close')}
        footer={
          <>
            <button className="btn-secondary" onClick={closeModal}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary disabled:opacity-50"
              disabled={!comment.trim() || closeMutation.isPending}
              onClick={() =>
                closeMutation.mutate({ id: request.id, comment: comment.trim() }, { onSuccess: closeModal, ...onErr })
              }
            >
              <Lock className="h-4 w-4" />
              {t('common.confirm')}
            </button>
          </>
        }
      >
        <label className="label">{t('demandeAchat.detail.closeCommentRequired')}</label>
        <textarea className="input" rows={3} autoFocus value={comment} onChange={(e) => setComment(e.target.value)} />
      </ModalShell>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-[#697386]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#0a2540]">{value}</p>
    </div>
  );
}
