import { useMemo, useState, Fragment } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  Vault,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  UnlockKeyhole,
  Clock,
  Receipt,
  Banknote,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Eye,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  LockKeyhole,
  AlertTriangle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  Card,
  CardContent,
  Stat,
  DataTable,
  Modal,
} from '@/components/ui';
import type { Column } from '@/components/ui/DataTable';
import {
  useCashDayDetail,
  useCashDayOperations,
  useCloseCash,
  type CashDayMovement,
  type CashDayExpense,
} from '@/hooks/useClosing';
import { useExpense } from '@/hooks/useExpenses';

type AnyRow = Record<string, unknown>;

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'decimal' }).format(n) + ' FCFA';

function timeSince(dateStr: string): string {
  const now = new Date();
  const opened = new Date(dateStr);
  const diffMs = now.getTime() - opened.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}j ${hours % 24}h`;
  const mins = Math.floor(diffMs / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins % 60}min`;
  return `${mins}min`;
}

const statusColors: Record<string, 'success' | 'destructive' | 'warning' | 'info' | 'default'> = {
  DRAFT: 'default',
  PENDING: 'warning',
  APPROVED_L1: 'info',
  APPROVED_L2: 'info',
  PAID: 'success',
  REJECTED: 'destructive',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  PENDING: 'Soumise',
  APPROVED_L1: 'Approuvée N1',
  APPROVED_L2: 'Approuvée N2',
  PAID: 'Payée',
  REJECTED: 'Rejetée',
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  CHECK: 'Chèque',
  TRANSFER: 'Virement',
  MOBILE_MONEY: 'Mobile Money',
};

