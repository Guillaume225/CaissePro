import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  X,
  Calendar,
  Filter,
  Eye,
  FileCheck2,
  AlertTriangle,
  QrCode,
  Stamp,
  Trash2,
  Loader2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { Button, Badge, Card, Stat } from '@/components/ui';
import { useFneInvoices, useStickerBalance, useBulkDeleteFneInvoices, useBulkCertifyFneInvoices } from '@/hooks/useFneInvoices';
import { formatCFA, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FneInvoiceStatus, FneInvoiceFilters } from '@/types/fne';
import ImportFneInvoicesDialog from '@/components/fne/ImportFneInvoicesDialog';
import { useModuleStore } from '@/stores/module-store';

/* ── Status config ────────────────────────────────────── */
const STATUS_CONFIG: Record<FneInvoiceStatus, { label: string; variant: 'outline' | 'success' | 'warning' | 'destructive' }> = {
  DRAFT: { label: 'Brouillon', variant: 'outline' },
  CERTIFIED: { label: 'Certifiée', variant: 'success' },
  CREDIT_NOTE: { label: 'Avoir émis', variant: 'warning' },
  ERROR: { label: 'Erreur', variant: 'destructive' },
};

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'CERTIFIED', label: 'Certifiée' },
  { value: 'CREDIT_NOTE', label: 'Avoir émis' },
  { value: 'ERROR', label: 'Erreur' },
];

