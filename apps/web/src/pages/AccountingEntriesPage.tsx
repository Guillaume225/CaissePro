import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  ChevronDown,
} from 'lucide-react';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  DataTable,
} from '@/components/ui';
import type { Column } from '@/components/ui/DataTable';
import {
  useAccountingEntries,
  useClosingHistory,
  useProcessAccounting,
  useCancelAccounting,
} from '@/hooks/useClosing';
import type { AccountingEntry } from '@/types/admin';
import ExcelJS from 'exceljs';

type AnyRow = Record<string, unknown>;

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'decimal' }).format(n) + ' FCFA';

export default function AccountingEntriesPage() {
  const { t } = useTranslation();

  const [selectedCashDayId, setSelectedCashDayId] = useState<string>('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: history } = useClosingHistory();
  const closedDays = (history ?? []).filter((d) => d.status === 'CLOSED');

  const filteredDays = useMemo(() => {
    if (!searchQuery.trim()) return closedDays;
    const q = searchQuery.toLowerCase();
    return closedDays.filter((day) => {
      const ref = day.reference?.toLowerCase() ?? '';
      const date = new Date(day.closedAt!).toLocaleDateString('fr-FR');
      return ref.includes(q) || date.includes(q);
    });
  }, [closedDays, searchQuery]);

  const selectedDay = closedDays.find((d) => d.id === selectedCashDayId);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: accountingSummary, isLoading: accountingLoading } = useAccountingEntries(
    !!selectedCashDayId,
    selectedCashDayId || undefined,
  );

  const processAccounting = useProcessAccounting();
  const cancelAccounting = useCancelAccounting();

  const handleExportExcel = async () => {
    if (!accountingSummary) return;

    const rows = accountingSummary.entries.map((e) => ({
      Date: e.date,
      Journal: e.journalCode,
      'N° Compte': e.accountNumber,
      'Libellé Compte': e.accountLabel,
      Débit: e.debit || '',
      Crédit: e.credit || '',
      Référence: e.reference,
      Libellé: e.label,
    }));

    rows.push({
      Date: '',
      Journal: '',
      'N° Compte': '',
      'Libellé Compte': 'TOTAUX',
      Débit: accountingSummary.totalDebit as unknown as string,
      Crédit: accountingSummary.totalCredit as unknown as string,
      Référence: '',
      Libellé: accountingSummary.isBalanced ? 'Équilibré' : 'Non équilibré',
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Écritures Comptables');

    const headers = Object.keys(rows[0]);
    ws.addRow(headers);
    for (const row of rows) {
      ws.addRow(Object.values(row));
    }

    const colWidths = [12, 8, 12, 28, 15, 15, 14, 30];
    ws.columns.forEach((col, i) => {
      col.width = colWidths[i] || 15;
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecritures-caisse-${accountingSummary.date}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleProcess = () => {
    if (!selectedCashDayId) return;
    processAccounting.mutate(selectedCashDayId);
  };

  const handleCancelProcessing = () => {
    if (!selectedCashDayId) return;
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    cancelAccounting.mutate(selectedCashDayId, {
      onSettled: () => setConfirmCancel(false),
    });
  };

  const isProcessed = !!accountingSummary?.accountingProcessed;

  const opTypeLabel: Record<string, string> = {
    SALE: t('closing.accounting.sale'),
    EXPENSE: t('closing.accounting.expense'),
    PAYMENT: t('closing.accounting.payment'),
    CLOSING_GAP: t('closing.accounting.closingGap'),
  };

  const accountingColumns: Column<Record<string, unknown>>[] = [
    {
      key: 'journalCode',
      header: t('closing.accounting.journalCode'),
      render: (r) => {
        const row = r as unknown as AccountingEntry;
        return (
          <Badge variant="default" className="text-xs">
            {row.journalCode}
          </Badge>
        );
      },
    },
    {
      key: 'accountNumber',
      header: t('closing.accounting.accountNumber'),
      render: (r) => (
        <span className="font-mono text-sm">{(r as unknown as AccountingEntry).accountNumber}</span>
      ),
    },
    {
      key: 'accountLabel',
      header: t('closing.accounting.accountLabel'),
    },
    {
      key: 'debit',
      header: t('closing.accounting.debit'),
      className: 'text-right',
      render: (r) => {
        const row = r as unknown as AccountingEntry;
        return row.debit > 0 ? (
          <span className="font-medium text-gray-900">{fmt(row.debit)}</span>
        ) : (
          <span className="text-gray-300">—</span>
        );
      },
    },
    {
      key: 'credit',
      header: t('closing.accounting.credit'),
      className: 'text-right',
      render: (r) => {
        const row = r as unknown as AccountingEntry;
        return row.credit > 0 ? (
          <span className="font-medium text-gray-900">{fmt(row.credit)}</span>
        ) : (
          <span className="text-gray-300">—</span>
        );
      },
    },
    {
      key: 'reference',
      header: t('closing.accounting.reference'),
      render: (r) => (
        <span className="text-xs text-gray-500">{(r as unknown as AccountingEntry).reference}</span>
      ),
    },
    {
      key: 'label',
      header: t('closing.accounting.label'),
      render: (r) => (
        <span className="text-sm text-gray-600">{(r as unknown as AccountingEntry).label}</span>
      ),
    },
    {
      key: 'operationType',
      header: t('closing.accounting.operationType'),
      render: (r) => {
        const row = r as unknown as AccountingEntry;
        const v: Record<string, 'success' | 'destructive' | 'info' | 'warning'> = {
          SALE: 'success',
          EXPENSE: 'destructive',
          PAYMENT: 'info',
          CLOSING_GAP: 'warning',
        };
        return (
          <Badge variant={v[row.operationType] || 'default'}>
            {opTypeLabel[row.operationType] || row.operationType}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <BookOpen className="h-6 w-6 text-brand-gold" />
          {t('closing.accounting.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t('closing.accounting.subtitle')}</p>
      </div>

      {/* Cash day selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('closing.accounting.selectCashDay')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="relative min-w-[320px] flex-1" ref={dropdownRef}>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('closing.accounting.closedCashDay')}
              </label>
              {/* Custom searchable select */}
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen((o) => !o);
                }}
                className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm shadow-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
              >
                <span className={selectedDay ? 'text-gray-900' : 'text-gray-400'}>
                  {selectedDay
                    ? `${selectedDay.reference} — ${new Date(selectedDay.closedAt!).toLocaleDateString('fr-FR')}${selectedDay.accountingProcessed ? ` ✓ ${t('closing.accounting.processed')}` : ''}`
                    : t('closing.accounting.selectPlaceholder')}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {dropdownOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                  {/* Search input */}
                  <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
                    <Search className="h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      autoFocus
                      className="w-full border-0 bg-transparent text-sm placeholder-gray-400 outline-none"
                      placeholder={t('closing.accounting.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {/* Options list */}
                  <ul className="max-h-60 overflow-y-auto py-1">
                    {filteredDays.length === 0 ? (
                      <li className="px-3 py-2 text-center text-sm text-gray-400">
                        {t('closing.accounting.noResults')}
                      </li>
                    ) : (
                      filteredDays.map((day) => (
                        <li key={day.id}>
                          <button
                            type="button"
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                              day.id === selectedCashDayId
                                ? 'bg-brand-gold/10 font-medium text-brand-gold'
                                : 'text-gray-700'
                            }`}
                            onClick={() => {
                              setSelectedCashDayId(day.id);
                              setConfirmCancel(false);
                              setDropdownOpen(false);
                              setSearchQuery('');
                            }}
                          >
                            <span>
                              {day.reference} —{' '}
                              {new Date(day.closedAt!).toLocaleDateString('fr-FR')}
                            </span>
                            {day.accountingProcessed && (
                              <Badge variant="success" className="ml-2 text-xs">
                                ✓ {t('closing.accounting.processed')}
                              </Badge>
                            )}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main card */}
      {selectedCashDayId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-brand-gold" />
              <CardTitle>{t('closing.accounting.generate')}</CardTitle>
            </div>
            <div className="flex gap-2">
              {accountingSummary && accountingSummary.entries.length > 0 && (
                <>
                  {!isProcessed ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleProcess}
                      loading={processAccounting.isPending}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {t('closing.accounting.processEntries')}
                    </Button>
                  ) : (
                    <Button
                      variant={confirmCancel ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={handleCancelProcessing}
                      loading={cancelAccounting.isPending}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      {confirmCancel
                        ? t('closing.accounting.confirmCancelProcessing')
                        : t('closing.accounting.cancelProcessing')}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleExportExcel}>
                    <Download className="mr-2 h-4 w-4" />
                    {t('closing.accounting.exportExcel')}
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {accountingLoading ? (
              <p className="py-6 text-center text-sm text-gray-400">{t('common.loading')}</p>
            ) : accountingSummary ? (
              <div className="space-y-4">
                {/* Processing status banner */}
                {isProcessed && (
                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {t('closing.accounting.processedAt', {
                        date: accountingSummary.accountingProcessedAt
                          ? new Date(accountingSummary.accountingProcessedAt).toLocaleString(
                              'fr-FR',
                            )
                          : '',
                      })}
                    </span>
                  </div>
                )}

                {/* Summary bar */}
                <div className="flex flex-wrap items-center gap-4 rounded-lg bg-gray-50 p-3">
                  {accountingSummary.cashDayReference && (
                    <div className="text-sm">
                      <span className="text-gray-500">Journée:</span>{' '}
                      <span className="font-semibold text-gray-900">
                        {accountingSummary.cashDayReference}
                      </span>
                      {accountingSummary.cashDayStatus && (
                        <Badge
                          variant={
                            accountingSummary.cashDayStatus === 'CLOSED' ? 'success' : 'warning'
                          }
                          className="ml-2 text-xs"
                        >
                          {accountingSummary.cashDayStatus}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="text-gray-500">{t('closing.accounting.totalDebit')}:</span>{' '}
                    <span className="font-semibold text-gray-900">
                      {fmt(accountingSummary.totalDebit)}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">{t('closing.accounting.totalCredit')}:</span>{' '}
                    <span className="font-semibold text-gray-900">
                      {fmt(accountingSummary.totalCredit)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {t('closing.accounting.entriesCount', {
                      count: accountingSummary.entriesCount,
                    })}
                  </div>
                  <Badge variant={accountingSummary.isBalanced ? 'success' : 'destructive'}>
                    {accountingSummary.isBalanced
                      ? t('closing.accounting.balanced')
                      : t('closing.accounting.unbalanced')}
                  </Badge>
                </div>

                {/* Warning if already processed */}
                {isProcessed && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{t('closing.accounting.alreadyProcessedWarning')}</span>
                  </div>
                )}

                <DataTable
                  columns={accountingColumns}
                  data={accountingSummary.entries as unknown as AnyRow[]}
                  pageSize={20}
                  emptyMessage={t('closing.accounting.noEntries')}
                />
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-gray-400">
                {t('closing.accounting.noEntries')}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
