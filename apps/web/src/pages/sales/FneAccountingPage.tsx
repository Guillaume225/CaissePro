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
  Send,
  Undo2,
} from 'lucide-react';
import {
  useFneAccountingEntries,
  useGenerateFneAccounting,
  useDeleteAllFneAccounting,
  useReversibleFneAccountingCount,
  useReverseFneAccounting,
} from '@/hooks/useFneAccounting';
import { useFneInvoices } from '@/hooks/useFneInvoices';
import { useActiveFneSetting, useUpdateCreditNoteSense } from '@/hooks/useFneSettings';
import { usePostAllToErp } from '@/hooks/useErpSettings';
import { formatCFA, formatDate } from '@/lib/format';
import type { GenerateEntriesResult } from '@/types/fne';

export default function FneAccountingPage() {
  useTranslation();
  const navigate = useNavigate();

  /* ── Filters ── */
  const [page, setPage] = useState(1);
  const [searchRef, setSearchRef] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Par défaut, ne montre que les écritures pas encore envoyées vers Sage.
  const [erpPostedFilter, setErpPostedFilter] = useState<'true' | 'false' | ''>('false');

  const { data, isLoading } = useFneAccountingEntries({
    page,
    perPage: 50,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    invoiceReference: searchRef || undefined,
    erpPosted: erpPostedFilter || undefined,
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
  const postAllToErp = usePostAllToErp();
  const { data: reversibleData } = useReversibleFneAccountingCount();
  const reverseMutation = useReverseFneAccounting();
  const reversibleCount = reversibleData?.count ?? 0;

  /* ── Credit-note sense setting ── */
  const { data: activeFneSetting } = useActiveFneSetting();
  const updateCreditNoteSense = useUpdateCreditNoteSense();
  const creditNoteSameSense = activeFneSetting?.creditNoteSameSense ?? false;

  /* ── ERP post state ── */
  const [erpResult, setErpResult] = useState<{ success: boolean; message: string } | null>(null);

  const handlePostAllToErp = async () => {
    try {
      const res = await postAllToErp.mutateAsync();
      setErpResult({
        success: res.success,
        message: res.success ? `${res.entriesPosted} écritures envoyées à Sage` : res.message,
      });
      if (res.success) setTimeout(() => setErpResult(null), 5000);
    } catch (err) {
      const detail =
        err instanceof Error && 'response' in err
          ? // Axios error: surface the backend's message if present
            ((err as { response?: { data?: { message?: string } } }).response?.data?.message ??
            err.message)
          : 'Erreur inconnue';
      setErpResult({ success: false, message: `Erreur de connexion ERP : ${detail}` });
    }
  };

  /* ── Cancel dialog ── */
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelResult, setCancelResult] = useState<{
    deleted: number;
    protected: number;
  } | null>(null);

  const handleDeleteAll = async () => {
    try {
      const result = await deleteAllMutation.mutateAsync();
      setCancelResult(result);
    } catch {
      // Error shown via toast
    }
  };

  /* ── Reverse (contre-passation) dialog ── */
  const [showReverseDialog, setShowReverseDialog] = useState(false);
  const [reverseResult, setReverseResult] = useState<{
    reversed: number;
    invoicesAffected: number;
  } | null>(null);

  const handleReverseAll = async () => {
    try {
      const result = await reverseMutation.mutateAsync();
      setReverseResult(result);
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
          <button
            className="btn-secondary disabled:opacity-50"
            onClick={handleExport}
            disabled={!entries.length}
          >
            <Download className="h-4 w-4" /> Exporter CSV
          </button>
          <button
            className="btn-secondary text-blue-600 border-blue-300 hover:bg-blue-50 disabled:opacity-50"
            onClick={handlePostAllToErp}
            disabled={!entries.length || postAllToErp.isPending}
          >
            {postAllToErp.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Comptabiliser dans Sage
          </button>
          <button
            className="btn-secondary text-red-600 border-red-300 hover:bg-red-50 disabled:opacity-50"
            onClick={() => {
              setShowCancelDialog(true);
              setCancelResult(null);
            }}
            disabled={!entries.length}
          >
            <Trash2 className="h-4 w-4" /> Annuler les écritures
          </button>
          <button
            className="btn-secondary text-amber-700 border-amber-300 hover:bg-amber-50 disabled:opacity-50"
            onClick={() => {
              setShowReverseDialog(true);
              setReverseResult(null);
            }}
            disabled={!reversibleCount}
          >
            <Undo2 className="h-4 w-4" /> Contre-passer (envoyées à Sage)
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              setShowGenerateDialog(true);
              setGenerateResult(null);
            }}
          >
            <Play className="h-4 w-4" /> Générer les écritures
          </button>
        </div>
      </div>

      {/* ── ERP post result ── */}
      {erpResult && (
        <div
          className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${
            erpResult.success
              ? 'border-green-200 bg-[#dcfce7] text-[#166534]'
              : 'border-red-200 bg-[#fee2e2] text-[#991b1b]'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{erpResult.message}</p>
          <button
            onClick={() => setErpResult(null)}
            className="shrink-0 rounded-md p-0.5 hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="card">
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
              className="input pl-10"
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
              className="input max-w-[160px]"
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
              className="input max-w-[160px]"
            />
          </div>
          <select
            value={erpPostedFilter}
            onChange={(e) => {
              setErpPostedFilter(e.target.value as 'true' | 'false' | '');
              setPage(1);
            }}
            className="input max-w-[220px]"
          >
            <option value="false">Non envoyées vers Sage</option>
            <option value="true">Déjà envoyées vers Sage</option>
            <option value="">Toutes</option>
          </select>
          {(searchRef || dateFrom || dateTo || erpPostedFilter !== 'false') && (
            <button
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-[#697386] hover:bg-zinc-100"
              onClick={() => {
                setSearchRef('');
                setDateFrom('');
                setDateTo('');
                setErpPostedFilter('false');
                setPage(1);
              }}
            >
              <X className="h-4 w-4" /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card overflow-hidden p-0">
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
              <th className="px-4 py-3">ERP</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-gold" />
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  <BookOpen className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  Aucune écriture comptable générée
                </td>
              </tr>
            ) : (
              <>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span className="rounded-full border border-zinc-300 px-2 py-0.5 font-mono text-xs font-medium text-zinc-600">
                        {e.journalCode}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 text-xs">{formatDate(e.entryDate)}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-900 font-medium">
                      {e.accountNumber}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{e.accountLabel}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-900">
                      {Number(e.debit) !== 0 ? formatCFA(e.debit) : ''}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-900">
                      {Number(e.credit) !== 0 ? formatCFA(e.credit) : ''}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs max-w-[200px] truncate">
                      {e.label}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs font-mono">
                      {e.invoiceReference}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          e.operationType === 'REVERSAL'
                            ? 'bg-purple-50 text-purple-700'
                            : e.operationType === 'CREDIT_NOTE'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-[#dcfce7] text-[#166534]'
                        }`}
                      >
                        {e.operationType === 'REVERSAL'
                          ? 'Contre-passation'
                          : e.operationType === 'CREDIT_NOTE'
                            ? 'Avoir'
                            : 'Vente'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {e.erpPosted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-0.5 text-xs font-medium text-[#166534]">
                          <CheckCircle2 className="h-3 w-3" /> Envoyé
                        </span>
                      ) : (
                        <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-500">
                          En attente
                        </span>
                      )}
                      {e.reversed && (
                        <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                          <Undo2 className="h-3 w-3" /> Contre-passée
                        </span>
                      )}
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
                  <td />
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Page {meta.page} / {meta.totalPages} — {meta.total} écriture{meta.total > 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button
              className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Précédent
            </button>
            <button
              className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* ── Generate Dialog ── */}
      {showGenerateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-md border border-[#e0e6eb] w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e0e6eb]">
              <h2 className="text-sm font-semibold text-[#0a2540]">
                Générer les écritures comptables
              </h2>
              <button
                onClick={() => setShowGenerateDialog(false)}
                className="rounded-md p-1 text-[#697386] hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              {!generateResult ? (
                <>
                  <div className="rounded-md bg-[#eff6ff] p-4 mb-5">
                    <p className="text-sm text-[#1e40af]">
                      Cette action va générer les écritures comptables (journal <strong>VF</strong>)
                      pour toutes les factures certifiées qui n'ont pas encore été traitées.
                    </p>
                    <p className="text-sm text-[#1e40af] mt-2">
                      {loadingInvoices
                        ? 'Chargement...'
                        : `${certifiedInvoices.length} facture(s) certifiée(s) trouvée(s).`}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Pour chaque facture : Débit Client (TTC) — Crédit Ventes (HT) — Crédit TVA
                    collectée (si applicable).
                  </p>
                  <label className="flex items-start gap-2 rounded-md border border-[#e0e6eb] p-3 mb-5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={creditNoteSameSense}
                      onChange={(e) => updateCreditNoteSense.mutate(e.target.checked)}
                      disabled={updateCreditNoteSense.isPending || !activeFneSetting}
                    />
                    <span className="text-xs text-gray-600">
                      <span className="font-medium text-gray-800">
                        Garder le même sens que la facture d'origine pour les avoirs
                      </span>
                      <br />
                      {creditNoteSameSense
                        ? 'Activé : les avoirs utilisent les mêmes comptes en débit/crédit que la facture, avec un montant négatif ( - ).'
                        : "Désactivé : les avoirs inversent les sens débit/crédit (comportement par défaut)."}
                    </span>
                  </label>
                  {!activeFneSetting && (
                    <p className="text-xs text-amber-600 mb-5">
                      Configurez d'abord la connexion FNE pour pouvoir modifier ce réglage.
                    </p>
                  )}
                  <div className="flex justify-end gap-3">
                    <button
                      className="btn-secondary"
                      onClick={() => setShowGenerateDialog(false)}
                    >
                      Annuler
                    </button>
                    <button
                      className="btn-primary disabled:opacity-50"
                      onClick={handleGenerateAll}
                      disabled={generateMutation.isPending || !certifiedInvoices.length}
                    >
                      {generateMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Génération...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" /> Générer
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3 mb-5">
                    <div className="flex items-center gap-2 rounded-md bg-[#dcfce7] p-3">
                      <CheckCircle2 className="h-5 w-5 text-[#166534] shrink-0" />
                      <p className="text-sm text-[#166534]">
                        <strong>{generateResult.generated}</strong> facture(s) traitée(s) avec
                        succès.
                      </p>
                    </div>
                    {generateResult.skipped > 0 && (
                      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                        <p className="text-sm text-amber-800">
                          <strong>{generateResult.skipped}</strong> facture(s) déjà traitée(s)
                          (ignorées).
                        </p>
                      </div>
                    )}
                    {generateResult.errors.length > 0 && (
                      <div className="border-l-2 border-red-400 bg-[#fee2e2] px-3 py-2 rounded-sm">
                        <p className="text-xs font-medium text-[#991b1b] mb-1">Erreurs :</p>
                        <ul className="text-xs text-[#991b1b] space-y-1">
                          {generateResult.errors.map((err, i) => (
                            <li key={i}>• {err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button className="btn-primary" onClick={() => setShowGenerateDialog(false)}>
                      Fermer
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── Cancel All Dialog ── */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-md border border-[#e0e6eb] w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e0e6eb]">
              <h2 className="text-sm font-semibold text-[#0a2540]">
                Annuler les écritures comptables
              </h2>
              <button
                onClick={() => setShowCancelDialog(false)}
                className="rounded-md p-1 text-[#697386] hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              {!cancelResult ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                      <Trash2 className="h-5 w-5 text-red-600" />
                    </div>
                    <p className="text-sm text-[#697386]">Cette action est irréversible</p>
                  </div>

                  <div className="border-l-2 border-red-400 bg-[#fee2e2] px-3 py-2 rounded-sm mb-5">
                    <p className="text-xs text-[#991b1b]">
                      Les écritures pas encore envoyées à Sage seront supprimées. Les factures
                      concernées pourront être re-générées ultérieurement.
                    </p>
                    <p className="text-xs text-[#991b1b] mt-2">
                      Les écritures déjà envoyées à Sage ne sont <strong>jamais</strong> supprimées
                      — utilisez « Contre-passer » pour les annuler.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button className="btn-secondary" onClick={() => setShowCancelDialog(false)}>
                      Annuler
                    </button>
                    <button
                      className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
                      onClick={handleDeleteAll}
                      disabled={deleteAllMutation.isPending}
                    >
                      {deleteAllMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Suppression...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" /> Confirmer la suppression
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3 mb-5">
                    <div className="flex items-center gap-2 rounded-md bg-[#dcfce7] p-3">
                      <CheckCircle2 className="h-5 w-5 text-[#166534] shrink-0" />
                      <p className="text-sm text-[#166534]">
                        <strong>{cancelResult.deleted}</strong> écriture(s) supprimée(s).
                      </p>
                    </div>
                    {cancelResult.protected > 0 && (
                      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                        <p className="text-sm text-amber-800">
                          <strong>{cancelResult.protected}</strong> écriture(s) déjà envoyée(s) à
                          Sage ont été conservée(s).
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      className="btn-primary"
                      onClick={() => setShowCancelDialog(false)}
                    >
                      Fermer
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reverse (contre-passation) Dialog ── */}
      {showReverseDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-md border border-[#e0e6eb] w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e0e6eb]">
              <h2 className="text-sm font-semibold text-[#0a2540]">
                Contre-passer les écritures envoyées à Sage
              </h2>
              <button
                onClick={() => setShowReverseDialog(false)}
                className="rounded-md p-1 text-[#697386] hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              {!reverseResult ? (
                <>
                  <div className="rounded-md bg-[#eff6ff] p-4 mb-5">
                    <p className="text-sm text-[#1e40af]">
                      Pour chaque écriture déjà envoyée à Sage, une écriture de contre-passation
                      est créée sur le même compte avec le débit et le crédit inversés. L'écriture
                      d'origine n'est pas supprimée — elle reste tracée comme « Contre-passée ».
                    </p>
                    <p className="text-sm text-[#1e40af] mt-2">
                      Les écritures de contre-passation ne sont pas envoyées à Sage
                      automatiquement — utilisez « Comptabiliser dans Sage » ensuite.
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mb-5">
                    <strong>{reversibleCount}</strong> écriture(s) envoyée(s) à Sage seront
                    contre-passées.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button className="btn-secondary" onClick={() => setShowReverseDialog(false)}>
                      Annuler
                    </button>
                    <button
                      className="btn-primary bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                      onClick={handleReverseAll}
                      disabled={reverseMutation.isPending || !reversibleCount}
                    >
                      {reverseMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Contre-passation...
                        </>
                      ) : (
                        <>
                          <Undo2 className="h-4 w-4" /> Confirmer la contre-passation
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3 mb-5">
                    <div className="flex items-center gap-2 rounded-md bg-[#dcfce7] p-3">
                      <CheckCircle2 className="h-5 w-5 text-[#166534] shrink-0" />
                      <p className="text-sm text-[#166534]">
                        <strong>{reverseResult.reversed}</strong> écriture(s) contre-passée(s) sur{' '}
                        <strong>{reverseResult.invoicesAffected}</strong> facture(s).
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button className="btn-primary" onClick={() => setShowReverseDialog(false)}>
                      Fermer
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
