import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GitBranch, Plus, Pencil, Trash2, Power, PowerOff, UserCheck } from 'lucide-react';
import { Button, Input, Modal, Badge } from '@/components/ui';
import {
  useApprovalCircuits,
  useCreateApprovalCircuit,
  useUpdateApprovalCircuit,
  useDeleteApprovalCircuit,
  useUsers,
} from '@/hooks/useAdmin';
import type { ApprovalCircuit, ApprovalCircuitStep, CreateApprovalCircuitDto } from '@/types/admin';
import { cn } from '@/lib/utils';

const ROLES = ['chef_comptable', 'responsable_rh', 'daf', 'secretaire_general', 'dg'] as const;

function formatAmount(n: number) {
  return n.toLocaleString('fr-FR') + ' FCFA';
}

export default function ApprovalCircuitPage() {
  const { t } = useTranslation();
  const { data: circuits = [], isLoading } = useApprovalCircuits();
  const { data: users = [] } = useUsers();
  const createCircuit = useCreateApprovalCircuit();
  const updateCircuit = useUpdateApprovalCircuit();
  const deleteCircuit = useDeleteApprovalCircuit();

  const [showModal, setShowModal] = useState(false);
  const [editCircuit, setEditCircuit] = useState<ApprovalCircuit | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ApprovalCircuit | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [minAmount, setMinAmount] = useState('0');
  const [maxAmount, setMaxAmount] = useState('');
  const [steps, setSteps] = useState<ApprovalCircuitStep[]>([{ level: 1, role: 'chef_comptable', approverId: '', approverName: '' }]);

  // Filter users eligible for approval (only managers)
  const eligibleUsers = users.filter((u) => u.isActive && u.role === 'manager');

  const resetForm = () => {
    setName('');
    setMinAmount('0');
    setMaxAmount('');
    setSteps([{ level: 1, role: 'chef_comptable', approverId: '', approverName: '' }]);
  };

  const openCreate = () => {
    setEditCircuit(null);
    resetForm();
    setShowModal(true);
  };

  const openEdit = (c: ApprovalCircuit) => {
    setEditCircuit(c);
    setName(c.name);
    setMinAmount(String(c.minAmount));
    setMaxAmount(c.maxAmount != null ? String(c.maxAmount) : '');
    setSteps(c.steps.length ? c.steps.map(s => ({ ...s })) : [{ level: 1, role: 'chef_comptable' as const, approverId: '', approverName: '' }]);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    const dto: CreateApprovalCircuitDto = {
      name,
      minAmount: Number(minAmount) || 0,
      maxAmount: maxAmount ? Number(maxAmount) : null,
      steps: steps.map((s, i) => ({ ...s, level: i + 1 })),
    };
    if (editCircuit) {
      await updateCircuit.mutateAsync({ id: editCircuit.id, ...dto });
    } else {
      await createCircuit.mutateAsync(dto);
    }
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      await deleteCircuit.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    }
  };

  const toggleActive = async (c: ApprovalCircuit) => {
    await updateCircuit.mutateAsync({ id: c.id, isActive: !c.isActive });
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { level: prev.length + 1, role: 'chef_comptable', approverId: '', approverName: '' }]);
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateStep = (idx: number, field: keyof ApprovalCircuitStep, value: string) => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        if (field === 'approverId') {
          const user = eligibleUsers.find((u) => u.id === value);
          return { ...s, approverId: value, approverName: user ? `${user.firstName} ${user.lastName}` : '' };
        }
        return { ...s, [field]: value };
      }),
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
            <GitBranch className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {t('admin.approvalCircuits.title')}
            </h2>
            <p className="text-sm text-slate-400">
              {t('admin.approvalCircuits.subtitle')}
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.approvalCircuits.add')}
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-slate-400">
              <th className="px-4 py-3 font-medium">{t('admin.approvalCircuits.name')}</th>
              <th className="px-4 py-3 font-medium">{t('admin.approvalCircuits.threshold')}</th>
              <th className="px-4 py-3 font-medium">{t('admin.approvalCircuits.steps')}</th>
              <th className="px-4 py-3 font-medium">{t('common.status')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {circuits.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {t('common.noData')}
                </td>
              </tr>
            )}
            {circuits.map((c) => (
              <tr key={c.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-medium text-brand-gold">{c.name}</td>
                <td className="px-4 py-3 text-slate-300">
                  {formatAmount(c.minAmount)}
                  {' → '}
                  {c.maxAmount != null ? formatAmount(c.maxAmount) : '∞'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.steps.map((s) => (
                      <Badge key={s.level} variant="info">
                        N{s.level}: {s.approverName} ({s.role})
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={c.isActive ? 'success' : 'warning'}>
                    {c.isActive
                      ? t('admin.approvalCircuits.active')
                      : t('admin.approvalCircuits.inactive')}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => toggleActive(c)}
                      className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                      title={c.isActive ? t('admin.approvalCircuits.deactivate') : t('admin.approvalCircuits.activate')}
                    >
                      {c.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => openEdit(c)}
                      className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(c)}
                      className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-red-400"
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
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editCircuit ? t('admin.approvalCircuits.edit') : t('admin.approvalCircuits.create')}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('admin.approvalCircuits.name')}
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Petit décaissement" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('admin.approvalCircuits.minAmount')}
              </label>
              <Input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                min={0}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('admin.approvalCircuits.maxAmount')}
              </label>
              <Input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder={t('admin.approvalCircuits.unlimited')}
              />
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                {t('admin.approvalCircuits.validationSteps')}
              </label>
              <button
                type="button"
                onClick={addStep}
                className="text-xs text-brand-gold hover:underline"
              >
                + {t('admin.approvalCircuits.addStep')}
              </button>
            </div>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-gold/20 text-xs font-bold text-brand-gold">
                    {idx + 1}
                  </span>
                  <select
                    value={step.role}
                    onChange={(e) => {
                      updateStep(idx, 'role', e.target.value);
                      // Reset user when role changes
                      updateStep(idx, 'approverId', '');
                    }}
                    className="w-40 shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`admin.approvalCircuits.role_${r}`)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={step.approverId}
                    onChange={(e) => updateStep(idx, 'approverId', e.target.value)}
                    className={cn(
                      'flex-1 rounded-md border px-2 py-1 text-sm',
                      step.approverId
                        ? 'border-gray-300 bg-white text-gray-900'
                        : 'border-red-400 bg-red-50 text-red-600',
                    )}
                  >
                    <option value="">{t('admin.approvalCircuits.selectUser')}</option>
                    {eligibleUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.email})
                      </option>
                    ))}
                  </select>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(idx)}
                      className="rounded p-1 text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!name.trim() || steps.some(s => !s.approverId) || createCircuit.isPending || updateCircuit.isPending}
            >
              {editCircuit ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={t('admin.approvalCircuits.deleteTitle')}
      >
        <p className="mb-4 text-sm text-gray-600">
          {t('admin.approvalCircuits.deleteConfirm', { name: confirmDelete?.name })}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteCircuit.isPending}>
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
