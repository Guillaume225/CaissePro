import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Banknote,
  AlertTriangle,
  FileText,
  Download,
  MessageSquare,
  User,
  Calendar,
  CreditCard,
  Sparkles,
  Link2,
  Send,
  X,
} from 'lucide-react';
import {
  useExpense,
  useApproveExpense,
  useRejectExpense,
  usePayExpense,
  useSubmitExpense,
} from '@/hooks/useExpenses';
import { useDisbursementRequest } from '@/hooks/useDisbursementRequests';
import { useAuthStore } from '@/stores/auth-store';
import { formatCFA, formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ExpenseStatus, ExpenseApproval } from '@/types/expense';

// ── Status config ────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; classes: string; icon: typeof Clock }> = {
  DRAFT: { label: 'Brouillon', classes: 'border border-zinc-300 text-zinc-600', icon: Clock },
  PENDING: { label: 'En attente', classes: 'bg-amber-50 text-amber-800', icon: Clock },
  APPROVED: { label: 'Approuvée', classes: 'bg-[#eff6ff] text-[#1e40af]', icon: CheckCircle2 },
  APPROVED_L1: { label: 'Approuvée N1', classes: 'bg-[#eff6ff] text-[#1e40af]', icon: CheckCircle2 },
  APPROVED_L2: { label: 'Approuvée N2', classes: 'bg-[#eff6ff] text-[#1e40af]', icon: CheckCircle2 },
  PAID: { label: 'Payée', classes: 'bg-[#dcfce7] text-[#166534]', icon: Banknote },
  REJECTED: { label: 'Rejetée', classes: 'bg-[#fee2e2] text-[#991b1b]', icon: XCircle },
  CANCELLED: { label: 'Annulée', classes: 'bg-[#fee2e2] text-[#991b1b]', icon: XCircle },
};

