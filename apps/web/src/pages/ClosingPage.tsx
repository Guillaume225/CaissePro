import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Vault,
  UnlockKeyhole,
  LockKeyhole,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  FileSignature,
  Receipt,
  FileEdit,
  Clock,
  ShieldCheck,
  Ban,
  Banknote,
  Printer,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Button, Input, Badge, Card, CardContent, Stat, Modal } from '@/components/ui';
import {
  useCashState,
  useDayOperations,
  useOpenCash,
  useAddCashMovement,
  useLockCash,
  useUnlockCash,
} from '@/hooks/useClosing';
import { usePendingDisbursementRequests } from '@/hooks/useDisbursementRequests';
import { useExpenses, useExpenseCategories } from '@/hooks/useExpenses';
import type { CashMovementType, CashMovementCategory } from '@/types/admin';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'decimal' }).format(n) + ' FCFA';

export default function ClosingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: state, isLoading: stateLoading } = useCashState();
  useDayOperations();
  const openCash = useOpenCash();
  const addMovement = useAddCashMovement();
  const lockCash = useLockCash();
  const unlockCash = useUnlockCash();

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');

  // ── Lock confirmation: must visit reports first ────────
  const [showLockModal, setShowLockModal] = useState(false);
  const REPORTS_VISITED_KEY = `cashReportsVisited_${state?.cashDayId ?? ''}`;
  const [reportsVisited, setReportsVisited] = useState(() => {
    if (!state?.cashDayId) return false;
    return sessionStorage.getItem(`cashReportsVisited_${state.cashDayId}`) === 'true';
  });

  // Re-check when cashDayId changes
  useEffect(() => {
    if (state?.cashDayId) {
      setReportsVisited(sessionStorage.getItem(REPORTS_VISITED_KEY) === 'true');
    }
  }, [state?.cashDayId, REPORTS_VISITED_KEY]);

  const handleGoToReports = () => {
    if (state?.cashDayId) {
      sessionStorage.setItem(REPORTS_VISITED_KEY, 'true');
    }
    navigate('/expenses/cash-reports');
  };

  const handleConfirmLock = async () => {
    await lockCash.mutateAsync();
    setShowLockModal(false);
  };

  // ── Movement form state ───────────────────────────────
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [mvType, setMvType] = useState<CashMovementType>('ENTRY');
  const [mvCategory, setMvCategory] = useState<CashMovementCategory>('SALE');
  const [mvAmount, setMvAmount] = useState('');
  const [mvReference, setMvReference] = useState('');
  const [mvDescription, setMvDescription] = useState('');

  const handleOpen = async () => {
    await openCash.mutateAsync(Number(openingBalance) || 0);
    setShowOpenModal(false);
    setOpeningBalance('');
  };

  const handleAddMovement = async () => {
    await addMovement.mutateAsync({
      type: mvType,
      category: mvCategory,
      amount: Number(mvAmount) || 0,
      reference: mvReference || undefined,
      description: mvDescription,
    });
    setShowMovementModal(false);
    setMvType('ENTRY');
    setMvCategory('SALE');
    setMvAmount('');
    setMvReference('');
    setMvDescription('');
  };

  // ── Pending requests count for stats block ─────────
  const { data: pendingRequests = [] } = usePendingDisbursementRequests();
  const pendingOnly = pendingRequests.filter(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED',
  );

  const pendingTotalAmount = pendingOnly.reduce((sum, r) => sum + r.amount, 0);

  // ── Expense stats for current cash day ─────────────
  const currentCashDayId = state?.cashDayId;
  const { data: expenseData } = useExpenses({ perPage: 100, cashDayId: currentCashDayId });
  const { data: categories = [] } = useExpenseCategories();
  const expenses = currentCashDayId ? (expenseData?.data ?? []) : [];

  const expenseStats = useMemo(() => {
    const dirMap = new Map<string, 'ENTRY' | 'EXIT'>();
    const flattenCats = (cats: typeof categories) => {
      for (const c of cats) {
        if (c.direction) dirMap.set(c.id, c.direction);
        if (c.children?.length) flattenCats(c.children);
      }
    };
    flattenCats(categories);

    let draft = 0,
      pending = 0,
      approved = 0,
      paid = 0,
      rejected = 0;
    let entries = 0,
      exits = 0;
    let totalAmount = 0,
      paidAmount = 0;

    for (const e of expenses) {
      totalAmount += e.amount;

      // Direction-based count (all statuses)
      const dir = dirMap.get(e.categoryId);
      if (dir === 'ENTRY') entries++;
      else if (dir === 'EXIT') exits++;

      switch (e.status) {
        case 'DRAFT':
          draft++;
          break;
        case 'PENDING':
        case 'APPROVED_L1':
          pending++;
          break;
        case 'APPROVED_L2':
          approved++;
          break;
        case 'PAID':
          paid++;
          paidAmount += e.amount;
          break;
        case 'REJECTED':
          rejected++;
          break;
      }
    }

    return {
      draft,
      pending,
      approved,
      paid,
      rejected,
      entries,
      exits,
      total: entries + exits,
      totalAmount,
      paidAmount,
    };
  }, [expenses, categories]);

  if (stateLoading) {
    return <p className="text-sm text-gray-500">{t('common.loading')}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('closing.title')}</h1>
          <p className="text-sm text-gray-500">{t('closing.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {state?.status === 'OPEN' && (
            <Button variant="destructive" onClick={() => setShowLockModal(true)}>
              <LockKeyhole className="mr-2 h-4 w-4" />
              {t('closing.lockCash')}
            </Button>
          )}
          {state?.status === 'PENDING_CLOSE' && (
            <Button
              variant="outline"
              onClick={() => unlockCash.mutate()}
              loading={unlockCash.isPending}
            >
              <UnlockKeyhole className="mr-2 h-4 w-4" />
              {t('closing.unlockCash')}
            </Button>
          )}
          {state?.status === 'CLOSED' && (
            <Button onClick={() => setShowOpenModal(true)}>
              <UnlockKeyhole className="mr-2 h-4 w-4" />
              {t('closing.openCash')}
            </Button>
          )}
        </div>
      </div>

      {/* Status + KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-brand-gold">
          <CardContent className="flex items-center gap-3 py-4">
            <Vault className="h-8 w-8 text-brand-gold" />
            <div>
              <p className="text-xs text-gray-500">{t('closing.status')}</p>
              <Badge
                variant={
                  state?.status === 'OPEN'
                    ? 'success'
                    : state?.status === 'PENDING_CLOSE'
                      ? 'warning'
                      : 'default'
                }
                className="mt-1"
              >
                {state?.status === 'OPEN'
                  ? t('closing.statusOpen')
                  : state?.status === 'PENDING_CLOSE'
                    ? t('closing.statusPendingClose')
                    : t('closing.statusClosed')}
              </Badge>
              {state?.openedBy && (
                <p className="mt-1 text-[10px] text-gray-400">
                  {t('closing.openedBy', { name: state.openedBy })}
                </p>
              )}
              {state?.reference && (
                <p className="mt-0.5 font-mono text-[10px] text-brand-gold">{state.reference}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Stat
          label={t('closing.openModal.openingBalance')}
          value={fmt(state?.openingBalance ?? 0)}
          icon={<UnlockKeyhole className="h-5 w-5" />}
        />
        <Stat
          label={t('closing.theoreticalBalance')}
          value={fmt(state?.theoreticalBalance ?? 0)}
          icon={<Vault className="h-5 w-5" />}
        />
        <Stat
          label={t('closing.todayEntries')}
          value={fmt(state?.todayEntries ?? 0)}
          icon={<ArrowUpRight className="h-5 w-5" />}
        />
        <Stat
          label={t('closing.todayExits')}
          value={fmt(state?.todayExits ?? 0)}
          icon={<ArrowDownRight className="h-5 w-5" />}
        />
      </div>

      {/* Pending close banner */}
      {state?.status === 'PENDING_CLOSE' && (
        <Card className="border-l-4 border-l-orange-400 bg-orange-50">
          <CardContent className="flex items-center gap-3 py-4">
            <LockKeyhole className="h-6 w-6 text-orange-600" />
            <div>
              <p className="text-sm font-semibold text-orange-800">
                {t('closing.pendingCloseBanner.title')}
              </p>
              <p className="text-xs text-orange-600">
                {t('closing.pendingCloseBanner.description')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending requests stats block */}
      {state?.status === 'OPEN' && (
        <Card
          className="cursor-pointer border-l-4 border-l-amber-400 transition hover:shadow-md"
          onClick={() => navigate('/pending-requests')}
        >
          <CardContent className="flex items-center gap-4 py-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50">
              <FileSignature className="h-6 w-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-800">
                {t('closing.pendingRequests.title')}
              </h3>
              <div className="mt-1 flex items-center gap-4">
                <div>
                  <span className="text-2xl font-bold text-gray-900">{pendingOnly.length}</span>
                  <span className="ml-1 text-xs text-gray-500">{t('pendingRequests.count')}</span>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div>
                  <span className="text-lg font-semibold text-gray-700">
                    {fmt(pendingTotalAmount)}
                  </span>
                  <span className="ml-1 text-xs text-gray-500">
                    {t('pendingRequests.totalAmount')}
                  </span>
                </div>
              </div>
            </div>
            <ArrowUpRight className="h-5 w-5 text-gray-400" />
          </CardContent>
        </Card>
      )}

      {/* Expense stats block */}
      <Card>
        <CardContent className="py-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Receipt className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">
                {t('closing.expenseStats.title')}
              </h3>
              <p className="text-xs text-gray-500">
                {t('closing.expenseStats.total', { count: expenseStats.total })} &middot;{' '}
                {fmt(expenseStats.totalAmount)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {/* Entrées */}
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
              <ArrowUpRight className="mx-auto mb-1 h-5 w-5 text-green-600" />
              <p className="text-xl font-bold text-green-700">{expenseStats.entries}</p>
              <p className="text-[11px] text-green-600">{t('closing.expenseStats.entries')}</p>
            </div>
            {/* Sorties */}
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
              <ArrowDownRight className="mx-auto mb-1 h-5 w-5 text-red-600" />
              <p className="text-xl font-bold text-red-700">{expenseStats.exits}</p>
              <p className="text-[11px] text-red-600">{t('closing.expenseStats.exits')}</p>
            </div>
            {/* Brouillon */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
              <FileEdit className="mx-auto mb-1 h-5 w-5 text-gray-500" />
              <p className="text-xl font-bold text-gray-700">{expenseStats.draft}</p>
              <p className="text-[11px] text-gray-500">{t('closing.expenseStats.draft')}</p>
            </div>
            {/* En attente de validation */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
              <Clock className="mx-auto mb-1 h-5 w-5 text-amber-600" />
              <p className="text-xl font-bold text-amber-700">{expenseStats.pending}</p>
              <p className="text-[11px] text-amber-600">{t('closing.expenseStats.pending')}</p>
            </div>
            {/* Validé et non payé */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
              <ShieldCheck className="mx-auto mb-1 h-5 w-5 text-blue-600" />
              <p className="text-xl font-bold text-blue-700">{expenseStats.approved}</p>
              <p className="text-[11px] text-blue-600">{t('closing.expenseStats.approved')}</p>
            </div>
            {/* Payées */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
              <Banknote className="mx-auto mb-1 h-5 w-5 text-emerald-600" />
              <p className="text-xl font-bold text-emerald-700">{expenseStats.paid}</p>
              <p className="text-[11px] text-emerald-600">{t('closing.expenseStats.paid')}</p>
            </div>
            {/* Rejetées */}
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center">
              <Ban className="mx-auto mb-1 h-5 w-5 text-rose-600" />
              <p className="text-xl font-bold text-rose-700">{expenseStats.rejected}</p>
              <p className="text-[11px] text-rose-600">{t('closing.expenseStats.rejected')}</p>
            </div>
          </div>

          {/* Paid amount breakdown */}
          {expenseStats.paidAmount > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-2">
              <Banknote className="h-4 w-4 text-gray-500" />
              <span className="text-xs text-gray-500">{t('closing.expenseStats.paidTotal')}</span>
              <span className="text-sm font-semibold text-gray-800">
                {fmt(expenseStats.paidAmount)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Open Cash Modal */}
      <Modal
        open={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        title={t('closing.openModal.title')}
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <UnlockKeyhole className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-800">
                  {t('closing.openModal.description')}
                </p>
                <p className="text-xs text-emerald-600">{t('closing.openModal.hint')}</p>
              </div>
            </div>
          </div>

          <Input
            label={t('closing.openModal.openingBalance')}
            type="number"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            placeholder="0"
          />

          {openingBalance !== '' && (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">{t('closing.openModal.preview')}</p>
              <p className="text-lg font-bold text-gray-900">{fmt(Number(openingBalance) || 0)}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowOpenModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleOpen}
              loading={openCash.isPending}
              disabled={openingBalance === ''}
            >
              <UnlockKeyhole className="mr-2 h-4 w-4" />
              {t('closing.openCash')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Lock Confirmation Modal — requires reports review */}
      <Modal
        open={showLockModal}
        onClose={() => setShowLockModal(false)}
        title={t('closing.lockModal.title')}
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {t('closing.lockModal.warning')}
                </p>
                <p className="mt-1 text-xs text-amber-600">{t('closing.lockModal.warningDesc')}</p>
              </div>
            </div>
          </div>

          {/* Step 1: Consult reports */}
          <div
            className={`rounded-lg border p-4 ${
              reportsVisited ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {reportsVisited ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Printer className="h-5 w-5 text-gray-400" />
                )}
                <div>
                  <p
                    className={`text-sm font-medium ${reportsVisited ? 'text-green-800' : 'text-gray-700'}`}
                  >
                    {t('closing.lockModal.step1')}
                  </p>
                  <p className="text-xs text-gray-500">{t('closing.lockModal.step1Desc')}</p>
                </div>
              </div>
              {!reportsVisited && (
                <Button size="sm" variant="outline" onClick={handleGoToReports}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  {t('closing.lockModal.goToReports')}
                </Button>
              )}
            </div>
          </div>

          {/* Step 2: Confirm lock */}
          <div
            className={`rounded-lg border p-4 ${
              reportsVisited
                ? 'border-gray-200 bg-gray-50'
                : 'border-gray-100 bg-gray-50/50 opacity-60'
            }`}
          >
            <div className="flex items-center gap-3">
              <LockKeyhole
                className={`h-5 w-5 ${reportsVisited ? 'text-red-500' : 'text-gray-300'}`}
              />
              <div>
                <p
                  className={`text-sm font-medium ${reportsVisited ? 'text-gray-700' : 'text-gray-400'}`}
                >
                  {t('closing.lockModal.step2')}
                </p>
                <p className="text-xs text-gray-500">{t('closing.lockModal.step2Desc')}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowLockModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmLock}
              loading={lockCash.isPending}
              disabled={!reportsVisited}
            >
              <LockKeyhole className="mr-2 h-4 w-4" />
              {t('closing.lockCash')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Movement Modal */}
      <Modal
        open={showMovementModal}
        onClose={() => setShowMovementModal(false)}
        title={t('closing.movementModal.title')}
        size="md"
      >
        <div className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('closing.movementModal.type')}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMvType('ENTRY')}
                className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  mvType === 'ENTRY'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <ArrowUpRight className="mr-1 inline h-4 w-4" />
                {t('closing.operations.entry')}
              </button>
              <button
                type="button"
                onClick={() => setMvType('EXIT')}
                className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  mvType === 'EXIT'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <ArrowDownRight className="mr-1 inline h-4 w-4" />
                {t('closing.operations.exit')}
              </button>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('closing.movementModal.category')}
            </label>
            <select
              value={mvCategory}
              onChange={(e) => setMvCategory(e.target.value as CashMovementCategory)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
            >
              <option value="SALE">{t('closing.operations.sale')}</option>
              <option value="EXPENSE">{t('closing.operations.expense')}</option>
              <option value="PAYMENT">{t('closing.operations.payment')}</option>
              <option value="ADJUSTMENT">{t('closing.operations.adjustment')}</option>
              <option value="OTHER">{t('closing.operations.other')}</option>
            </select>
          </div>

          <Input
            label={t('closing.movementModal.amount')}
            type="number"
            value={mvAmount}
            onChange={(e) => setMvAmount(e.target.value)}
            placeholder="0"
          />

          <Input
            label={t('closing.movementModal.reference')}
            value={mvReference}
            onChange={(e) => setMvReference(e.target.value)}
            placeholder={t('closing.movementModal.referencePlaceholder')}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('closing.movementModal.description')}
            </label>
            <textarea
              value={mvDescription}
              onChange={(e) => setMvDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
              placeholder={t('closing.movementModal.descriptionPlaceholder')}
            />
          </div>

          {mvAmount !== '' && (
            <div className={`rounded-lg p-3 ${mvType === 'ENTRY' ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-xs text-gray-500">{t('closing.movementModal.preview')}</p>
              <p
                className={`text-lg font-bold ${mvType === 'ENTRY' ? 'text-green-700' : 'text-red-700'}`}
              >
                {mvType === 'ENTRY' ? '+' : '−'}
                {fmt(Number(mvAmount) || 0)}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowMovementModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleAddMovement}
              loading={addMovement.isPending}
              disabled={mvAmount === '' || !mvDescription.trim()}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('closing.movementModal.add')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
