import { useState, useMemo, useEffect, createElement } from 'react';
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
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useExpenses, useApproveExpense, useRejectExpense } from '@/hooks/useExpenses';
import { useAuthStore } from '@/stores/auth-store';
import { formatCFA, formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Expense, ExpenseStatus, ExpenseApproval } from '@/types/expense';

type TabFilter = 'pending' | 'approved' | 'rejected' | 'all';

const STATUS_CONFIG: Record<ExpenseStatus, { classes: string; icon: typeof Clock }> = {
  DRAFT: { classes: 'border border-zinc-300 text-zinc-600', icon: Clock },
  PENDING: { classes: 'bg-amber-50 text-amber-800', icon: Clock },
  APPROVED_L1: { classes: 'bg-[#eff6ff] text-[#1e40af]', icon: CheckCircle2 },
  APPROVED_L2: { classes: 'bg-[#eff6ff] text-[#1e40af]', icon: CheckCircle2 },
  PAID: { classes: 'bg-[#dcfce7] text-[#166534]', icon: CheckCircle2 },
  REJECTED: { classes: 'bg-[#fee2e2] text-[#991b1b]', icon: XCircle },
  CANCELLED: { classes: 'bg-[#fee2e2] text-[#991b1b]', icon: XCircle },
};

const PAGE_SIZE = 10;