function ModalShell({
  open,
  onClose,
  title,
  size = 'md',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg';
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
      <div
        className={`relative w-full rounded-md bg-white shadow-2xl ${size === 'lg' ? 'max-w-2xl' : 'max-w-md'}`}
      >
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

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  CHECK: 'Chèque',
  TRANSFER: 'Virement',
  MOBILE_MONEY: 'Mobile Money',
};

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasRole } = useAuthStore();

  const { data: expense, isLoading, isError } = useExpense(id!);
  const approveMutation = useApproveExpense();
  const rejectMutation = useRejectExpense();
  const payMutation = usePayExpense();
  const submitMutation = useSubmitExpense();

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [disbursementModalOpen, setDisbursementModalOpen] = useState(false);

  // ── Role-based actions ─────────────────────
  const canApprove = expense?.status === 'PENDING' && hasRole('manager');
  const canReject = expense?.status === 'PENDING' && hasRole('manager');
  const canPay = expense?.status === 'APPROVED_L2';
  const canSubmit = expense?.status === 'DRAFT';

  const handleApprove = () => {
    if (!id) return;
    approveMutation.mutate({ id });
  };

  const handleReject = () => {
    if (!id || !rejectComment.trim()) return;
    rejectMutation.mutate(
      { id, comment: rejectComment.trim() },
      {
        onSuccess: () => {
          setRejectModalOpen(false);
          setRejectComment('');
        },
      },
    );
  };

  const handlePay = () => {
    if (!id) return;
    payMutation.mutate(id);
  };

  const handleSubmit = () => {
    if (!id) return;
    submitMutation.mutate(id);
  };

  // ── Loading / Error states ─────────────────
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  if (isError || !expense) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-500">{t('common.error')}</p>
        <button className="btn-secondary" onClick={() => navigate('/expenses')}>
          {t('common.back')}
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[expense.status];
  const StatusIcon = statusCfg.icon;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ── Header ────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/expenses')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{expense.reference}</h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.classes}`}
              >
                <StatusIcon className="h-3 w-3" />
                {statusCfg.label}
              </span>
              {expense.currentApprovalLevel && (
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                  Niveau {expense.currentApprovalLevel}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-gray-500">
              {t('expenses.createdBy')} {expense.createdByName} ·{' '}
              {formatDateTime(expense.createdAt)}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {canSubmit && (
            <button
              className="btn-primary bg-green-600 hover:bg-green-700 disabled:opacity-50"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              <Send className="h-4 w-4" />
              {t('expenses.submit')}
            </button>
          )}
          {canApprove && (
            <button
              className="btn-primary disabled:opacity-50"
              onClick={handleApprove}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              <CheckCircle2 className="h-4 w-4" />
              {t('expenses.approve')}
            </button>
          )}
          {canReject && (
            <button
              className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
              onClick={() => setRejectModalOpen(true)}
              disabled={rejectMutation.isPending}
            >
              <XCircle className="h-4 w-4" />
              {t('expenses.reject')}
            </button>
          )}
          {canPay && (
            <button
              className="btn-primary disabled:opacity-50"
              onClick={handlePay}
              disabled={payMutation.isPending}
            >
              {payMutation.isPending && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              <Banknote className="h-4 w-4" />
              {t('expenses.markPaid')}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Main info ──────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Details card */}
          <div className="card">
            <h3 className="mb-4 text-base font-semibold text-[#0a2540]">{t('expenses.details')}</h3>
            <div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                <DetailItem
                  icon={Calendar}
                  label={t('common.date')}
                  value={formatDate(expense.date)}
                />
                <DetailItem
                  icon={CreditCard}
                  label={t('common.amount')}
                  value={formatCFA(expense.amount)}
                  highlight
                />
                <DetailItem label={t('expenses.category')} value={expense.categoryName} />
                <DetailItem
                  label={t('expenses.paymentMethod')}
                  value={PAYMENT_LABELS[expense.paymentMethod] ?? expense.paymentMethod}
                />
                <DetailItem
                  icon={User}
                  label={t('expenses.beneficiary')}
                  value={expense.beneficiary || '—'}
                />
                <DetailItem label={t('expenses.reference')} value={expense.reference} />
              </dl>

              {expense.description && (
                <div className="mt-5 border-t border-gray-100 pt-4">
                  <p className="text-xs font-medium text-gray-500">{t('expenses.description')}</p>
                  <p className="mt-1 text-sm text-gray-700">{expense.description}</p>
                </div>
              )}

              {expense.observations && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-xs font-medium text-gray-500">{t('expenses.observations')}</p>
                  <p className="mt-1 text-sm text-gray-700">{expense.observations}</p>
                </div>
              )}

              {expense.disbursementRequestId && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <button
                    onClick={() => setDisbursementModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
                  >
                    <Link2 className="h-4 w-4" />
                    {t('expenses.viewLinkedRequest')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Attachments */}
          {expense.attachments.length > 0 && (
            <div className="card">
              <h3 className="mb-4 text-base font-semibold text-[#0a2540]">
                {t('expenses.attachments')} ({expense.attachments.length})
              </h3>
              <div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {expense.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 transition-colors hover:border-brand-gold"
                    >
                      <div className="flex h-24 items-center justify-center bg-gray-50">
                        {att.fileType.startsWith('image/') ? (
                          <img
                            src={att.filePath}
                            alt={att.originalFilename}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <FileText className="h-8 w-8 text-gray-300" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 p-2">
                        <span className="flex-1 truncate text-xs font-medium text-gray-700">
                          {att.originalFilename}
                        </span>
                        <Download className="h-3.5 w-3.5 shrink-0 text-gray-400 group-hover:text-brand-gold" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AI Anomaly score */}
          {expense.aiAnomalyScore != null && expense.aiAnomalyScore > 0.5 && (
            <div className="card border-amber-200 bg-amber-50/50">
              <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-amber-800">
                <Sparkles className="h-4 w-4" />
                {t('expenses.aiAnomalyTitle')}
              </h3>
              <div>
                <div className="flex items-center gap-3">
                  <div className="h-2.5 flex-1 rounded-full bg-amber-200">
                    <div
                      className={cn(
                        'h-2.5 rounded-full transition-all',
                        expense.aiAnomalyScore > 0.8 ? 'bg-red-500' : 'bg-amber-500',
                      )}
                      style={{ width: `${expense.aiAnomalyScore * 100}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold text-amber-700">
                    {Math.round(expense.aiAnomalyScore * 100)}%
                  </span>
                </div>
                {expense.aiAnomalyReasons && expense.aiAnomalyReasons.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {expense.aiAnomalyReasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar: Timeline + Approvals ─ */}
        <div className="space-y-6">
          {/* Workflow Timeline */}
          <div className="card">
            <h3 className="mb-4 text-base font-semibold text-[#0a2540]">
              {t('expenses.workflowTimeline')}
            </h3>
            <div>
              <WorkflowTimeline expense={expense} approvals={expense.approvals} />
            </div>
          </div>

          {/* Next validator */}
          {(() => {
            const pending = expense.approvals.find((a) => a.status === 'PENDING');
            // Determine next validator info even when no approval record exists yet
            let nextName: string | null = null;
            let nextLevel: number | null = null;
            if (pending) {
              nextName = pending.approverName;
              nextLevel = pending.level;
            } else if (expense.status === 'PENDING' && expense.approvals.length === 0) {
              nextName = 'Responsable département';
              nextLevel = 1;
            } else if (
              expense.status === 'APPROVED_L1' &&
              !expense.approvals.find((a) => a.status === 'PENDING')
            ) {
              nextName = 'Directeur financier';
              nextLevel = 2;
            }
            return nextName ? (
              <div className="card border-amber-200 bg-amber-50/50 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-amber-600">
                        {t('expenses.nextValidator')}
                      </p>
                      <p className="text-sm font-semibold text-amber-800">
                        {nextName}
                        <span className="ml-1.5 text-xs font-normal text-amber-500">
                          Niveau {nextLevel}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null;
          })()}

          {/* Approval History */}
          <div className="card">
            <h3 className="mb-4 text-base font-semibold text-[#0a2540]">
              {t('expenses.approvalHistory')}
            </h3>
            <div>
              {expense.approvals.length > 0 ? (
                <div className="space-y-4">
                  {expense.approvals.map((appr) => (
                    <ApprovalItem key={appr.id} approval={appr} />
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-gray-400">
                  Aucune validation pour le moment
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Reject modal ──────────────────── */}
      <ModalShell
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title={t('expenses.rejectExpense')}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{t('expenses.rejectReason')}</p>
          <textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={4}
            placeholder={t('expenses.rejectCommentPlaceholder')}
            className="input"
            autoFocus
          />
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setRejectModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
              onClick={handleReject}
              disabled={!rejectComment.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {t('expenses.confirmReject')}
            </button>
          </div>
        </div>
      </ModalShell>

      {/* ── Disbursement Request modal ────── */}
      {expense.disbursementRequestId && (
        <DisbursementRequestModal
          open={disbursementModalOpen}
          onClose={() => setDisbursementModalOpen(false)}
          requestId={expense.disbursementRequestId}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────

function DetailItem({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon?: typeof Calendar;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 text-sm',
          highlight ? 'text-lg font-bold text-gray-900' : 'font-medium text-gray-700',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function WorkflowTimeline({
  expense,
  approvals = [],
}: {
  expense: { status: ExpenseStatus; createdAt: string; updatedAt: string };
  approvals?: ExpenseApproval[];
}) {
  const { t } = useTranslation();
  const nextApproval = approvals.find((a) => a.status === 'PENDING');
  type TimelineStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'PAID';
  const steps: { label: string; status: TimelineStatus; date?: string }[] = [
    { label: t('expenses.statusDraft'), status: 'DRAFT' },
    { label: t('expenses.statusPending'), status: 'PENDING' },
    { label: t('expenses.statusApproved'), status: 'APPROVED' },
    { label: t('expenses.statusPaid'), status: 'PAID' },
  ];

  // APPROVED_L1/APPROVED_L2 both collapse to the single "Approved" timeline step.
  const displayStatus: TimelineStatus =
    expense.status === 'APPROVED_L1' || expense.status === 'APPROVED_L2'
      ? 'APPROVED'
      : (expense.status as TimelineStatus);
  const statusOrder: TimelineStatus[] = ['DRAFT', 'PENDING', 'APPROVED', 'PAID'];
  const currentIndex = statusOrder.indexOf(displayStatus);
  const isRejected = expense.status === 'REJECTED';

  return (
    <div className="relative space-y-0">
      {steps.map((step, i) => {
        const isCompleted = !isRejected && i <= currentIndex;
        const isCurrent = !isRejected && i === currentIndex;

        return (
          <div key={step.status} className="relative flex gap-3 pb-6 last:pb-0">
            {/* Vertical line */}
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'absolute left-[11px] top-6 h-full w-0.5',
                  isCompleted && i < currentIndex ? 'bg-green-300' : 'bg-gray-200',
                )}
              />
            )}
            {/* Dot */}
            <div
              className={cn(
                'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                isCurrent && 'bg-brand-gold text-white',
                isCompleted && !isCurrent && 'bg-green-500 text-white',
                !isCompleted && 'bg-gray-200 text-gray-400',
              )}
            >
              {isCompleted && !isCurrent ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <span className="text-[10px] font-bold">{i + 1}</span>
              )}
            </div>
            {/* Text */}
            <div>
              <p
                className={cn(
                  'text-sm font-medium',
                  isCurrent ? 'text-gray-900' : isCompleted ? 'text-green-700' : 'text-gray-400',
                )}
              >
                {step.label}
              </p>
              {isCurrent && nextApproval && (
                <div className="mt-1 flex items-center gap-1.5">
                  <User className="h-3 w-3 text-brand-gold" />
                  <p className="text-xs text-gray-500">
                    {t('expenses.nextValidator')}:{' '}
                    <span className="font-medium text-gray-700">{nextApproval.approverName}</span>
                    <span className="ml-1 text-gray-400">N{nextApproval.level}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {isRejected && (
        <div className="relative flex gap-3">
          <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
            <XCircle className="h-3.5 w-3.5" />
          </div>
          <p className="text-sm font-medium text-red-600">{t('expenses.statusRejected')}</p>
        </div>
      )}
    </div>
  );
}

function ApprovalItem({ approval }: { approval: ExpenseApproval }) {
  const isApproved = approval.status === 'APPROVED';
  const isRejected = approval.status === 'REJECTED';

  return (
    <div className="flex gap-3">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isApproved && 'bg-green-100 text-green-600',
          isRejected && 'bg-red-100 text-red-600',
          !isApproved && !isRejected && 'bg-gray-100 text-gray-400',
        )}
      >
        {isApproved ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : isRejected ? (
          <XCircle className="h-4 w-4" />
        ) : (
          <Clock className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700">
          {approval.approverName}
          <span className="ml-1.5 text-xs text-gray-400">N{approval.level}</span>
        </p>
        {approval.approvedAt && (
          <p className="text-xs text-gray-400">{formatDateTime(approval.approvedAt)}</p>
        )}
        {approval.comment && (
          <div className="mt-1.5 flex gap-1.5 rounded-md bg-gray-50 px-3 py-2">
            <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" />
            <p className="text-xs text-gray-600">{approval.comment}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Disbursement Request Modal ─────────────────────────

const DR_STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  PENDING: { label: 'En attente', classes: 'bg-amber-50 text-amber-800' },
  APPROVED: { label: 'Approuvée', classes: 'bg-[#eff6ff] text-[#1e40af]' },
  REJECTED: { label: 'Rejetée', classes: 'bg-[#fee2e2] text-[#991b1b]' },
  PROCESSED: { label: 'Traitée', classes: 'bg-[#dcfce7] text-[#166534]' },
};

function DisbursementRequestModal({
  open,
  onClose,
  requestId,
}: {
  open: boolean;
  onClose: () => void;
  requestId: string;
}) {
  useTranslation();
  const { data: dr, isLoading } = useDisbursementRequest(open ? requestId : null);

  const statusCfg = dr
    ? (DR_STATUS_CONFIG[dr.status] ?? DR_STATUS_CONFIG.PENDING)
    : DR_STATUS_CONFIG.PENDING;

  return (
    <ModalShell open={open} onClose={onClose} title="Demande de décaissement" size="lg">
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
        </div>
      ) : !dr ? (
        <p className="py-8 text-center text-sm text-gray-500">Demande introuvable</p>
      ) : (
        <div className="space-y-5">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-gray-900">{dr.reference}</p>
              <p className="text-xs text-gray-500">{formatDateTime(dr.createdAt)}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.classes}`}>
              {statusCfg.label}
            </span>
          </div>

          {/* Amount */}
          <div className="rounded-lg bg-amber-50 px-4 py-3 text-center">
            <p className="text-xs font-medium text-amber-600">Montant demandé</p>
            <p className="text-2xl font-bold text-amber-800">{formatCFA(dr.amount)}</p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <DRField label="Nom" value={`${dr.lastName} ${dr.firstName}`} />
            <DRField label="Poste" value={dr.position} />
            <DRField label="Service" value={dr.service} />
            <DRField label="Matricule" value={dr.matricule} />
            <DRField label="Téléphone" value={dr.phone} />
            <DRField label="Email" value={dr.email} />
          </div>

          {/* Reason */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500">Motif de la demande</p>
            <p className="mt-1 text-sm text-gray-700">{dr.reason}</p>
          </div>

          {/* Comment if any */}
          {dr.comment && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500">Commentaire</p>
              <div className="mt-1 flex gap-1.5 rounded-md bg-gray-50 px-3 py-2">
                <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" />
                <p className="text-sm text-gray-600">{dr.comment}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}

function DRField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-700">{value || '—'}</p>
    </div>
  );
}
