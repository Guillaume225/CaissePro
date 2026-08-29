import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GitBranch, Plus, Pencil, Trash2, Power, PowerOff, X, ShieldAlert } from 'lucide-react';
import {
  usePurchaseRequestCircuits,
  useCreatePurchaseRequestCircuit,
  useUpdatePurchaseRequestCircuit,
  useDeletePurchaseRequestCircuit,
} from '@/hooks/usePurchaseRequestCircuits';
import { useUsers } from '@/hooks/useAdmin';
import { useAuthStore } from '@/stores/auth-store';
import { extractApiErrorMessage } from '@/lib/errors';
import type {
  PurchaseRequestApprovalCircuit,
  PurchaseRequestApprovalCircuitStep,
  CreatePurchaseRequestCircuitDto,
} from '@/types/demande-achat';

function formatAmount(n: number) {
  return n.toLocaleString('fr-FR') + ' FCFA';
}

function ModalShell({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-md bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e0e6eb] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#0a2540]">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#697386] hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

export default function DemandeAchatCircuitPage() {
  const { t } = useTranslation();
  const { hasPermission, user } = useAuthStore();
  const canConfigure = hasPermission('da.configure');

  const { data: circuits = [], isLoading } = usePurchaseRequestCircuits();
  const { data: users = [] } = useUsers();
  const createCircuit = useCreatePurchaseRequestCircuit();
  const updateCircuit = useUpdatePurchaseRequestCircuit();
  const deleteCircuit = useDeletePurchaseRequestCircuit();

  const [showModal, setShowModal] = useState(false);
  const [editCircuit, setEditCircuit] = useState<PurchaseRequestApprovalCircuit | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PurchaseRequestApprovalCircuit | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [minAmount, setMinAmount] = useState('0');
  const [maxAmount, setMaxAmount] = useState('');
  const [steps, setSteps] = useState<PurchaseRequestApprovalCircuitStep[]>([
    { level: 1, role: '', approverId: '', approverName: '' },
  ]);

  const eligibleUsers = users.filter((u) => u.isActive);

  const resetForm = () => {
    setName('');
    setMinAmount('0');
    setMaxAmount('');
    setSteps([{ level: 1, role: '', approverId: '', approverName: '' }]);
  };

  const openCreate = () => {
    setEditCircuit(null);
    resetForm();
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (c: PurchaseRequestApprovalCircuit) => {
    setEditCircuit(c);
    setName(c.name);
    setMinAmount(String(c.minAmount));
    setMaxAmount(c.maxAmount != null ? String(c.maxAmount) : '');
    setSteps(
      c.steps.length ? c.steps.map((s) => ({ ...s })) : [{ level: 1, role: '', approverId: '', approverName: '' }],
    );
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    const dto: CreatePurchaseRequestCircuitDto = {
      name,
      minAmount: Number(minAmount) || 0,
      maxAmount: maxAmount ? Number(maxAmount) : null,
      steps: steps.map((s, i) => ({
        level: i + 1,
        role: s.role,
        approverId: s.approverId || null,
        approverName: s.approverName || undefined,
      })),
    };
    setFormError(null);
    try {
      if (editCircuit) {
        await updateCircuit.mutateAsync({ id: editCircuit.id, ...dto });
      } else {
        await createCircuit.mutateAsync(dto);
      }
    } catch (err) {
      setFormError(extractApiErrorMessage(err));
      return;
    }
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      await deleteCircuit.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    }
  };

  const toggleActive = async (c: PurchaseRequestApprovalCircuit) => {
    await updateCircuit.mutateAsync({ id: c.id, isActive: !c.isActive });
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { level: prev.length + 1, role: '', approverId: '', approverName: '' }]);
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateStep = (idx: number, field: keyof PurchaseRequestApprovalCircuitStep, value: string) => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        if (field === 'approverId') {
          const u = eligibleUsers.find((u2) => u2.id === value);
          return { ...s, approverId: value, approverName: u ? `${u.firstName} ${u.lastName}` : '' };
        }
        return { ...s, [field]: value };
      }),
    );
  };

  if (!canConfigure && user?.role !== 'admin') {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-[#aab7c4]" />
        <p className="text-sm text-[#697386]">{t('demandeAchat.circuits.accessDenied')}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50">
            <GitBranch className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#0a2540]">{t('demandeAchat.circuits.title')}</h2>
            <p className="text-sm text-[#697386]">{t('demandeAchat.circuits.subtitle')}</p>
          </div>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('demandeAchat.circuits.add')}
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-[#e0e6eb] bg-[#f6f9fc]">
            <tr className="text-left text-xs font-medium text-[#697386]">
              <th className="px-4 py-3">{t('demandeAchat.circuits.name')}</th>
              <th className="px-4 py-3">{t('demandeAchat.circuits.threshold')}</th>
              <th className="px-4 py-3">{t('demandeAchat.circuits.steps')}</th>
              <th className="px-4 py-3">{t('common.status')}</th>
              <th className="px-4 py-3 text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {circuits.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#aab7c4]">
                  {t('common.noData')}
                </td>
              </tr>
            )}
            {circuits.map((c, i) => (
              <tr key={c.id} className={`border-b border-[#e0e6eb] ${i % 2 === 1 ? 'bg-[#fafbfc]' : ''}`}>
                <td className="px-4 py-3 font-medium text-brand-gold">{c.name}</td>
                <td className="px-4 py-3 text-[#697386]">
                  {formatAmount(c.minAmount)}
                  {' → '}
                  {c.maxAmount != null ? formatAmount(c.maxAmount) : '∞'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.steps.map((s) => (
                      <span
                        key={s.level}
                        className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-medium text-[#1e40af]"
                      >
                        N{s.level}: {s.approverName || s.role || '—'}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.isActive ? 'bg-[#dcfce7] text-[#166534]' : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {c.isActive ? t('demandeAchat.circuits.active') : t('demandeAchat.circuits.inactive')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => toggleActive(c)}
                      className="rounded p-1.5 text-[#697386] hover:bg-zinc-100"
                      title={c.isActive ? t('demandeAchat.circuits.deactivate') : t('demandeAchat.circuits.activate')}
                    >
                      {c.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </button>
                    <button onClick={() => openEdit(c)} className="rounded p-1.5 text-[#697386] hover:bg-zinc-100">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(c)}
                      className="rounded p-1.5 text-[#697386] hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      <ModalShell
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editCircuit ? t('demandeAchat.circuits.edit') : t('demandeAchat.circuits.create')}
      >
        <div className="space-y-4">
          <div>
            <label className="label">{t('demandeAchat.circuits.name')}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Achats standards" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('demandeAchat.circuits.minAmount')}</label>
              <input className="input" type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} min={0} />
            </div>
            <div>
              <label className="label">{t('demandeAchat.circuits.maxAmount')}</label>
              <input
                className="input"
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder={t('demandeAchat.circuits.unlimited')}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="label mb-0">{t('demandeAchat.circuits.validationSteps')}</label>
              <button type="button" onClick={addStep} className="text-xs text-brand-gold hover:underline">
                + {t('demandeAchat.circuits.addStep')}
              </button>
            </div>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-md border border-[#e0e6eb] bg-[#f6f9fc] p-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-gold/20 text-xs font-bold text-brand-gold">
                    {idx + 1}
                  </span>
                  <input
                    value={step.role}
                    onChange={(e) => updateStep(idx, 'role', e.target.value)}
                    placeholder={t('demandeAchat.circuits.rolePlaceholder')}
                    className="input w-40 shrink-0 py-1"
                  />
                  <select
                    value={step.approverId ?? ''}
                    onChange={(e) => updateStep(idx, 'approverId', e.target.value)}
                    className={`input flex-1 py-1 ${!step.approverId ? 'border-red-400 bg-red-50' : ''}`}
                  >
                    <option value="">{t('demandeAchat.circuits.selectUser')}</option>
                    {eligibleUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.email})
                      </option>
                    ))}
                  </select>
                  {steps.length > 1 && (
                    <button type="button" onClick={() => removeStep(idx)} className="rounded p-1 text-[#697386] hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {formError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setShowModal(false)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary disabled:opacity-50"
              onClick={handleSubmit}
              disabled={
                !name.trim() ||
                steps.some((s) => !s.approverId) ||
                createCircuit.isPending ||
                updateCircuit.isPending
              }
            >
              {editCircuit ? t('common.save') : t('common.create')}
            </button>
          </div>
        </div>
      </ModalShell>

      {/* Delete Confirmation */}
      <ModalShell open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={t('demandeAchat.circuits.deleteTitle')}>
        <p className="mb-4 text-sm text-[#697386]">
          {t('demandeAchat.circuits.deleteConfirm', { name: confirmDelete?.name })}
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>
            {t('common.cancel')}
          </button>
          <button
            className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
            onClick={handleDelete}
            disabled={deleteCircuit.isPending}
          >
            {t('common.delete')}
          </button>
        </div>
      </ModalShell>
    </div>
  );
}
