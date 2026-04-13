import { useState, useMemo, createElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  MessageSquare,
  User,
  Calendar,
  CreditCard,
  Search,
} from 'lucide-react';
import { Button, Badge, Card, CardContent, Modal, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui/DataTable';
import { useExpenses, useApproveExpense, useRejectExpense } from '@/hooks/useExpenses';
import { useAuthStore } from '@/stores/auth-store';
import { formatCFA, formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Expense, ExpenseStatus, ExpenseApproval } from '@/types/expense';

type TabFilter = 'pending' | 'approved' | 'rejected' | 'all';

const STATUS_CONFIG: Record<ExpenseStatus, { variant: 'outline' | 'warning' | 'info' | 'success' | 'destructive'; icon: typeof Clock }> = {
  DRAFT: { variant: 'outline', icon: Clock },
  PENDING: { variant: 'warning', icon: Clock },
  APPROVED_L1: { variant: 'info', icon: CheckCircle2 },
  APPROVED_L2: { variant: 'info', icon: CheckCircle2 },
  PAID: { variant: 'success', icon: CheckCircle2 },
  REJECTED: { variant: 'destructive', icon: XCircle },
  CANCELLED: { variant: 'destructive', icon: XCircle },
};

export default function ExpenseValidationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const approveMutation = useApproveExpense();
  const rejectMutation = useRejectExpense();

  const [activeTab, setActiveTab] = useState<TabFilter>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [approveComment, setApproveComment] = useState('');
  const [approveModalOpen, setApproveModalOpen] = useState(false);

  // Fetch all PENDING expenses for validation
  const { data: pendingData, isLoading: pendingLoading } = useExpenses({ status: 'PENDING', perPage: 100 });
  // Fetch recently approved/rejected for the history tabs
  const { data: approvedData } = useExpenses({ status: ['APPROVED_L1', 'APPROVED_L2', 'PAID'], perPage: 50 });
  const { data: rejectedData } = useExpenses({ status: 'REJECTED', perPage: 50 });

  // Filter expenses that are at the user's validation level
  const pendingExpenses = useMemo(() => {
    if (!pendingData?.data || !user) return [];
    return pendingData.data.filter((exp) => {
      // Find the next pending approval for this expense
      const nextPending = exp.approvals?.find((a) => a.status === 'PENDING');
      if (!nextPending) return false;
      // Show expenses where the current user is the next approver
      return nextPending.approverId === user.id;
    });
  }, [pendingData, user]);

  const approvedExpenses = useMemo(() => approvedData?.data ?? [], [approvedData]);
  const rejectedExpenses = useMemo(() => rejectedData?.data ?? [], [rejectedData]);

  // Active list based on tab
  const activeList = useMemo(() => {
    let list: Expense[] = [];
    switch (activeTab) {
      case 'pending': list = pendingExpenses; break;
      case 'approved': list = approvedExpenses; break;
      case 'rejected': list = rejectedExpenses; break;
      case 'all': list = [...pendingExpenses, ...approvedExpenses, ...rejectedExpenses]; break;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.reference.toLowerCase().includes(q) ||
          e.beneficiary?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.categoryName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [activeTab, pendingExpenses, approvedExpenses, rejectedExpenses, searchQuery]);

  // Actions
  const handleApprove = () => {
    if (!selectedExpense) return;
    approveMutation.mutate(
      { id: selectedExpense.id, comment: approveComment.trim() || undefined },
      {
        onSuccess: () => {
          setApproveModalOpen(false);
          setApproveComment('');
          setSelectedExpense(null);
          setDetailModalOpen(false);
        },
      },
    );
  };

  const handleReject = () => {
    if (!selectedExpense || !rejectComment.trim()) return;
    rejectMutation.mutate(
      { id: selectedExpense.id, comment: rejectComment.trim() },
      {
        onSuccess: () => {
          setRejectModalOpen(false);
          setRejectComment('');
          setSelectedExpense(null);
          setDetailModalOpen(false);
        },
      },
    );
  };

  const openDetail = (expense: Expense) => {
    setSelectedExpense(expense);
    setDetailModalOpen(true);
  };

  // Get the current user's pending approval level for an expense
  const getUserApprovalLevel = (expense: Expense): ExpenseApproval | undefined => {
    return expense.approvals?.find((a) => a.status === 'PENDING' && a.approverId === user?.id);
  };

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: 'pending', label: t('validation.tabs.pending'), count: pendingExpenses.length },
    { key: 'approved', label: t('validation.tabs.approved'), count: approvedExpenses.length },
    { key: 'rejected', label: t('validation.tabs.rejected'), count: rejectedExpenses.length },
    { key: 'all', label: t('validation.tabs.all'), count: pendingExpenses.length + approvedExpenses.length + rejectedExpenses.length },
  ];

  // DataTable columns
  const columns: Column<Expense & Record<string, unknown>>[] = [
    {
      key: 'reference',
      header: t('expenses.reference'),
      sortable: true,
      render: (row: Expense & Record<string, unknown>) => (
        <span className="font-mono text-sm font-medium text-gray-900">{row.reference}</span>
      ),
    },
    {
      key: 'date',
      header: t('common.date'),
      sortable: true,
      render: (row: Expense & Record<string, unknown>) => <span className="text-sm text-gray-600">{formatDate(row.date)}</span>,
    },
    {
      key: 'beneficiary',
      header: t('expenses.beneficiary'),
      render: (row: Expense & Record<string, unknown>) => (
        <div>
          <p className="text-sm font-medium text-gray-700">{row.beneficiary || '—'}</p>
          <p className="text-xs text-gray-400">{row.categoryName}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: t('common.amount'),
      sortable: true,
      render: (row: Expense & Record<string, unknown>) => (
        <span className="text-sm font-bold text-gray-900">{formatCFA(row.amount)}</span>
      ),
    },
    {
      key: 'level',
      header: t('validation.level'),
      render: (row: Expense & Record<string, unknown>) => {
        const nextPending = row.approvals?.find((a: ExpenseApproval) => a.status === 'PENDING');
        if (!nextPending) return <span className="text-xs text-gray-400">—</span>;
        return (
          <Badge variant="outline" className="text-xs">
            N{nextPending.level}
          </Badge>
        );
      },
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row: Expense & Record<string, unknown>) => {
        const cfg = STATUS_CONFIG[row.status as ExpenseStatus];
        const Icon = cfg.icon;
        return (
          <Badge variant={cfg.variant} className="gap-1">
            <Icon className="h-3 w-3" />
            {t(`expenses.status${row.status.charAt(0) + (row.status as string).slice(1).toLowerCase()}`)}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row: Expense & Record<string, unknown>) => {
        const isPending = row.status === 'PENDING';
        const myLevel = getUserApprovalLevel(row as Expense);
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); openDetail(row as Expense); }}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title={t('validation.viewDetail')}
            >
              <Eye className="h-4 w-4" />
            </button>
            {isPending && myLevel && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedExpense(row as Expense);
                    setApproveModalOpen(true);
                  }}
                  className="rounded-md p-1.5 text-green-500 hover:bg-green-50 hover:text-green-700"
                  title={t('expenses.approve')}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedExpense(row as Expense);
                    setRejectModalOpen(true);
                  }}
                  className="rounded-md p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700"
                  title={t('expenses.reject')}
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('validation.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('validation.subtitle')}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('validation.kpi.pending')}</p>
              <p className="text-2xl font-bold text-gray-900">{pendingExpenses.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('validation.kpi.approved')}</p>
              <p className="text-2xl font-bold text-gray-900">{approvedExpenses.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('validation.kpi.rejected')}</p>
              <p className="text-2xl font-bold text-gray-900">{rejectedExpenses.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Search */}
      <Card>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Tabs */}
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    activeTab === tab.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-xs',
                      activeTab === tab.key ? 'bg-brand-gold/10 text-brand-gold' : 'bg-gray-200 text-gray-500',
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('expenses.searchPlaceholder')}
                className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold sm:w-64"
              />
            </div>
          </div>

          {/* Table */}
          {pendingLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={activeList as (Expense & Record<string, unknown>)[]}
              pageSize={10}
              emptyMessage={t('validation.noExpenses')}
              onRowClick={(row) => openDetail(row as Expense)}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Detail Modal ──────────────────── */}
      <Modal
        open={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setSelectedExpense(null); }}
        title={selectedExpense?.reference ?? ''}
        size="lg"
        footer={
          selectedExpense?.status === 'PENDING' && getUserApprovalLevel(selectedExpense) ? (
            <div className="flex w-full items-center justify-between">
              <Button
                variant="destructive"
                onClick={() => setRejectModalOpen(true)}
              >
                <XCircle className="h-4 w-4" />
                {t('expenses.reject')}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/expenses/${selectedExpense.id}`)}
                >
                  <Eye className="h-4 w-4" />
                  {t('validation.viewFull')}
                </Button>
                <Button
                  onClick={() => setApproveModalOpen(true)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t('expenses.approve')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => { setDetailModalOpen(false); setSelectedExpense(null); }}>
              {t('common.close')}
            </Button>
          )
        }
      >
        {selectedExpense && (
          <div className="space-y-5">
            {/* Status Badge */}
            <div className="flex items-center gap-3">
              <Badge variant={STATUS_CONFIG[selectedExpense.status].variant} className="gap-1">
                {createElement(STATUS_CONFIG[selectedExpense.status].icon, { className: 'h-3 w-3' })}
                {t(`expenses.status${selectedExpense.status.charAt(0) + selectedExpense.status.slice(1).toLowerCase()}`)}
              </Badge>
              <span className="text-xs text-gray-400">
                {t('expenses.createdBy')} {selectedExpense.createdByName}
              </span>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <Calendar className="h-3.5 w-3.5" />
                  {t('common.date')}
                </p>
                <p className="mt-1 text-sm font-medium text-gray-700">{formatDate(selectedExpense.date)}</p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <CreditCard className="h-3.5 w-3.5" />
                  {t('common.amount')}
                </p>
                <p className="mt-1 text-lg font-bold text-gray-900">{formatCFA(selectedExpense.amount)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">{t('expenses.category')}</p>
                <p className="mt-1 text-sm font-medium text-gray-700">{selectedExpense.categoryName}</p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <User className="h-3.5 w-3.5" />
                  {t('expenses.beneficiary')}
                </p>
                <p className="mt-1 text-sm font-medium text-gray-700">{selectedExpense.beneficiary || '—'}</p>
              </div>
            </div>

            {selectedExpense.description && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-500">{t('expenses.description')}</p>
                <p className="mt-1 text-sm text-gray-700">{selectedExpense.description}</p>
              </div>
            )}

            {selectedExpense.observations && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-500">{t('expenses.observations')}</p>
                <p className="mt-1 text-sm text-gray-700">{selectedExpense.observations}</p>
              </div>
            )}

            {/* Workflow / Approvals */}
            {selectedExpense.approvals && selectedExpense.approvals.length > 0 && (
              <div className="border-t border-gray-100 pt-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t('validation.workflowProgress')}
                </p>
                <div className="space-y-3">
                  {selectedExpense.approvals.map((appr) => (
                    <div key={appr.id} className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          appr.status === 'APPROVED' && 'bg-green-100 text-green-600',
                          appr.status === 'REJECTED' && 'bg-red-100 text-red-600',
                          appr.status === 'PENDING' && 'bg-amber-100 text-amber-600',
                        )}
                      >
                        {appr.status === 'APPROVED' ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : appr.status === 'REJECTED' ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-700">{appr.approverName}</p>
                          <Badge variant="outline" className="text-[10px]">N{appr.level}</Badge>
                          {appr.status === 'PENDING' && appr.approverId === user?.id && (
                            <Badge variant="warning" className="text-[10px]">{t('validation.yourTurn')}</Badge>
                          )}
                        </div>
                        {appr.approvedAt && (
                          <p className="text-xs text-gray-400">{formatDateTime(appr.approvedAt)}</p>
                        )}
                        {appr.comment && (
                          <div className="mt-1 flex gap-1.5 rounded-md bg-gray-50 px-2 py-1.5">
                            <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" />
                            <p className="text-xs text-gray-600">{appr.comment}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Approve Modal ─────────────────── */}
      <Modal
        open={approveModalOpen}
        onClose={() => { setApproveModalOpen(false); setApproveComment(''); }}
        title={t('validation.approveTitle')}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => { setApproveModalOpen(false); setApproveComment(''); }}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleApprove}
              loading={approveMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
              {t('validation.confirmApprove')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {selectedExpense && (
            <div className="rounded-lg bg-green-50 p-3">
              <p className="text-sm text-green-800">
                {t('validation.approveConfirmText', {
                  reference: selectedExpense.reference,
                  amount: formatCFA(selectedExpense.amount),
                })}
              </p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700">{t('validation.commentOptional')}</label>
            <textarea
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              rows={3}
              placeholder={t('validation.approveCommentPlaceholder')}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
            />
          </div>
        </div>
      </Modal>

      {/* ── Reject Modal ──────────────────── */}
      <Modal
        open={rejectModalOpen}
        onClose={() => { setRejectModalOpen(false); setRejectComment(''); }}
        title={t('validation.rejectTitle')}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => { setRejectModalOpen(false); setRejectComment(''); }}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              loading={rejectMutation.isPending}
              disabled={!rejectComment.trim()}
            >
              <XCircle className="h-4 w-4" />
              {t('validation.confirmReject')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {selectedExpense && (
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-sm text-red-800">
                {t('validation.rejectConfirmText', {
                  reference: selectedExpense.reference,
                  amount: formatCFA(selectedExpense.amount),
                })}
              </p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700">{t('validation.commentRequired')}</label>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={4}
              placeholder={t('validation.rejectCommentPlaceholder')}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
