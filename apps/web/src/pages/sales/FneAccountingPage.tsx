import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Search,
  Calendar,
  Loader2,
  BookOpen,
  Download,
  Play,
  X,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';
import {
  useFneAccountingEntries,
  useGenerateFneAccounting,
  useDeleteAllFneAccounting,
} from '@/hooks/useFneAccounting';
import { useFneInvoices } from '@/hooks/useFneInvoices';
import { formatCFA, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GenerateEntriesResult } from '@/types/fne';

export default function FneAccountingPage() {
  useTranslation();
  const navigate = useNavigate();

  /* ── Filters ── */
  const [page, setPage] = useState(1);
  const [searchRef, setSearchRef] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading } = useFneAccountingEntries({
    page,
    perPage: 50,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    invoiceReference: searchRef || undefined,
  });
  const entries = data?.data ?? [];
  const meta = data?.meta;

  /* ── Generate dialog ── */
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateResult, setGenerateResult] = useState<GenerateEntriesResult | null>(null);

  /* ── Fetch certified invoices without entries for generation ── */
  const { data: invoicesData, isLoading: loadingInvoices } = useFneInvoices({
    status: 'CERTIFIED',
    perPage: 100,
  });
  const certifiedInvoices = invoicesData?.data ?? [];

  const generateMutation = useGenerateFneAccounting();
  const deleteAllMutation = useDeleteAllFneAccounting();

  /* ── Cancel dialog ── */
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const handleDeleteAll = async () => {
    try {
      await deleteAllMutation.mutateAsync();
      setShowCancelDialog(false);
    } catch {
      // Error shown via toast
    }
  };

  const handleGenerateAll = async () => {
    if (!certifiedInvoices.length) return;
    const ids = certifiedInvoices.map((inv) => inv.id);
    try {
      const result = await generateMutation.mutateAsync(ids);
      setGenerateResult(result);
    } catch {
      // Error shown via toast
    }
  };

  /* ── Totals row ── */
  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const e of entries) {
      debit += Number(e.debit) || 0;
      credit += Number(e.credit) || 0;
    }
    return { debit, credit };
  }, [entries]);

  /* ── Export CSV ── */
  const handleExport = () => {
    if (!entries.length) return;
    const BOM = '\uFEFF';
    const header =
      'Journal;Date;N° Compte;Libellé compte;Débit;Crédit;Libellé écriture;Référence facture;Type opération\n';
    const rows = entries
      .map((e) =>
        [
          e.journalCode,
          e.entryDate,
          e.accountNumber,
          e.accountLabel,
          Number(e.debit).toFixed(2),
          Number(e.credit).toFixed(2),
          e.label,
          e.invoiceReference,
          e.operationType,
        ].join(';'),
      )
      .join('\n');
    const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecritures-fne-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const INPUT =
    'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold';

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/fne')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Écritures comptables FNE</h1>
            <p className="text-sm text-gray-500">
              Journal des écritures générées à partir des factures certifiées
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!entries.length}>
            <Download className="mr-2 h-4 w-4" /> Exporter CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowCancelDialog(true)}
            disabled={!entries.length}
            className="text-red-600 border-red-300 hover:bg-red-50"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Annuler les écritures
          </Button>
          <Button
            onClick={() => {
              setShowGenerateDialog(true);
              setGenerateResult(null);
            }}
          >
            <Play className="mr-2 h-4 w-4" /> Générer les écritures
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchRef}
              onChange={(e) => {
                setSearchRef(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher par réf. facture..."
              className={cn(INPUT, 'pl-10')}
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className={cn(INPUT, 'max-w-[160px]')}
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className={cn(INPUT, 'max-w-[160px]')}
            />
          </div>
          {(searchRef || dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchRef('');
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
            >
              <X className="mr-1 h-4 w-4" /> Réinitialiser
            </Button>
          )}
        </div>
      </Card>

      {/* ── Table ── */}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-3">Journal</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">N° Compte</th>
              <th className="px-4 py-3">Libellé compte</th>
              <th className="px-4 py-3 text-right">Débit</th>
              <th className="px-4 py-3 text-right">Crédit</th>
              <th className="px-4 py-3">Libellé écriture</th>
              <th className="px-4 py-3">Réf. facture</th>
              <th className="px-4 py-3">Type</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-gold" />
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  <BookOpen className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  Aucune écriture comptable générée
                </td>
              </tr>
            ) : (
              <>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="text-xs font-mono">
                        {e.journalCode}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 text-xs">{formatDate(e.entryDate)}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-900 font-medium">
                      {e.accountNumber}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{e.accountLabel}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-900">
                      {Number(e.debit) > 0 ? formatCFA(e.debit) : ''}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-900">
                      {Number(e.credit) > 0 ? formatCFA(e.credit) : ''}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs max-w-[200px] truncate">
                      {e.label}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs font-mono">
                      {e.invoiceReference}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={e.operationType === 'CREDIT_NOTE' ? 'warning' : 'success'}
                        className="text-xs"
                      >
                        {e.operationType === 'CREDIT_NOTE' ? 'Avoir' : 'Vente'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td colSpan={4} className="px-4 py-3 text-right text-gray-700">
                    Total page :
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">
                    {formatCFA(totals.debit)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">
                    {formatCFA(totals.credit)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </>
            )}
          </tbody>
        </table>
      </Card>

      {/* ── Pagination ── */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Page {meta.page} / {meta.totalPages} — {meta.total} écriture{meta.total > 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* ── Generate Dialog ── */}
      {showGenerateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Générer les écritures comptables
              </h2>
              <button
                onClick={() => setShowGenerateDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!generateResult ? (
              <>
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 mb-5">
                  <p className="text-sm text-blue-800">
                    Cette action va générer les écritures comptables (journal <strong>VF</strong>)
                    pour toutes les factures certifiées qui n'ont pas encore été traitées.
                  </p>
                  <p className="text-sm text-blue-700 mt-2">
                    {loadingInvoices
                      ? 'Chargement...'
                      : `${certifiedInvoices.length} facture(s) certifiée(s) trouvée(s).`}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mb-5">
                  Pour chaque facture : Débit Client (TTC) — Crédit Ventes (HT) — Crédit TVA
                  collectée (si applicable). Les avoirs inversent les sens débit/crédit.
                </p>
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setShowGenerateDialog(false)}>
                    Annuler
                  </Button>
                  <Button
                    onClick={handleGenerateAll}
                    disabled={generateMutation.isPending || !certifiedInvoices.length}
                  >
                    {generateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Génération...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" /> Générer
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3 mb-5">
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    <p className="text-sm text-green-800">
                      <strong>{generateResult.generated}</strong> facture(s) traitée(s) avec succès.
                    </p>
                  </div>
                  {generateResult.skipped > 0 && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                      <p className="text-sm text-amber-800">
                        <strong>{generateResult.skipped}</strong> facture(s) déjà traitée(s)
                        (ignorées).
                      </p>
                    </div>
                  )}
                  {generateResult.errors.length > 0 && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                      <p className="text-sm text-red-800 font-medium mb-1">Erreurs :</p>
                      <ul className="text-xs text-red-700 space-y-1">
                        {generateResult.errors.map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setShowGenerateDialog(false)}>Fermer</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* ── Cancel All Dialog ── */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Annuler les écritures comptables
                </h2>
                <p className="text-sm text-gray-500">Cette action est irréversible</p>
              </div>
            </div>

            <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-5">
              <p className="text-sm text-red-800">
                Toutes les écritures comptables générées seront supprimées. Les factures concernées
                pourront être re-générées ultérieurement.
              </p>
              <p className="text-sm text-red-700 mt-2 font-medium">
                {meta?.total ?? entries.length} écriture(s) seront supprimée(s).
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowCancelDialog(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleDeleteAll}
                disabled={deleteAllMutation.isPending}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {deleteAllMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" /> Confirmer la suppression
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
