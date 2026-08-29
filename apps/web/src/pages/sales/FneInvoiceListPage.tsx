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
import {
  useFneInvoices,
  useStickerBalance,
  useBulkDeleteFneInvoices,
  useBulkCertifyFneInvoices,
} from '@/hooks/useFneInvoices';
import { formatCFA, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FneInvoiceStatus, FneInvoiceFilters } from '@/types/fne';
import ImportFneInvoicesDialog from '@/components/fne/ImportFneInvoicesDialog';
import { useModuleStore } from '@/stores/module-store';

/* ── Status config ────────────────────────────────────── */
const STATUS_CONFIG: Record<FneInvoiceStatus, { label: string; classes: string }> = {
  DRAFT: { label: 'Brouillon', classes: 'border border-zinc-300 text-zinc-600' },
  CERTIFIED: { label: 'Certifiée', classes: 'bg-[#dcfce7] text-[#166534]' },
  CREDIT_NOTE: { label: 'Avoir émis', classes: 'bg-amber-50 text-amber-800' },
  ERROR: { label: 'Erreur', classes: 'bg-[#fee2e2] text-[#991b1b]' },
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
  const [bulkCertifyResult, setBulkCertifyResult] = useState<{
    certified: number;
    errors: Array<{ id: string; reference?: string; error: string }>;
  } | null>(null);
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

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };
  const hasActiveFilters = search || statusFilter || dateFrom || dateTo;

  const certifiedCount = invoices.filter((i) => i.status === 'CERTIFIED').length;
  const errorCount = invoices.filter((i) => i.status === 'ERROR').length;

  // Deletable = DRAFT or ERROR only
  const deletableOnPage = invoices.filter((i) => i.status === 'DRAFT' || i.status === 'ERROR');
  const allDeletableSelected =
    deletableOnPage.length > 0 && deletableOnPage.every((i) => selected.has(i.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
        <StatTile
          icon={<FileCheck2 className="h-5 w-5" />}
          label={t('fne.totalInvoices', 'Factures totales')}
          value={meta?.total ?? 0}
        />
        <StatTile
          icon={<Stamp className="h-5 w-5" />}
          label={t('fne.certified', 'Certifiées')}
          value={certifiedCount}
        />
        <StatTile
          icon={<AlertTriangle className="h-5 w-5" />}
          label={t('fne.errors', 'Erreurs')}
          value={errorCount}
        />
        <StatTile
          icon={<QrCode className="h-5 w-5" />}
          label={t('fne.stickerBalance', 'Solde stickers')}
          value={stickerBalance ?? 0}
        />
      </div>

      {/* ── Low sticker warning ── */}
      {typeof stickerBalance === 'number' && stickerBalance < 10 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800">
            {t(
              'fne.lowStickerWarning',
              `Attention : il ne vous reste que ${stickerBalance} sticker(s) FNE. Pensez à en acheter.`,
            )}
          </p>
        </div>
      )}

      {/* ── Controls ── */}
      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t('fne.searchPlaceholder', 'Rechercher par référence, NCC, client...')}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 shadow-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
            />
          </div>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-[#697386] hover:bg-zinc-100"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" /> Filtres
            </button>
            {hasActiveFilters && (
              <button
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-[#697386] hover:bg-zinc-100"
                onClick={resetFilters}
              >
                <X className="h-4 w-4" /> {t('common.reset', 'Réinitialiser')}
              </button>
            )}
            {!readOnly && (
              <>
                <button className="btn-secondary" onClick={() => setShowImportDialog(true)}>
                  <Upload className="h-4 w-4" /> Importer
                </button>
                <button className="btn-primary" onClick={() => navigate('/fne/invoices/new')}>
                  <Plus className="h-4 w-4" /> {t('fne.newInvoice', 'Nouvelle facture')}
                </button>
              </>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3 border-t border-[#e0e6eb] pt-4">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
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
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Bulk action bar ── */}
      {!readOnly && selected.size > 0 && (
        <div className="flex items-center gap-4 rounded-md border border-[#e0e6eb] bg-zinc-50 px-4 py-3">
          <span className="text-sm font-medium text-[#0a2540]">
            {selected.size} facture{selected.size > 1 ? 's' : ''} sélectionnée
            {selected.size > 1 ? 's' : ''}
          </span>
          <button
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-green-600 hover:bg-green-100"
            onClick={() => setShowBulkCertifyConfirm(true)}
          >
            <ShieldCheck className="h-4 w-4" /> Certifier la sélection
          </button>
          <button
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-100"
            onClick={() => setShowBulkDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4" /> Supprimer la sélection
          </button>
          <button
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-[#697386] hover:bg-zinc-100"
            onClick={() => setSelected(new Set())}
          >
            <X className="h-4 w-4" /> Désélectionner
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                {!readOnly && (
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allDeletableSelected && deletableOnPage.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold cursor-pointer"
                    />
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
                <tr>
                  <td colSpan={readOnly ? 8 : 9} className="px-4 py-8 text-center text-gray-500">
                    Chargement…
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 8 : 9} className="px-4 py-8 text-center text-gray-500">
                    {t('fne.noInvoices', 'Aucune facture FNE')}
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const sc = STATUS_CONFIG[inv.status];
                  return (
                    <tr
                      key={inv.id}
                      className={cn(
                        'border-b border-gray-100 hover:bg-gray-50 cursor-pointer',
                        !readOnly && selected.has(inv.id) && 'bg-red-50/50',
                      )}
                      onClick={() => navigate(`/fne/invoices/${inv.id}`)}
                    >
                      {!readOnly && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {inv.status === 'DRAFT' || inv.status === 'ERROR' ? (
                            <input
                              type="checkbox"
                              checked={selected.has(inv.id)}
                              onChange={() => toggleSelect(inv.id)}
                              className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold cursor-pointer"
                            />
                          ) : (
                            <span className="block h-4 w-4" />
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono text-brand-gold">
                        {inv.reference}
                        {inv.invoiceType === 'credit_note' && (
                          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            Avoir
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{inv.fneNcc || '—'}</td>
                      <td className="px-4 py-3 text-gray-900">{inv.clientCompanyName}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-600">
                          {inv.template}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCFA(inv.totalTtc)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${sc.classes}`}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(inv.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          className="rounded-md p-1.5 text-[#697386] hover:bg-zinc-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/fne/invoices/${inv.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
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
              <button
                className="rounded-md px-3 py-1.5 text-sm text-[#697386] hover:bg-zinc-100 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Préc.
              </button>
              <button
                className="rounded-md px-3 py-1.5 text-sm text-[#697386] hover:bg-zinc-100 disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Suiv.
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bulk delete confirmation dialog ── */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-md border border-[#e0e6eb] w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e0e6eb]">
              <h3 className="text-sm font-semibold text-[#0a2540]">Confirmer la suppression</h3>
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="rounded-md p-1 text-[#697386] hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-[#697386]">
                Voulez-vous vraiment supprimer <strong>{selected.size}</strong> facture
                {selected.size > 1 ? 's' : ''} ? Cette action est irréversible.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  className="btn-secondary disabled:opacity-50"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  disabled={bulkDeleteMutation.isPending}
                >
                  Annuler
                </button>
                <button
                  className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                >
                  {bulkDeleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk certify confirmation dialog ── */}
      {showBulkCertifyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-md border border-[#e0e6eb] w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e0e6eb]">
              <h3 className="text-sm font-semibold text-[#0a2540]">Certifier en masse</h3>
              <button
                onClick={() => setShowBulkCertifyConfirm(false)}
                className="rounded-md p-1 text-[#697386] hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-[#697386]">
                Voulez-vous certifier <strong>{selected.size}</strong> facture
                {selected.size > 1 ? 's' : ''} auprès de la FNE ? Chaque facture certifiée
                consommera un sticker.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  className="btn-secondary disabled:opacity-50"
                  onClick={() => setShowBulkCertifyConfirm(false)}
                  disabled={bulkCertifyMutation.isPending}
                >
                  Annuler
                </button>
                <button
                  className="btn-primary bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  onClick={handleBulkCertify}
                  disabled={bulkCertifyMutation.isPending}
                >
                  {bulkCertifyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  Certifier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk certify result dialog (partial errors) ── */}
      {bulkCertifyResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-md border border-[#e0e6eb] w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e0e6eb]">
              <h3 className="text-sm font-semibold text-[#0a2540]">Résultat de la certification</h3>
              <button
                onClick={() => setBulkCertifyResult(null)}
                className="rounded-md p-1 text-[#697386] hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-[#697386]">
                <strong>{bulkCertifyResult.certified}</strong> facture
                {bulkCertifyResult.certified > 1 ? 's' : ''} certifiée
                {bulkCertifyResult.certified > 1 ? 's' : ''} avec succès.
              </p>
              {bulkCertifyResult.errors.length > 0 && (
                <div className="mt-3 max-h-48 overflow-y-auto rounded-sm border-l-2 border-red-400 bg-[#fee2e2] p-3">
                  <p className="text-xs font-medium text-[#991b1b] mb-2">
                    {bulkCertifyResult.errors.length} erreur
                    {bulkCertifyResult.errors.length > 1 ? 's' : ''} :
                  </p>
                  <ul className="space-y-1 text-xs text-[#991b1b]">
                    {bulkCertifyResult.errors.map((e, i) => (
                      <li key={i}>
                        • {e.reference ?? e.id} : {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-6 flex justify-end">
                <button className="btn-primary" onClick={() => setBulkCertifyResult(null)}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Import dialog ── */}
      <ImportFneInvoicesDialog open={showImportDialog} onClose={() => setShowImportDialog(false)} />
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="card flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-[#697386]">{label}</p>
        <p className="mt-1 text-2xl font-bold text-[#0a2540]">{value}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gold/10 text-brand-gold">
        {icon}
      </div>
    </div>
  );
}
