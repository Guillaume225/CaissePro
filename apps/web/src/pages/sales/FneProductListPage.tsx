import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit2, Trash2, ArrowLeft, Loader2, X, Check, Package } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import {
  useFneProducts,
  useCreateFneProduct,
  useUpdateFneProduct,
  useDeleteFneProduct,
} from '@/hooks/useFneProducts';
import { cn } from '@/lib/utils';
import { formatCFA } from '@/lib/format';
import type { FneProductRecord, CreateFneProductPayload } from '@/types/fne';

const TAX_OPTIONS = [
  { value: 'TVA', label: 'TVA 18%' },
  { value: 'TVAB', label: 'TVAB 9%' },
  { value: 'TVAC', label: 'TVAC 0% (conv.)' },
  { value: 'TVAD', label: 'TVAD 0% (légal)' },
];

export default function FneProductListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useFneProducts({ search, page, perPage: 25 });
  const products = data?.data ?? [];
  const meta = data?.meta;

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<FneProductRecord | null>(null);

  const createMutation = useCreateFneProduct();
  const updateMutation = useUpdateFneProduct();
  const deleteMutation = useDeleteFneProduct();

  /* ── Form state ── */
  const [form, setForm] = useState<CreateFneProductPayload>({
    description: '',
    reference: '',
    unitPrice: 0,
    measurementUnit: '',
    defaultTaxes: ['TVA'],
    accountCode: '',
    vatAccountCode: '',
  });

  const openNew = () => {
    setEditingProduct(null);
    setForm({
      description: '',
      reference: '',
      unitPrice: 0,
      measurementUnit: '',
      defaultTaxes: ['TVA'],
      accountCode: '',
      vatAccountCode: '',
    });
    setShowModal(true);
  };

  const openEdit = (p: FneProductRecord) => {
    setEditingProduct(p);
    setForm({
      description: p.description,
      reference: p.reference ?? '',
      unitPrice: p.unitPrice,
      measurementUnit: p.measurementUnit ?? '',
      defaultTaxes: p.defaultTaxes ?? ['TVA'],
      accountCode: p.accountCode ?? '',
      vatAccountCode: p.vatAccountCode ?? '',
    });
    setShowModal(true);
  };

  const toggleFormTax = (code: string) => {
    setForm((f) => {
      const taxes = f.defaultTaxes ?? ['TVA'];
      return {
        ...f,
        defaultTaxes: taxes.includes(code) ? taxes.filter((t) => t !== code) : [...taxes, code],
      };
    });
  };

  const handleSave = async () => {
    const payload: CreateFneProductPayload = {
      description: form.description,
      unitPrice: form.unitPrice,
      reference: form.reference || undefined,
      measurementUnit: form.measurementUnit || undefined,
      defaultTaxes: form.defaultTaxes,
      accountCode: form.accountCode || undefined,
      vatAccountCode: form.vatAccountCode || undefined,
    };
    if (editingProduct) {
      await updateMutation.mutateAsync({ id: editingProduct.id, payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const formValid = form.description && form.unitPrice > 0;

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
            <h1 className="text-2xl font-bold text-gray-900">
              {t('fne.products', 'Produits FNE')}
            </h1>
            <p className="text-sm text-gray-500">
              {t(
                'fne.productsDesc',
                'Gérez la liste des produits pré-enregistrés pour la facturation FNE',
              )}
            </p>
          </div>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> {t('fne.addProduct', 'Nouveau produit')}
        </Button>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t('fne.searchProducts', 'Rechercher un produit...')}
          className={cn(INPUT, 'pl-10')}
        />
      </div>

      {/* ── Table ── */}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Référence</th>
              <th className="px-4 py-3">Prix unit. HT</th>
              <th className="px-4 py-3">Unité</th>
              <th className="px-4 py-3">Taxes</th>
              <th className="px-4 py-3">Cpte produit</th>
              <th className="px-4 py-3">Cpte TVA</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-gold" />
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  <Package className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  {t('fne.noProducts', 'Aucun produit enregistré')}
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.description}</td>
                  <td className="px-4 py-3 text-gray-500">{p.reference || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCFA(p.unitPrice)}</td>
                  <td className="px-4 py-3 text-gray-500">{p.measurementUnit || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {(p.defaultTaxes ?? []).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.accountCode || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{p.vatAccountCode || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-gold"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* ── Pagination ── */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Page {meta.page} / {meta.totalPages} — {meta.total} produit{meta.total > 1 ? 's' : ''}
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

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Description *</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className={INPUT}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Référence</label>
                  <input
                    value={form.reference ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                    className={INPUT}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Prix unitaire HT *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.unitPrice}
                    onChange={(e) => setForm((f) => ({ ...f, unitPrice: Number(e.target.value) }))}
                    className={INPUT}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Unité de mesure</label>
                <input
                  placeholder="ex: kg, pièce, litre..."
                  value={form.measurementUnit ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, measurementUnit: e.target.value }))}
                  className={INPUT}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Compte comptable produit
                  </label>
                  <input
                    placeholder="ex: 701000"
                    value={form.accountCode ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, accountCode: e.target.value }))}
                    className={INPUT}
                  />
                </div>
                {(form.defaultTaxes ?? []).some((t) => t === 'TVA' || t === 'TVAB') && (
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Compte comptable TVA
                    </label>
                    <input
                      placeholder="ex: 445710"
                      value={form.vatAccountCode ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, vatAccountCode: e.target.value }))}
                      className={INPUT}
                    />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Taxes par défaut</label>
                <div className="flex flex-wrap gap-2">
                  {TAX_OPTIONS.map((tax) => (
                    <button
                      key={tax.value}
                      type="button"
                      onClick={() => toggleFormTax(tax.value)}
                      className={cn(
                        'rounded-md border px-3 py-1 text-xs font-medium transition-all',
                        (form.defaultTaxes ?? []).includes(tax.value)
                          ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                          : 'border-gray-300 text-gray-500 hover:border-gray-400',
                      )}
                    >
                      {tax.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <Button variant="ghost" onClick={() => setShowModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={!formValid || isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" /> {editingProduct ? 'Modifier' : 'Créer'}
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