export default function FneInvoiceListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const readOnly = useModuleStore((s) => s.activeModule) === 'decision';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkCertifyConfirm, setShowBulkCertifyConfirm] = useState(false);
  const [bulkCertifyResult, setBulkCertifyResult] = useState<{ certified: number; errors: Array<{ id: string; reference?: string; error: string }> } | null>(null);
  const bulkDeleteMutation = useBulkDeleteFneInvoices();
  const bulkCertifyMutation = useBulkCertifyFneInvoices();
  const [showImportDialog, setShowImportDialog] = useState(false);

  const filters: FneInvoiceFilters = useMemo(
    () => ({
      page,
      perPage: 15,
      ...(search && { search }),
      ...(statusFilter && { status: statusFilter as FneInvoiceStatus }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
    }),
    [page, search, statusFilter, dateFrom, dateTo],
  );

  const { data, isLoading } = useFneInvoices(filters);
  const { data: stickerBalance } = useStickerBalance();

  const invoices = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  const resetFilters = () => { setSearch(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1); };
  const hasActiveFilters = search || statusFilter || dateFrom || dateTo;

  const certifiedCount = invoices.filter((i) => i.status === 'CERTIFIED').length;
  const errorCount = invoices.filter((i) => i.status === 'ERROR').length;

  // Deletable = DRAFT or ERROR only
  const deletableOnPage = invoices.filter((i) => i.status === 'DRAFT' || i.status === 'ERROR');
  const allDeletableSelected = deletableOnPage.length > 0 && deletableOnPage.every((i) => selected.has(i.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allDeletableSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        deletableOnPage.forEach((i) => next.delete(i.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        deletableOnPage.forEach((i) => next.add(i.id));
        return next;
      });
    }
  };

  const handleBulkDelete = async () => {
    try {
      await bulkDeleteMutation.mutateAsync([...selected]);
      setSelected(new Set());
      setShowBulkDeleteConfirm(false);
    } catch {
      // Error shown via UI
    }
  };

  const handleBulkCertify = async () => {
    try {
      const result = await bulkCertifyMutation.mutateAsync([...selected]);
      setSelected(new Set());
      setShowBulkCertifyConfirm(false);
      if (result.errors.length > 0) {
        setBulkCertifyResult(result);
      }
    } catch {
      // Error shown via UI
    }
  };

  return (
    <div className="space-y-6">
      {/* ── KPIs ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<FileCheck2 className="h-5 w-5" />} label={t('fne.totalInvoices', 'Factures totales')} value={meta?.total ?? 0} />
        <Stat icon={<Stamp className="h-5 w-5" />} label={t('fne.certified', 'Certifiées')} value={certifiedCount} />
        <Stat icon={<AlertTriangle className="h-5 w-5" />} label={t('fne.errors', 'Erreurs')} value={errorCount} />
        <Stat icon={<QrCode className="h-5 w-5" />} label={t('fne.stickerBalance', 'Solde stickers')} value={stickerBalance ?? 0} />
      </div>

      {/* ── Low sticker warning ── */}
      {typeof stickerBalance === 'number' && stickerBalance < 10 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800">
            {t('fne.lowStickerWarning', `Attention : il ne vous reste que ${stickerBalance} sticker(s) FNE. Pensez à en acheter.`)}
          </p>
        </div>
      )}

      {/* ── Controls ── */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('fne.searchPlaceholder', 'Rechercher par référence, NCC, client...')}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 shadow-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="mr-2 h-4 w-4" /> Filtres
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="mr-2 h-4 w-4" /> {t('common.reset', 'Réinitialiser')}
              </Button>
            )}
            {!readOnly && (
            <>
            <Button variant="ghost" onClick={() => setShowImportDialog(true)}>
              <Upload className="mr-2 h-4 w-4" /> Importer
            </Button>
            <Button onClick={() => navigate('/fne/invoices/new')}>
              <Plus className="mr-2 h-4 w-4" /> {t('fne.newInvoice', 'Nouvelle facture')}
            </Button>
            </>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3 border-t border-gray-100 pt-4">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold" />
            </div>
          </div>
        )}
      </Card>

      {/* ── Bulk action bar ── */}
      {!readOnly && selected.size > 0 && (
        <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <span className="text-sm font-medium text-gray-800">
            {selected.size} facture{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBulkCertifyConfirm(true)}
            className="text-green-600 hover:text-green-700 hover:bg-green-100"
          >
            <ShieldCheck className="mr-2 h-4 w-4" /> Certifier la sélection
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBulkDeleteConfirm(true)}
            className="text-red-600 hover:text-red-700 hover:bg-red-100"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Supprimer la sélection
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} className="text-gray-600">
            <X className="mr-2 h-4 w-4" /> Désélectionner
          </Button>
        </div>
      )}

      {/* ── Table ── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                {!readOnly && (
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allDeletableSelected && deletableOnPage.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold cursor-pointer" />
                </th>
                )}
                <th className="px-4 py-3">Référence</th>
                <th className="px-4 py-3">NCC FNE</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Total TTC</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={readOnly ? 8 : 9} className="px-4 py-8 text-center text-gray-500">Chargement…</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={readOnly ? 8 : 9} className="px-4 py-8 text-center text-gray-500">{t('fne.noInvoices', 'Aucune facture FNE')}</td></tr>
              ) : invoices.map((inv) => {
                const sc = STATUS_CONFIG[inv.status];
                return (
                  <tr key={inv.id} className={cn('border-b border-gray-100 hover:bg-gray-50 cursor-pointer', !readOnly && selected.has(inv.id) && 'bg-red-50/50')}
                    onClick={() => navigate(`/fne/invoices/${inv.id}`)}>
                    {!readOnly && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {(inv.status === 'DRAFT' || inv.status === 'ERROR') ? (
                        <input type="checkbox" checked={selected.has(inv.id)}
                          onChange={() => toggleSelect(inv.id)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold cursor-pointer" />
                      ) : (
                        <span className="block h-4 w-4" />
                      )}
                    </td>
                    )}
                    <td className="px-4 py-3 font-mono text-brand-gold">
                      {inv.reference}
                      {inv.invoiceType === 'credit_note' && <Badge variant="warning" className="ml-2 text-[10px]">Avoir</Badge>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{inv.fneNcc || '—'}</td>
                    <td className="px-4 py-3 text-gray-900">{inv.clientCompanyName}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{inv.template}</Badge></td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCFA(inv.totalTtc)}</td>
                    <td className="px-4 py-3"><Badge variant={sc.variant}>{sc.label}</Badge></td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(inv.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/fne/invoices/${inv.id}`); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <span className="text-sm text-gray-500">
              Page {page} / {totalPages} — {meta?.total ?? 0} résultats
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Préc.</Button>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Suiv.</Button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Bulk delete confirmation dialog ── */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Confirmer la suppression</h3>
            <p className="mt-2 text-sm text-gray-600">
              Voulez-vous vraiment supprimer <strong>{selected.size}</strong> facture{selected.size > 1 ? 's' : ''} ?
              Cette action est irréversible.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowBulkDeleteConfirm(false)} disabled={bulkDeleteMutation.isPending}>
                Annuler
              </Button>
              <Button
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {bulkDeleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk certify confirmation dialog ── */}
      {showBulkCertifyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Certifier en masse</h3>
            <p className="mt-2 text-sm text-gray-600">
              Voulez-vous certifier <strong>{selected.size}</strong> facture{selected.size > 1 ? 's' : ''} auprès de la FNE ?
              Chaque facture certifiée consommera un sticker.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowBulkCertifyConfirm(false)} disabled={bulkCertifyMutation.isPending}>
                Annuler
              </Button>
              <Button
                onClick={handleBulkCertify}
                disabled={bulkCertifyMutation.isPending}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                {bulkCertifyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Certifier
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk certify result dialog (partial errors) ── */}
      {bulkCertifyResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Résultat de la certification</h3>
            <p className="mt-2 text-sm text-gray-600">
              <strong>{bulkCertifyResult.certified}</strong> facture{bulkCertifyResult.certified > 1 ? 's' : ''} certifiée{bulkCertifyResult.certified > 1 ? 's' : ''} avec succès.
            </p>
            {bulkCertifyResult.errors.length > 0 && (
              <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-medium text-red-800 mb-2">{bulkCertifyResult.errors.length} erreur{bulkCertifyResult.errors.length > 1 ? 's' : ''} :</p>
                <ul className="space-y-1 text-xs text-red-700">
                  {bulkCertifyResult.errors.map((e, i) => (
                    <li key={i}>• {e.reference ?? e.id} : {e.error}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setBulkCertifyResult(null)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import dialog ── */}
      <ImportFneInvoicesDialog open={showImportDialog} onClose={() => setShowImportDialog(false)} />
    </div>
  );
}
