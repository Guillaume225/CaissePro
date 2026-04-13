import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Download,
  Search,
  X,
  Calendar,
  Filter,
  Eye,
  Edit,
  Trash2,
  FileSpreadsheet,
  Banknote,
  Link2,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { Button, Badge, Card, Modal } from '@/components/ui';
import { useExpenses, useExportExpenses, useDeleteExpense, useExpenseCategories, usePayExpense, useSubmitExpense } from '@/hooks/useExpenses';
import { useCashState } from '@/hooks/useClosing';
import { formatCFA, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Expense, ExpenseStatus, ExpenseFilters } from '@/types/expense';

// ── Status config ────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; variant: 'outline' | 'warning' | 'info' | 'success' | 'destructive' }> = {
  DRAFT: { label: 'Brouillon', variant: 'outline' },
  PENDING: { label: 'En attente', variant: 'warning' },
  APPROVED: { label: 'Approuvée', variant: 'info' },
  APPROVED_L1: { label: 'Approuvée N1', variant: 'info' },
  APPROVED_L2: { label: 'Approuvée N2', variant: 'info' },
  PAID: { label: 'Payée', variant: 'success' },
  REJECTED: { label: 'Rejetée', variant: 'destructive' },
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'APPROVED_L1,APPROVED_L2', label: 'Approuvée' },
  { value: 'PAID', label: 'Payée' },
  { value: 'REJECTED', label: 'Rejetée' },
  { value: 'CANCELLED', label: 'Annulée' },
];

const PAGE_SIZES = [10, 25, 50];

type SortDir = 'ASC' | 'DESC';