function ModalShell({
  open,
  onClose,
  title,
  size = 'md',
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg';
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

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' | null }) {
  if (!active || !dir) return <ArrowUpDown className="h-3 w-3 text-[#aab7c4]" />;
  return dir === 'asc' ? (
    <ArrowUp className="h-3 w-3 text-[#0a2540]" />
  ) : (
    <ArrowDown className="h-3 w-3 text-[#0a2540]" />
  );
}

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
  const [sortKey, setSortKey] = useState<'reference' | 'date' | 'amount' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [page, setPage] = useState(1);

  const { data: pendingData, isLoading: pendingLoading } = useExpenses({
    status: 'PENDING',
    perPage: 100,
  });
  const { data: awaitingL2Data } = useExpenses({
    status: 'APPROVED_L1',
    perPage: 100,
  });
  const { data: approvedData } = useExpenses({
    status: ['APPROVED_L2', 'PAID'],
    perPage: 50,
  });
  const { data: rejectedData } = useExpenses({ status: 'REJECTED', perPage: 50 });

  const pendingExpenses = useMemo(() => {
    if (!user) return [];
    const results: Expense[] = [];
    for (const exp of pendingData?.data ?? []) {
      if (exp.createdById === user.id) continue;
      if (exp.approvals && exp.approvals.length > 0) {
        const myPending = exp.approvals.find(
          (a) => a.status === 'PENDING' && a.approverId === user.id,
        );
        if (myPending) results.push(exp);
      }
    }
    if (user.permissions.includes('expense.approve_l2') || user.role === 'admin') {
      for (const exp of awaitingL2Data?.data ?? []) {
        if (exp.createdById === user.id) continue;
        results.push(exp);
      }
    }
    return results;
  }, [pendingData, awaitingL2Data, user]);

  const approvedExpenses = useMemo(() => approvedData?.data ?? [], [approvedData]);
  const rejectedExpenses = useMemo(() => rejectedData?.data ?? [], [rejectedData]);

  const activeList = useMemo(() => {
    let list: Expense[] = [];
    switch (activeTab) {
      case 'pending':
        list = pendingExpenses;
        break;
      case 'approved':
        list = approvedExpenses;
        break;
      case 'rejected':
        list = rejectedExpenses;
        break;
      case 'all':
        list = [...pendingExpenses, ...approvedExpenses, ...rejectedExpenses];
        break;
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

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir(null);
    }
    setPage(1);
  };

  const sortedList = useMemo(() => {
    if (!sortKey || !sortDir) return activeList;
    return [...activeList].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [activeList, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedList.length / PAGE_SIZE));
  const pageData = sortedList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

  const getUserApprovalLevel = (expense: Expense): ExpenseApproval | undefined => {
    return expense.approvals?.find((a) => a.status === 'PENDING' && a.approverId === user?.id);
  };

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: 'pending', label: t('validation.tabs.pending'), count: pendingExpenses.length },
    { key: 'approved', label: t('validation.tabs.approved'), count: approvedExpenses.length },
    { key: 'rejected', label: t('validation.tabs.rejected'), count: rejectedExpenses.length },
    {
      key: 'all',
      label: t('validation.tabs.all'),
      count: pendingExpenses.length + approvedExpenses.length + rejectedExpenses.length,
    },
  ];

  const statusLabel = (status: ExpenseStatus) =>
    t(`expenses.status${status.charAt(0) + status.slice(1).toLowerCase()}`);

  const Th = ({ label, sortKeyName }: { label: string; sortKeyName: typeof sortKey }) => (
    <th
      className="cursor-pointer select-none px-3 py-2 text-left text-xs font-medium text-[#697386]"
      onClick={() => toggleSort(sortKeyName)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === sortKeyName} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0a2540]">{t('validation.title')}</h1>
        <p className="mt-1 text-sm text-[#697386]">{t('validation.subtitle')}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-[#697386]">{t('validation.kpi.pending')}</p>
            <p className="text-2xl font-bold text-[#0a2540]">{pendingExpenses.length}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-[#697386]">{t('validation.kpi.approved')}</p>
            <p className="text-2xl font-bold text-[#0a2540]">{approvedExpenses.length}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-[#697386]">{t('validation.kpi.rejected')}</p>
            <p className="text-2xl font-bold text-[#0a2540]">{rejectedExpenses.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setPage(1);
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  activeTab === tab.key
                    ? 'bg-white text-[#0a2540] shadow-sm'
                    : 'text-[#697386] hover:text-[#0a2540]',
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-xs',
                    activeTab === tab.key
                      ? 'bg-brand-gold/10 text-brand-gold'
                      : 'bg-zinc-200 text-[#697386]',
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#aab7c4]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t('expenses.searchPlaceholder')}
              className="input h-9 w-full pl-9 sm:w-64"
            />
          </div>
        </div>

        {/* Table */}
        {pendingLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-md border border-[#e0e6eb]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="border-b border-[#e0e6eb] bg-[#f6f9fc]">
                  <tr>
                    <Th label={t('expenses.reference')} sortKeyName="reference" />
                    <Th label={t('common.date')} sortKeyName="date" />
                    <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                      {t('expenses.beneficiary')}
                    </th>
                    <Th label={t('common.amount')} sortKeyName="amount" />
                    <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                      {t('validation.level')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                      {t('common.status')}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-[#aab7c4]">
                        {t('validation.noExpenses')}
                      </td>
                    </tr>
                  )}
                  {pageData.map((row, i) => {
                    const cfg = STATUS_CONFIG[row.status];
                    const Icon = cfg.icon;
                    const nextPending = row.approvals?.find((a) => a.status === 'PENDING');
                    const isPending = row.status === 'PENDING';
                    const myLevel = getUserApprovalLevel(row);
                    return (
                      <tr
                        key={row.id}
                        className={`cursor-pointer border-b border-[#e0e6eb] ${i % 2 === 1 ? 'bg-[#fafbfc]' : ''}`}
                        onClick={() => openDetail(row)}
                      >
                        <td className="px-3 py-2 font-mono font-medium text-[#0a2540]">
                          {row.reference}
                        </td>
                        <td className="px-3 py-2 text-[#697386]">{formatDate(row.date)}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-[#0a2540]">{row.beneficiary || '—'}</p>
                          <p className="text-xs text-[#aab7c4]">{row.categoryName}</p>
                        </td>
                        <td className="px-3 py-2 font-bold text-[#0a2540]">
                          {formatCFA(row.amount)}
                        </td>
                        <td className="px-3 py-2">
                          {nextPending ? (
                            <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600">
                              N{nextPending.level}
                            </span>
                          ) : (
                            <span className="text-xs text-[#aab7c4]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.classes}`}
                          >
                            <Icon className="h-3 w-3" />
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetail(row);
                              }}
                              className="rounded-md p-1.5 text-[#697386] hover:bg-zinc-100"
                              title={t('validation.viewDetail')}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {isPending && myLevel && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedExpense(row);
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
                                    setSelectedExpense(row);
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
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedList.length)} sur{' '}
                  {sortedList.length}
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

      {/* ── Detail Modal ──────────────────── */}
      <ModalShell
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedExpense(null);
        }}
        title={selectedExpense?.reference ?? ''}
        size="lg"
        footer={
          selectedExpense?.status === 'PENDING' && getUserApprovalLevel(selectedExpense) ? (
            <div className="flex w-full items-center justify-between">
              <button
                className="btn-primary bg-red-600 hover:bg-red-700"
                onClick={() => setRejectModalOpen(true)}
              >
                <XCircle className="h-4 w-4" />
                {t('expenses.reject')}
              </button>
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  onClick={() => navigate(`/expenses/${selectedExpense.id}`)}
                >
                  <Eye className="h-4 w-4" />
                  {t('validation.viewFull')}
                </button>
                <button className="btn-primary" onClick={() => setApproveModalOpen(true)}>
                  <CheckCircle2 className="h-4 w-4" />
                  {t('expenses.approve')}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn-secondary"
              onClick={() => {
                setDetailModalOpen(false);
                setSelectedExpense(null);
              }}
            >
              {t('common.close')}
            </button>
          )
        }
      >
        {selectedExpense && (
          <div className="space-y-5">
            {/* Status Badge */}
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CONFIG[selectedExpense.status].classes}`}
              >
                {createElement(STATUS_CONFIG[selectedExpense.status].icon, {
                  className: 'h-3 w-3',
                })}
                {statusLabel(selectedExpense.status)}
              </span>
              <span className="text-xs text-[#aab7c4]">
                {t('expenses.createdBy')} {selectedExpense.createdByName}
              </span>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-[#697386]">
                  <Calendar className="h-3.5 w-3.5" />
                  {t('common.date')}
                </p>
                <p className="mt-1 text-sm font-medium text-[#0a2540]">
                  {formatDate(selectedExpense.date)}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-[#697386]">
                  <CreditCard className="h-3.5 w-3.5" />
                  {t('common.amount')}
                </p>
                <p className="mt-1 text-lg font-bold text-[#0a2540]">
                  {formatCFA(selectedExpense.amount)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#697386]">{t('expenses.category')}</p>
                <p className="mt-1 text-sm font-medium text-[#0a2540]">
                  {selectedExpense.categoryName}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-[#697386]">
                  <User className="h-3.5 w-3.5" />
                  {t('expenses.beneficiary')}
                </p>
                <p className="mt-1 text-sm font-medium text-[#0a2540]">
                  {selectedExpense.beneficiary || '—'}
                </p>
              </div>
            </div>

            {selectedExpense.description && (
              <div className="border-t border-[#e0e6eb] pt-3">
                <p className="text-xs font-medium text-[#697386]">{t('expenses.description')}</p>
                <p className="mt-1 text-sm text-[#0a2540]">{selectedExpense.description}</p>
              </div>
            )}

            {selectedExpense.observations && (
              <div className="border-t border-[#e0e6eb] pt-3">
                <p className="text-xs font-medium text-[#697386]">{t('expenses.observations')}</p>
                <p className="mt-1 text-sm text-[#0a2540]">{selectedExpense.observations}</p>
              </div>
            )}

            {/* Workflow / Approvals */}
            {selectedExpense.approvals && selectedExpense.approvals.length > 0 && (
              <div className="border-t border-[#e0e6eb] pt-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#697386]">
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
                          <p className="text-sm font-medium text-[#0a2540]">{appr.approverName}</p>
                          <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-600">
                            N{appr.level}
                          </span>
                          {appr.status === 'PENDING' && appr.approverId === user?.id && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                              {t('validation.yourTurn')}
                            </span>
                          )}
                        </div>
                        {appr.approvedAt && (
                          <p className="text-xs text-[#aab7c4]">
                            {formatDateTime(appr.approvedAt)}
                          </p>
                        )}
                        {appr.comment && (
                          <div className="mt-1 flex gap-1.5 rounded-md bg-zinc-50 px-2 py-1.5">
                            <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-[#aab7c4]" />
                            <p className="text-xs text-[#697386]">{appr.comment}</p>
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
      </ModalShell>

      {/* ── Approve Modal ─────────────────── */}
      <ModalShell
        open={approveModalOpen}
        onClose={() => {
          setApproveModalOpen(false);
          setApproveComment('');
        }}
        title={t('validation.approveTitle')}
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => {
                setApproveModalOpen(false);
                setApproveComment('');
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary disabled:opacity-50"
              onClick={handleApprove}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              <CheckCircle2 className="h-4 w-4" />
              {t('validation.confirmApprove')}
            </button>
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
            <label className="label">{t('validation.commentOptional')}</label>
            <textarea
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              rows={3}
              placeholder={t('validation.approveCommentPlaceholder')}
              className="input"
            />
          </div>
        </div>
      </ModalShell>

      {/* ── Reject Modal ──────────────────── */}
      <ModalShell
        open={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectComment('');
        }}
        title={t('validation.rejectTitle')}
        footer={
          <>
            <button
              className="btn-secondary"
              onClick={() => {
                setRejectModalOpen(false);
                setRejectComment('');
              }}
            >
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
              <XCircle className="h-4 w-4" />
              {t('validation.confirmReject')}
            </button>
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
            <label className="label">{t('validation.commentRequired')}</label>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={4}
              placeholder={t('validation.rejectCommentPlaceholder')}
              className="input"
              autoFocus
            />
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
