import { useState } from 'react';
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
} from 'lucide-react';
import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Modal } from '@/components/ui';
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
const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: 'outline' | 'warning' | 'info' | 'success' | 'destructive';
    icon: typeof Clock;
  }
> = {
  DRAFT: { label: 'Brouillon', variant: 'outline', icon: Clock },
  PENDING: { label: 'En attente', variant: 'warning', icon: Clock },
  APPROVED: { label: 'Approuvée', variant: 'info', icon: CheckCircle2 },
  APPROVED_L1: { label: 'Approuvée N1', variant: 'info', icon: CheckCircle2 },
  APPROVED_L2: { label: 'Approuvée N2', variant: 'info', icon: CheckCircle2 },
  PAID: { label: 'Payée', variant: 'success', icon: Banknote },
  REJECTED: { label: 'Rejetée', variant: 'destructive', icon: XCircle },
  CANCELLED: { label: 'Annulée', variant: 'destructive', icon: XCircle },
};

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
        <Button variant="outline" size="sm" onClick={() => navigate('/expenses')}>
          {t('common.back')}
        </Button>
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
              <Badge variant={statusCfg.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {statusCfg.label}
              </Badge>
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
            <Button
              onClick={handleSubmit}
              loading={submitMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <Send className="h-4 w-4" />
              {t('expenses.submit')}
            </Button>
          )}
          {canApprove && (
            <Button onClick={handleApprove} loading={approveMutation.isPending}>
              <CheckCircle2 className="h-4 w-4" />
              {t('expenses.approve')}
            </Button>
          )}
          {canReject && (
            <Button
              variant="destructive"
              onClick={() => setRejectModalOpen(true)}
              loading={rejectMutation.isPending}
            >
              <XCircle className="h-4 w-4" />
              {t('expenses.reject')}
            </Button>
          )}
          {canPay && (
            <Button onClick={handlePay} loading={payMutation.isPending}>
              <Banknote className="h-4 w-4" />
              {t('expenses.markPaid')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Main info ──────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Details card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('expenses.details')}</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* Attachments */}
          {expense.attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {t('expenses.attachments')} ({expense.attachments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}

          {/* AI Anomaly score */}
          {expense.aiAnomalyScore != null && expense.aiAnomalyScore > 0.5 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <Sparkles className="h-4 w-4" />
                  {t('expenses.aiAnomalyTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Sidebar: Timeline + Approvals ─ */}
        <div className="space-y-6">
          {/* Workflow Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>{t('expenses.workflowTimeline')}</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkflowTimeline expense={expense} approvals={expense.approvals} />
            </CardContent>
          </Card>

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
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="py-3">
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
                </CardContent>
              </Card>
            ) : null;
          })()}

          {/* Approval History */}
          <Card>
            <CardHeader>
              <CardTitle>{t('expenses.approvalHistory')}</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Reject modal ──────────────────── */}
      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title={t('expenses.rejectExpense')}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              loading={rejectMutation.isPending}
              disabled={!rejectComment.trim()}
            >
              {t('expenses.confirmReject')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{t('expenses.rejectReason')}</p>
          <textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={4}
            placeholder={t('expenses.rejectCommentPlaceholder')}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
            autoFocus
          />
        </div>
      </Modal>

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
  const steps: { label: string; status: ExpenseStatus; date?: string }[] = [
    { label: t('expenses.statusDraft'), status: 'DRAFT' },
    { label: t('expenses.statusPending'), status: 'PENDING' },
    { label: t('expenses.statusApproved'), status: 'APPROVED' },
    { label: t('expenses.statusPaid'), status: 'PAID' },
  ];

  const statusOrder: ExpenseStatus[] = ['DRAFT', 'PENDING', 'APPROVED', 'PAID'];
  const currentIndex = statusOrder.indexOf(expense.status);
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

const DR_STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'outline' | 'warning' | 'info' | 'success' | 'destructive' }
> = {
  PENDING: { label: 'En attente', variant: 'warning' },
  APPROVED: { label: 'Approuvée', variant: 'info' },
  REJECTED: { label: 'Rejetée', variant: 'destructive' },
  PROCESSED: { label: 'Traitée', variant: 'success' },
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
    <Modal open={open} onClose={onClose} title="Demande de décaissement" size="lg">
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
            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
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
    </Modal>
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
