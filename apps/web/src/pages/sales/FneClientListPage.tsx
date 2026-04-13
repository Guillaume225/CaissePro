import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ArrowLeft,
  Loader2,
  X,
  Check,
  Users,
} from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';
import {
  useFneClients,
  useCreateFneClient,
  useUpdateFneClient,
  useDeleteFneClient,
} from '@/hooks/useFneClients';
import { cn } from '@/lib/utils';
import type { FneClientRecord, CreateFneClientPayload } from '@/types/fne';

export default function FneClientListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useFneClients({ search, page, perPage: 25 });
  const clients = data?.data ?? [];
  const meta = data?.meta;

  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<FneClientRecord | null>(null);

  const createMutation = useCreateFneClient();
  const updateMutation = useUpdateFneClient();
  const deleteMutation = useDeleteFneClient();

  /* ── Form state ── */
  const [form, setForm] = useState<CreateFneClientPayload>({
    companyName: '',
    phone: '',
    email: '',
    ncc: '',
    sellerName: '',
    accountCode: '',
  });

  const openNew = () => {
    setEditingClient(null);
    setForm({ companyName: '', phone: '', email: '', ncc: '', sellerName: '', accountCode: '' });
    setShowModal(true);
  };

  const openEdit = (c: FneClientRecord) => {
    setEditingClient(c);
    setForm({
      companyName: c.companyName,
      phone: c.phone,
      email: c.email,
      ncc: c.ncc ?? '',
      sellerName: c.sellerName ?? '',
      accountCode: c.accountCode ?? '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const payload = {
      ...form,
      ncc: form.ncc || undefined,
      sellerName: form.sellerName || undefined,
      accountCode: form.accountCode || undefined,
    };
    if (editingClient) {
      await updateMutation.mutateAsync({ id: editingClient.id, payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const formValid = form.companyName && form.phone && form.email;

  const INPUT = 'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold';

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
              {t('fne.clients', 'Clients FNE')}
            </h1>
            <p className="text-sm text-gray-500">
              {t('fne.clientsDesc', 'Gérez la liste des clients pré-enregistrés pour la facturation FNE')}
            </p>
          </div>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> {t('fne.addClient', 'Nouveau client')}
        </Button>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('fne.searchClients', 'Rechercher un client...')}
          className={cn(INPUT, 'pl-10')}
        />
      </div>

      {/* ── Table ── */}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-3">Nom / Raison sociale</th>
              <th className="px-4 py-3">Téléphone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">NCC</th>
              <th className="px-4 py-3">Vendeur</th>
              <th className="px-4 py-3">Compte comptable</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-gold" />
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  <Users className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  {t('fne.noClients', 'Aucun client enregistré')}
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.companyName}</td>
                  <td className="px-4 py-3 text-gray-700">{c.phone}</td>
                  <td className="px-4 py-3 text-gray-700">{c.email}</td>
                  <td className="px-4 py-3 text-gray-500">{c.ncc || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.sellerName || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.accountCode || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-gold"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
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
            Page {meta.page} / {meta.totalPages} — {meta.total} client{meta.total > 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
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
                {editingClient ? 'Modifier le client' : 'Nouveau client'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Nom / Raison sociale *</label>
                <input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} className={INPUT} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Téléphone *</label>
                  <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={INPUT} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Email *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={INPUT} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">NCC</label>
                  <input value={form.ncc ?? ''} onChange={(e) => setForm((f) => ({ ...f, ncc: e.target.value }))} className={INPUT} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Vendeur</label>
                  <input value={form.sellerName ?? ''} onChange={(e) => setForm((f) => ({ ...f, sellerName: e.target.value }))} className={INPUT} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Compte comptable</label>
                <input placeholder="ex: 411000" value={form.accountCode ?? ''} onChange={(e) => setForm((f) => ({ ...f, accountCode: e.target.value }))} className={INPUT} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button onClick={handleSave} disabled={!formValid || isSaving}>
                {isSaving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</>
                ) : (
                  <><Check className="mr-2 h-4 w-4" /> {editingClient ? 'Modifier' : 'Créer'}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
