import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit2, Trash2, ArrowLeft, Loader2, X, Check, Users } from 'lucide-react';
import {
  useFneClients,
  useCreateFneClient,
  useUpdateFneClient,
  useDeleteFneClient,
} from '@/hooks/useFneClients';
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
    clientCode: '',
    ncc: '',
    sellerName: '',
    accountCode: '',
  });

  const openNew = () => {
    setEditingClient(null);
    setForm({ companyName: '', phone: '', email: '', clientCode: '', ncc: '', sellerName: '', accountCode: '' });
    setShowModal(true);
  };

  const openEdit = (c: FneClientRecord) => {
    setEditingClient(c);
    setForm({
      companyName: c.companyName,
      phone: c.phone,
      email: c.email,
      clientCode: c.clientCode ?? '',
      ncc: c.ncc ?? '',
      sellerName: c.sellerName ?? '',
      accountCode: c.accountCode ?? '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const payload = {
      ...form,
      clientCode: form.clientCode || undefined,
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
            <h1 className="text-2xl font-bold text-gray-900">{t('fne.clients', 'Clients FNE')}</h1>
            <p className="text-sm text-gray-500">
              {t(
                'fne.clientsDesc',
                'Gérez la liste des clients pré-enregistrés pour la facturation FNE',
              )}
            </p>
          </div>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus className="h-4 w-4" /> {t('fne.addClient', 'Nouveau client')}
        </button>
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
          placeholder={t('fne.searchClients', 'Rechercher un client...')}
          className="input pl-10"
        />
      </div>

      {/* ── Table ── */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-3">Nom / Raison sociale</th>
              <th className="px-4 py-3">Code client</th>
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
                <td colSpan={8} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-gold" />
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  <Users className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  {t('fne.noClients', 'Aucun client enregistré')}
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.companyName}</td>
                  <td className="px-4 py-3 text-gray-500">{c.clientCode || '—'}</td>
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
      </div>

      {/* ── Pagination ── */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Page {meta.page} / {meta.totalPages} — {meta.total} client{meta.total > 1 ? 's' : ''}
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

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-md border border-[#e0e6eb] w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e0e6eb]">
              <h2 className="text-sm font-semibold text-[#0a2540]">
                {editingClient ? 'Modifier le client' : 'Nouveau client'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-md p-1 text-[#697386] hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Nom / Raison sociale *</label>
                  <input
                    value={form.companyName}
                    onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Code client</label>
                  <input
                    placeholder="ex: CLI001"
                    value={form.clientCode ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, clientCode: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Téléphone *</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">NCC</label>
                  <input
                    value={form.ncc ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, ncc: e.target.value }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Vendeur</label>
                  <input
                    value={form.sellerName ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, sellerName: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="label">Compte comptable</label>
                <input
                  placeholder="ex: 411000"
                  value={form.accountCode ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, accountCode: e.target.value }))}
                  className="input"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e0e6eb]">
                <button className="btn-secondary" onClick={() => setShowModal(false)}>
                  Annuler
                </button>
                <button
                  className="btn-primary disabled:opacity-50"
                  onClick={handleSave}
                  disabled={!formValid || isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> {editingClient ? 'Modifier' : 'Créer'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