export default function CashDayDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: day, isLoading: dayLoading } = useCashDayDetail(id);
  const { data: ops, isLoading: opsLoading } = useCashDayOperations(id);
  const closeCash = useCloseCash();

  // ── Close cash state ───────────────────────────────────
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actualBalance, setActualBalance] = useState('');
  const [closeComment, setCloseComment] = useState('');
  const [closeError, setCloseError] = useState<string | null>(null);

  const gap =
    actualBalance !== '' && day
      ? Number(actualBalance) - day.theoreticalBalance
      : null;

  const handleClose = async () => {
    try {
      setCloseError(null);
      await closeCash.mutateAsync({
        actualBalance: Number(actualBalance),
        comment: closeComment || undefined,
      });
      setShowCloseModal(false);
      setActualBalance('');
      setCloseComment('');
      queryClient.invalidateQueries({ queryKey: ['closing', 'day', id] });
      queryClient.invalidateQueries({ queryKey: ['closing', 'day', id, 'operations'] });
      queryClient.invalidateQueries({ queryKey: ['closing', 'open-days'] });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || t('common.error');
      setCloseError(msg);
    }
  };

  const movements = ops?.movements ?? [];
  const expenses = ops?.expenses ?? [];

  const expenseStats = useMemo(() => {
    let entries = 0, exits = 0, total = 0;
    for (const e of expenses) {
      total += e.amount;
      if (e.categoryDirection === 'ENTRY') entries++;
      else exits++;
    }
    return { entries, exits, total, totalAmount: total };
  }, [expenses]);

  const STATUS_ORDER = ['DRAFT', 'PENDING', 'APPROVED_L1', 'APPROVED_L2', 'PAID', 'REJECTED'] as const;

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (status: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  // ── Filters ────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPayment, setFilterPayment] = useState('ALL');
  const [filterDirection, setFilterDirection] = useState<'ALL' | 'ENTRY' | 'EXIT'>('ALL');

  const availablePayments = useMemo(() => {
    const set = new Set(expenses.map((e) => e.paymentMethod));
    return Array.from(set).sort();
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    let list = expenses;
    if (filterStatus !== 'ALL') list = list.filter((e) => e.status === filterStatus);
    if (filterPayment !== 'ALL') list = list.filter((e) => e.paymentMethod === filterPayment);
    if (filterDirection !== 'ALL') list = list.filter((e) => e.categoryDirection === filterDirection);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.beneficiary?.toLowerCase().includes(q) ||
          e.reference?.toLowerCase().includes(q) ||
          e.categoryName?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [expenses, filterStatus, filterPayment, filterDirection, searchTerm]);

  const filteredByStatus = useMemo(() => {
    const grouped = new Map<string, CashDayExpense[]>();
    for (const e of filteredExpenses) {
      const list = grouped.get(e.status) ?? [];
      list.push(e);
      grouped.set(e.status, list);
    }
    return STATUS_ORDER
      .filter((s) => grouped.has(s))
      .map((s) => ({ status: s, items: grouped.get(s)! }));
  }, [filteredExpenses]);

  const hasActiveFilters = filterStatus !== 'ALL' || filterPayment !== 'ALL' || filterDirection !== 'ALL' || searchTerm.trim() !== '';

  const clearFilters = () => {
    setSearchTerm('');
    setFilterStatus('ALL');
    setFilterPayment('ALL');
    setFilterDirection('ALL');
  };

  // ── Expense detail popup ───────────────────────────────
  const [selectedExpense, setSelectedExpense] = useState<CashDayExpense | null>(null);
  const { data: fullExpense, isLoading: expenseLoading } = useExpense(selectedExpense?.id ?? '');

  const mvColumns: Column<AnyRow>[] = [
    {
      key: 'time',
      header: t('closing.operations.time'),
      render: (r) => {
        const row = r as unknown as CashDayMovement;
        return <span className="text-xs text-gray-500">{new Date(row.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>;
      },
    },
    {
      key: 'type',
      header: t('closing.operations.type'),
      render: (r) => {
        const row = r as unknown as CashDayMovement;
        return <Badge variant={row.type === 'ENTRY' ? 'success' : 'destructive'}>{row.type === 'ENTRY' ? t('closing.operations.entry') : t('closing.operations.exit')}</Badge>;
      },
    },
    {
      key: 'category',
      header: t('closing.operations.category'),
      render: (r) => {
        const row = r as unknown as CashDayMovement;
        const v: Record<string, 'success' | 'destructive' | 'info' | 'warning' | 'default'> = {
          SALE: 'success', EXPENSE: 'destructive', PAYMENT: 'info', ADJUSTMENT: 'warning', OTHER: 'default',
        };
        return <Badge variant={v[row.category] || 'default'}>{row.category}</Badge>;
      },
    },
    { key: 'reference', header: t('closing.operations.reference') },
    {
      key: 'description',
      header: t('closing.operations.description'),
      render: (r) => <span className="text-sm text-gray-600">{(r as unknown as CashDayMovement).description}</span>,
    },
    {
      key: 'amount',
      header: t('common.amount'),
      className: 'text-right',
      render: (r) => {
        const row = r as unknown as CashDayMovement;
        return (
          <span className={`font-medium ${row.type === 'EXIT' ? 'text-red-600' : 'text-green-600'}`}>
            {row.type === 'EXIT' ? '−' : '+'}{fmt(Math.abs(row.amount))}
          </span>
        );
      },
    },
  ];

  if (dayLoading) {
    return <p className="text-sm text-gray-500">{t('common.loading')}</p>;
  }

  if (!day) {
    return <p className="text-sm text-red-500">{t('cashDayDetail.notFound')}</p>;
  }

  const hours = Math.floor((Date.now() - new Date(day.openedAt).getTime()) / 3_600_000);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to="/manager-caisse/closing"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-gold transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('managerClosing.title')}
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Vault className="h-6 w-6 text-amber-500" />
            {t('cashDayDetail.title')}
          </h1>
          <div className="mt-1 flex items-center gap-3">
            <span className="font-mono text-sm text-brand-gold">{day.reference}</span>
            <Badge variant={day.status === 'OPEN' ? 'success' : day.status === 'PENDING_CLOSE' ? 'warning' : 'default'}>
              {day.status === 'OPEN' ? t('closing.statusOpen') : day.status === 'PENDING_CLOSE' ? t('closing.statusPendingClose') : t('closing.statusClosed')}
            </Badge>
            {(day.status === 'OPEN' || day.status === 'PENDING_CLOSE') && (
              <span className={`text-xs ${hours > 12 ? 'font-medium text-red-500' : 'text-gray-400'}`}>
                <Clock className="mr-0.5 inline h-3 w-3" />
                {timeSince(day.openedAt)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {t('cashDayDetail.openedBy', { name: day.openedByName, date: new Date(day.openedAt).toLocaleString('fr-FR') })}
          </p>
        </div>
        {day.status === 'PENDING_CLOSE' && (
          <Button variant="destructive" onClick={() => { setCloseError(null); setShowCloseModal(true); }}>
            <LockKeyhole className="mr-2 h-4 w-4" />
            {t('closing.closeCash')}
          </Button>
        )}
        {day.status === 'OPEN' && (
          <Badge variant="info" className="text-sm px-3 py-1">
            {t('closing.awaitingCashierLock')}
          </Badge>
        )}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-brand-gold">
          <CardContent className="flex items-center gap-3 py-4">
            <Vault className="h-8 w-8 text-brand-gold" />
            <div>
              <p className="text-xs text-gray-500">{t('closing.status')}</p>
              <Badge variant={day.status === 'OPEN' ? 'success' : day.status === 'PENDING_CLOSE' ? 'warning' : 'default'} className="mt-1">
                {day.status === 'OPEN' ? t('closing.statusOpen') : day.status === 'PENDING_CLOSE' ? t('closing.statusPendingClose') : t('closing.statusClosed')}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Stat
          label={t('closing.openModal.openingBalance')}
          value={fmt(day.openingBalance)}
          icon={<UnlockKeyhole className="h-5 w-5" />}
        />
        <Stat
          label={t('closing.theoreticalBalance')}
          value={fmt(day.theoreticalBalance)}
          icon={<Vault className="h-5 w-5" />}
        />
        <Stat
          label={t('closing.todayEntries')}
          value={fmt(day.totalEntries)}
          icon={<ArrowUpRight className="h-5 w-5" />}
        />
        <Stat
          label={t('closing.todayExits')}
          value={fmt(day.totalExits)}
          icon={<ArrowDownRight className="h-5 w-5" />}
        />
      </div>

      {/* Expense summary */}
      {expenses.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3 mb-3">
              <Receipt className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-800">
                {t('cashDayDetail.expenseSummary', { count: expenses.length })}
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                <ArrowUpRight className="mx-auto mb-1 h-5 w-5 text-green-600" />
                <p className="text-lg font-bold text-green-700">{expenseStats.entries}</p>
                <p className="text-[11px] text-green-600">{t('closing.expenseStats.entries')}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                <ArrowDownRight className="mx-auto mb-1 h-5 w-5 text-red-600" />
                <p className="text-lg font-bold text-red-700">{expenseStats.exits}</p>
                <p className="text-[11px] text-red-600">{t('closing.expenseStats.exits')}</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                <Banknote className="mx-auto mb-1 h-5 w-5 text-blue-600" />
                <p className="text-lg font-bold text-blue-700">{fmt(expenseStats.totalAmount)}</p>
                <p className="text-[11px] text-blue-600">{t('cashDayDetail.totalExpenses')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expenses grouped by status */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-800">
          <Receipt className="h-5 w-5 text-blue-500" />
          {t('cashDayDetail.expensesTitle')} ({filteredExpenses.length}{filteredExpenses.length !== expenses.length ? ` / ${expenses.length}` : ''})
        </h2>

        {/* Filter bar */}
        {expenses.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('cashDayDetail.filterSearch')}
                className="h-8 rounded-md border border-gray-200 bg-white pl-8 pr-3 text-xs focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold w-48"
              />
            </div>

            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
            >
              <option value="ALL">{t('cashDayDetail.filterAllStatuses')}</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
              ))}
            </select>

            {/* Payment method filter */}
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
            >
              <option value="ALL">{t('cashDayDetail.filterAllPayments')}</option>
              {availablePayments.map((p) => (
                <option key={p} value={p}>{PAYMENT_LABELS[p] ?? p}</option>
              ))}
            </select>

            {/* Direction filter */}
            <select
              value={filterDirection}
              onChange={(e) => setFilterDirection(e.target.value as 'ALL' | 'ENTRY' | 'EXIT')}
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
            >
              <option value="ALL">{t('cashDayDetail.filterAllDirections')}</option>
              <option value="ENTRY">{t('cashDayDetail.filterEntries')}</option>
              <option value="EXIT">{t('cashDayDetail.filterExits')}</option>
            </select>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              >
                <X className="h-3 w-3" />
                {t('cashDayDetail.filterClear')}
              </button>
            )}
          </div>
        )}

        {opsLoading ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : filteredByStatus.length === 0 ? (
          <p className="text-sm text-gray-500">
            {hasActiveFilters ? t('cashDayDetail.noFilterResults') : t('cashDayDetail.noExpenses')}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3">{t('common.date')}</th>
                  <th className="px-4 py-3">{t('closing.history.reference')}</th>
                  <th className="px-4 py-3">{t('cashDayDetail.beneficiary')}</th>
                  <th className="px-4 py-3">{t('closing.operations.category')}</th>
                  <th className="px-4 py-3">{t('cashDayDetail.paymentMethod')}</th>
                  <th className="px-4 py-3 text-right">{t('common.amount')}</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filteredByStatus.map(({ status, items }) => {
                  const isCollapsed = collapsedGroups.has(status);
                  const groupTotal = items.reduce((s, e) => s + e.amount, 0);
                  return (
                    <Fragment key={status}>
                      <tr
                        className="cursor-pointer border-b bg-gray-100 hover:bg-gray-200/80 transition-colors"
                        onClick={() => toggleGroup(status)}
                      >
                        <td className="px-4 py-2.5">
                          {isCollapsed
                            ? <ChevronRight className="h-4 w-4 text-gray-500" />
                            : <ChevronDown className="h-4 w-4 text-gray-500" />}
                        </td>
                        <td colSpan={5} className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Badge variant={statusColors[status] || 'default'}>{STATUS_LABELS[status] ?? status}</Badge>
                            <span className="text-sm text-gray-500">
                              — {items.length} {items.length > 1 ? t('cashDayDetail.expenses') : t('cashDayDetail.expense')}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm font-semibold text-gray-700">
                          {fmt(groupTotal)}
                        </td>
                        <td />
                      </tr>
                      {!isCollapsed && items.map((exp) => (
                        <tr key={exp.id} className="border-b last:border-b-0 bg-white hover:bg-gray-50/60">
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2 text-sm">
                            {new Date(exp.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-4 py-2">
                            <span className="font-mono text-xs text-brand-gold">{exp.reference}</span>
                          </td>
                          <td className="px-4 py-2 text-sm">{exp.beneficiary}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              {exp.categoryDirection === 'ENTRY'
                                ? <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                                : <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />}
                              <span className="text-sm">{exp.categoryName ?? '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-500">{PAYMENT_LABELS[exp.paymentMethod] ?? exp.paymentMethod}</td>
                          <td className="px-4 py-2 text-right">
                            <span className={`font-medium ${exp.categoryDirection === 'EXIT' ? 'text-red-600' : 'text-green-600'}`}>
                              {exp.categoryDirection === 'EXIT' ? '−' : '+'}{fmt(exp.amount)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => setSelectedExpense(exp)}
                              className="rounded p-1 text-gray-400 hover:bg-brand-gold/10 hover:text-brand-gold transition-colors"
                              title={t('cashDayDetail.viewExpense')}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Movements table */}
      {movements.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-800">
            <Banknote className="h-5 w-5 text-amber-500" />
            {t('cashDayDetail.movementsTitle')} ({movements.length})
          </h2>
          <DataTable
            columns={mvColumns}
            data={movements as unknown as AnyRow[]}
            pageSize={15}
            emptyMessage={t('cashDayDetail.noMovements')}
          />
        </div>
      )}

      {/* ── Expense detail popup ────────────────────────── */}
      {selectedExpense && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedExpense(null)}
        >
          <div
            className="relative mx-4 w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-brand-gold" />
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('cashDayDetail.expenseDetail')}
                </h3>
              </div>
              <button
                onClick={() => setSelectedExpense(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 px-6 py-5 overflow-y-auto">
              {/* Reference + status */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-brand-gold">{selectedExpense.reference}</span>
                <Badge variant={statusColors[selectedExpense.status] || 'default'}>
                  {STATUS_LABELS[selectedExpense.status] ?? selectedExpense.status}
                </Badge>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase text-gray-400">{t('common.date')}</p>
                  <p className="text-gray-800">{new Date(selectedExpense.date).toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-400">{t('common.amount')}</p>
                  <p className={`font-semibold ${selectedExpense.categoryDirection === 'EXIT' ? 'text-red-600' : 'text-green-600'}`}>
                    {selectedExpense.categoryDirection === 'EXIT' ? '−' : '+'}{fmt(selectedExpense.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-400">{t('cashDayDetail.beneficiary')}</p>
                  <p className="text-gray-800">{selectedExpense.beneficiary}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-400">{t('cashDayDetail.paymentMethod')}</p>
                  <p className="text-gray-800">{PAYMENT_LABELS[selectedExpense.paymentMethod] ?? selectedExpense.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-400">{t('closing.operations.category')}</p>
                  <div className="flex items-center gap-1 text-gray-800">
                    {selectedExpense.categoryDirection === 'ENTRY'
                      ? <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                      : <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />}
                    {selectedExpense.categoryName ?? '—'}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-400">{t('cashDayDetail.createdAt')}</p>
                  <p className="text-gray-800">{new Date(selectedExpense.createdAt).toLocaleString('fr-FR')}</p>
                </div>
              </div>

              {/* Observations */}
              {selectedExpense.observations && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-gray-400">{t('cashDayDetail.observations')}</p>
                  <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    {selectedExpense.observations}
                  </p>
                </div>
              )}

              {/* Validation history */}
              <div className="border-t border-gray-100 pt-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t('cashDayDetail.validationHistory')}
                </p>
                {expenseLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </div>
                ) : fullExpense?.approvals && fullExpense.approvals.length > 0 ? (
                  <div className="space-y-3">
                    {fullExpense.approvals.map((appr) => (
                      <div key={appr.id} className="flex items-start gap-3">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            appr.status === 'APPROVED'
                              ? 'bg-green-100 text-green-600'
                              : appr.status === 'REJECTED'
                                ? 'bg-red-100 text-red-600'
                                : 'bg-amber-100 text-amber-600'
                          }`}
                        >
                          {appr.status === 'APPROVED' ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : appr.status === 'REJECTED' ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <Clock className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-700">{appr.approverName}</p>
                            <Badge variant="outline" className="text-[10px]">N{appr.level}</Badge>
                            <Badge
                              variant={appr.status === 'APPROVED' ? 'success' : appr.status === 'REJECTED' ? 'destructive' : 'warning'}
                              className="text-[10px]"
                            >
                              {appr.status === 'APPROVED'
                                ? t('cashDayDetail.approved')
                                : appr.status === 'REJECTED'
                                  ? t('cashDayDetail.rejected')
                                  : t('cashDayDetail.pending')}
                            </Badge>
                          </div>
                          {appr.approvedAt && (
                            <p className="text-xs text-gray-400">
                              {new Date(appr.approvedAt).toLocaleString('fr-FR')}
                            </p>
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
                ) : (
                  <p className="text-sm text-gray-400">{t('cashDayDetail.noValidationHistory')}</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-3 text-right">
              <button
                onClick={() => setSelectedExpense(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Cash Modal */}
      <Modal
        open={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        title={t('closing.closeModal.title')}
        size="md"
      >
        <div className="space-y-4">
          {/* Error display */}
          {closeError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-800">{closeError}</p>
            </div>
          )}
          {/* Theoretical balance display */}
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs text-gray-500">{t('closing.theoreticalBalance')}</p>
            <p className="text-lg font-bold text-gray-900">{fmt(day?.theoreticalBalance ?? 0)}</p>
          </div>

          <Input
            label={t('closing.closeModal.actualBalance')}
            type="number"
            value={actualBalance}
            onChange={(e) => setActualBalance(e.target.value)}
            placeholder="0"
          />

          {/* Gap display */}
          {gap !== null && (
            <div
              className={`flex items-center gap-2 rounded-lg p-3 ${
                gap === 0
                  ? 'bg-green-50 text-green-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {gap === 0 ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {t('closing.closeModal.gap')}: {gap > 0 ? '+' : ''}{fmt(gap)}
                </p>
                {gap !== 0 && (
                  <p className="text-xs">{t('closing.closeModal.gapWarning')}</p>
                )}
              </div>
            </div>
          )}

          {/* Comment (mandatory if gap !== 0) */}
          {gap !== null && gap !== 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('closing.closeModal.comment')} *
              </label>
              <textarea
                value={closeComment}
                onChange={(e) => setCloseComment(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                placeholder={t('closing.closeModal.commentPlaceholder')}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCloseModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleClose}
              loading={closeCash.isPending}
              disabled={
                actualBalance === '' ||
                (gap !== null && gap !== 0 && !closeComment.trim())
              }
            >
              <LockKeyhole className="mr-2 h-4 w-4" />
              {t('closing.closeCash')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