export default function ExpenseListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // ── Filter state ─────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<SortDir>('DESC');
  const [showFilters, setShowFilters] = useState(false);
  const [payExpense, setPayExpense] = useState<Expense | null>(null);
  const payMutation = usePayExpense();
  const submitMutation = useSubmitExpense();

  // ── Current cash day scope ───────────────────
  const { data: cashState } = useCashState();
  const currentCashDayId = cashState?.cashDayId;

  const filters: ExpenseFilters = useMemo(
    () => ({
      page,
      perPage,
      sortBy,
      sortOrder,
      ...(currentCashDayId && { cashDayId: currentCashDayId }),
      ...(search && { search }),
      ...(statusFilter && { status: statusFilter.includes(',') ? statusFilter.split(',') as ExpenseStatus[] : statusFilter as ExpenseStatus }),
      ...(categoryFilter && { categoryId: categoryFilter }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
    }),
    [page, perPage, sortBy, sortOrder, currentCashDayId, search, statusFilter, categoryFilter, dateFrom, dateTo],
  );

  // ── Queries ──────────────────────────────────
  const { data, isLoading, isError, error } = useExpenses(filters);
  const { data: categories } = useExpenseCategories();
  const exportMutation = useExportExpenses();
  const deleteMutation = useDeleteExpense();

  const expenses = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  // ── Column sorting ───────────────────────────
  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(key);
      setSortOrder('ASC');
    }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => (
    <span className="ml-1 text-gray-300">
      {sortBy === col ? (
        sortOrder === 'ASC' ? '↑' : '↓'
      ) : '↕'}
    </span>
  );

  // ── Reset filters ────────────────────────────
  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = search || statusFilter || categoryFilter || dateFrom || dateTo;

  // ── Delete handler ───────────────────────────
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm(t('expenses.confirmDelete'))) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page header ───────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('expenses.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('expenses.subtitle')}</p>
        </div>
        <Button onClick={() => navigate('/expenses/new')}>
          <Plus className="h-4 w-4" />
          {t('expenses.newExpense')}
        </Button>
      </div>

      {/* ── Filters bar ───────────────────────── */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('expenses.searchPlaceholder')}
              className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Status select */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Toggle more filters */}
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4" />
            {t('expenses.filters')}
          </Button>

          {/* Export buttons */}
          <div className="flex gap-1 ml-auto">
            <Button
              variant="outline"
              size="sm"
              loading={exportMutation.isPending}
              onClick={() => exportMutation.mutate({ format: 'xlsx', filters })}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={exportMutation.isPending}
              onClick={() => exportMutation.mutate({ format: 'csv', filters })}
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>

        {/* Extended filters */}
        {showFilters && (
          <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-gray-100 pt-4">
            {/* Category */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">{t('expenses.category')}</label>
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
              >
                <option value="">{t('expenses.allCategories')}</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">{t('expenses.dateFrom')}</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="h-9 rounded-lg border border-gray-300 pl-8 pr-3 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">{t('expenses.dateTo')}</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="h-9 rounded-lg border border-gray-300 pl-8 pr-3 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                />
              </div>
            </div>

            {/* Reset */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-4 w-4" />
                {t('expenses.resetFilters')}
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* ── Data table ────────────────────────── */}
      <Card className="p-0 overflow-hidden">
        {isLoading && (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
          </div>
        )}

        {isError && (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-red-500">
            <p className="text-sm font-medium">{t('common.error')}</p>
            <p className="text-xs">{(error as Error)?.message}</p>
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <Th onClick={() => handleSort('reference')}>
                      {t('expenses.reference')}<SortIcon col="reference" />
                    </Th>
                    <Th onClick={() => handleSort('date')}>
                      {t('common.date')}<SortIcon col="date" />
                    </Th>
                    <Th onClick={() => handleSort('categoryName')}>
                      {t('expenses.category')}<SortIcon col="categoryName" />
                    </Th>
                    <Th onClick={() => handleSort('beneficiary')}>
                      {t('expenses.beneficiary')}<SortIcon col="beneficiary" />
                    </Th>
                    <Th onClick={() => handleSort('amount')} className="text-right">
                      {t('common.amount')}<SortIcon col="amount" />
                    </Th>
                    <Th>{t('expenses.cashDay')}</Th>
                    <Th onClick={() => handleSort('status')}>
                      {t('common.status')}<SortIcon col="status" />
                    </Th>
                    <Th>{t('expenses.validation')}</Th>
                    <Th className="text-right">{t('common.actions')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-gray-400">
                        {t('common.noData')}
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr
                        key={exp.id}
                        onClick={() => navigate(`/expenses/${exp.id}`)}
                        className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 font-medium text-brand-gold">
                          <span className="flex items-center gap-1.5">
                            {exp.reference}
                            {exp.disbursementRequestId && (
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/pending-requests`); }}
                                className="text-amber-500 hover:text-amber-700"
                                title={t('expenses.linkedRequest')}
                              >
                                <Link2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(exp.date)}</td>
                        <td className="px-4 py-3 text-gray-700">{exp.categoryName}</td>
                        <td className="px-4 py-3 text-gray-700">{exp.beneficiary || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {formatCFA(exp.amount)}
                        </td>
                        <td className="px-4 py-3">
                          {exp.cashDayRef ? (
                            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{exp.cashDayRef}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={exp.status} />
                        </td>
                        <td className="px-4 py-3">
                          <ApprovalInfo expense={exp} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/expenses/${exp.id}`); }}
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              title={t('common.edit')}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {exp.status === 'DRAFT' && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); submitMutation.mutate(exp.id); }}
                                  className="rounded p-1.5 text-green-500 hover:bg-green-50 hover:text-green-700"
                                  title={t('expenses.submit')}
                                >
                                  <Send className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigate(`/expenses/${exp.id}`); }}
                                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                  title={t('common.edit')}
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => handleDelete(e, exp.id)}
                                  className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                                  title={t('common.delete')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {exp.status === 'APPROVED_L2' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setPayExpense(exp); }}
                                className="rounded p-1.5 text-blue-500 hover:bg-blue-50 hover:text-blue-700"
                                title={t('expenses.markPaid')}
                              >
                                <Banknote className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta && (
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>
                    {(meta.page - 1) * meta.perPage + 1}–
                    {Math.min(meta.page * meta.perPage, meta.total)} {t('expenses.of')} {meta.total}
                  </span>
                  <select
                    value={perPage}
                    onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                    className="h-8 rounded border border-gray-200 px-2 text-xs"
                  >
                    {PAGE_SIZES.map((s) => (
                      <option key={s} value={s}>{s} / {t('expenses.page')}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <PaginationBtn onClick={() => setPage(1)} disabled={page <= 1}>«</PaginationBtn>
                  <PaginationBtn onClick={() => setPage(page - 1)} disabled={page <= 1}>‹</PaginationBtn>
                  <span className="px-3 text-xs font-medium text-gray-600">
                    {page} / {totalPages}
                  </span>
                  <PaginationBtn onClick={() => setPage(page + 1)} disabled={page >= totalPages}>›</PaginationBtn>
                  <PaginationBtn onClick={() => setPage(totalPages)} disabled={page >= totalPages}>»</PaginationBtn>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ── Pay Modal ─────────────────────── */}
      <Modal
        open={!!payExpense}
        onClose={() => setPayExpense(null)}
        title={t('expenses.payTitle')}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPayExpense(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (!payExpense) return;
                payMutation.mutate(payExpense.id, {
                  onSuccess: () => { payMutation.reset(); setPayExpense(null); },
                });
              }}
              loading={payMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Banknote className="h-4 w-4" />
              {t('expenses.confirmPay')}
            </Button>
          </>
        }
      >
        {payExpense && (
          <div className="space-y-3">
            {payMutation.isError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm font-medium text-red-800">
                  {(payMutation.error as any)?.response?.data?.message || t('expenses.payError')}
                </p>
              </div>
            )}
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-sm text-blue-800">
                {t('expenses.payConfirmText', {
                  reference: payExpense.reference,
                  amount: formatCFA(payExpense.amount),
                })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-100 p-3">
              <div>
                <p className="text-xs text-gray-500">{t('expenses.beneficiary')}</p>
                <p className="text-sm font-medium text-gray-900">{payExpense.beneficiary || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('common.amount')}</p>
                <p className="text-sm font-bold text-gray-900">{formatCFA(payExpense.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('expenses.category')}</p>
                <p className="text-sm font-medium text-gray-700">{payExpense.categoryName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('common.date')}</p>
                <p className="text-sm font-medium text-gray-700">{formatDate(payExpense.date)}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────
function StatusBadge({ status }: { status: ExpenseStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function Th({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500',
        onClick && 'cursor-pointer select-none hover:text-gray-700',
        className,
      )}
    >
      {children}
    </th>
  );
}

function PaginationBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-md text-sm text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function ApprovalInfo({ expense }: { expense: Expense }) {
  if (!expense.approvals || expense.approvals.length === 0) {
    if (expense.status === 'DRAFT') return <span className="text-xs text-gray-400">—</span>;
    if (expense.status === 'PENDING') return <span className="text-xs text-amber-600">En attente N1</span>;
    return <span className="text-xs text-gray-400">—</span>;
  }

  const sorted = [...expense.approvals].sort((a, b) => a.level - b.level);
  const lastAction = sorted.filter((a) => a.status !== 'PENDING').sort((a, b) => b.level - a.level)[0];
  const pending = sorted.find((a) => a.status === 'PENDING');

  return (
    <div className="space-y-0.5">
      {sorted.map((a) => (
        <div key={a.id} className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              a.status === 'APPROVED' && 'bg-green-500',
              a.status === 'REJECTED' && 'bg-red-500',
              a.status === 'PENDING' && 'bg-amber-400',
            )}
          />
          <span className="text-xs text-gray-600">
            N{a.level}
            {a.approverName ? ` · ${a.approverName}` : ''}
          </span>
          {a.status === 'APPROVED' && <ShieldCheck className="h-3 w-3 text-green-500" />}
        </div>
      ))}
      {expense.status === 'PENDING' && !pending && (
        <span className="text-xs text-amber-600">En attente N1</span>
      )}
    </div>
  );
}
