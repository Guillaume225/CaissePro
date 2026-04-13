import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus, Shield, ShieldCheck, Pencil, Trash2, KeyRound, Wallet, ShoppingCart, Cog, TrendingUp, Building2, Landmark, FileCheck2 } from 'lucide-react';
import { Button, Input, Select, Modal, Badge, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui/DataTable';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useToggleMfa, useCompanies, useRoles } from '@/hooks/useAdmin';
import type { AdminUser, CreateUserDto, UpdateUserDto } from '@/types/admin';
import type { ModuleId } from '@/stores/module-store';

type AnyRow = Record<string, unknown>;

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  DAF: 'Directeur Administratif & Financier',
  CAISSIER_DEPENSES: 'Caissier Dépenses',
  CAISSIER_VENTE: 'Caissier Vente',
  COMMERCIAL: 'Commercial',
  COMPTABLE: 'Comptable',
  AUDITEUR: 'Auditeur',
  FACTURIER_FNE: 'Facturier FNE',
  MANAGER: 'Manager',
  CASHIER: 'Caissier',
  ACCOUNTANT: 'Comptable',
};

const ALL_MODULES: { id: ModuleId; labelKey: string; icon: typeof Wallet; color: string }[] = [
  { id: 'expense', labelKey: 'modules.expense.name', icon: Wallet, color: 'text-orange-500' },
  { id: 'sales', labelKey: 'modules.sales.name', icon: ShoppingCart, color: 'text-blue-500' },
  { id: 'fne', labelKey: 'modules.fne.name', icon: FileCheck2, color: 'text-teal-500' },
  { id: 'manager-caisse', labelKey: 'modules.manager-caisse.name', icon: Landmark, color: 'text-amber-500' },
  { id: 'admin', labelKey: 'modules.admin.name', icon: Cog, color: 'text-emerald-500' },
  { id: 'decision', labelKey: 'modules.decision.name', icon: TrendingUp, color: 'text-purple-500' },
];

export default function UserManagementPage() {
  const { t } = useTranslation();
  const { data: users = [], isLoading } = useUsers();
  const { data: companies = [] } = useCompanies();
  const { data: roles = [] } = useRoles();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const toggleMfa = useToggleMfa();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  // Form state
  const [form, setForm] = useState<CreateUserDto & { id?: string; allowedModules: ModuleId[]; companyIds: string[]; roleId: string }>(
    { email: '', firstName: '', lastName: '', password: '', allowedModules: ['expense'], companyIds: [], roleId: '' },
  );

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()),
  );

  const openCreate = () => {
    setEditUser(null);
    // Default to first role if available
    const defaultRoleId = roles.length ? roles[0].id : '';
    setForm({ email: '', firstName: '', lastName: '', password: '', allowedModules: ['expense'], companyIds: [], roleId: defaultRoleId });
    setShowModal(true);
  };

  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    setForm({ email: u.email, firstName: u.firstName, lastName: u.lastName, password: '', allowedModules: u.allowedModules || ['expense'], companyIds: u.companyIds || [], roleId: u.roleId || '' });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      if (editUser) {
        const dto: UpdateUserDto & { id: string } = {
          id: editUser.id,
          firstName: form.firstName,
          lastName: form.lastName,
          roleId: form.roleId,
        };
        if (form.allowedModules?.length) (dto as Record<string, unknown>).allowedModules = form.allowedModules;
        if (form.companyIds?.length) (dto as Record<string, unknown>).companyIds = form.companyIds;
        await updateUser.mutateAsync(dto);
      } else {
        const dto: CreateUserDto = {
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          roleId: form.roleId,
          password: form.password,
        };
        if (form.allowedModules?.length) (dto as Record<string, unknown>).allowedModules = form.allowedModules;
        if (form.companyIds?.length) (dto as Record<string, unknown>).companyIds = form.companyIds;
        await createUser.mutateAsync(dto);
      }
      setShowModal(false);
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { error?: { details?: unknown; message?: string } } } };
      const details = axErr.response?.data?.error?.details;
      const msg = axErr.response?.data?.error?.message;
      console.error('Submit error details:', details ?? msg ?? err);
      alert(JSON.stringify(details ?? msg ?? 'Unknown error', null, 2));
    }
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      await deleteUser.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    }
  };

  const handleToggleMfa = (u: AdminUser) => {
    toggleMfa.mutate({ id: u.id, enabled: !u.mfaEnabled });
  };

  const roleBadge = (role: string) => {
    const map: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
      admin: 'default', manager: 'info', cashier: 'success', viewer: 'warning',
    };
    return <Badge variant={map[role] || 'info'}>{ROLE_LABELS[role] || ROLE_LABELS[role.toUpperCase()] || role}</Badge>;
  };

  const columns: Column<AnyRow>[] = [
    {
      key: 'firstName',
      header: t('admin.users.name'),
      sortable: true,
      render: (row) => {
        const u = row as unknown as AdminUser;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold/10 text-xs font-bold text-brand-gold">
              {u.firstName[0]}{u.lastName[0]}
            </div>
            <div>
              <p className="font-medium text-gray-900">{u.firstName} {u.lastName}</p>
              <p className="text-xs text-gray-500">{u.email}</p>
            </div>
          </div>
        );
      },
    },
    { key: 'role', header: t('admin.users.role'), sortable: true, render: (row) => { const u = row as unknown as AdminUser; return roleBadge(u.roleName || u.role); } },
    {
      key: 'companyNames',
      header: t('admin.users.companies'),
      render: (row) => {
        const u = row as unknown as AdminUser;
        const names = u.companyNames || [];
        if (!names.length) return <span className="text-xs text-gray-400">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {names.map((name) => (
              <span key={name} className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                <Building2 className="mr-1 h-3 w-3" />
                {name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'isActive',
      header: t('common.status'),
      render: (row) => { const u = row as unknown as AdminUser; return (
        <Badge variant={u.isActive ? 'success' : 'destructive'}>
          {u.isActive ? t('admin.users.active') : t('admin.users.inactive')}
        </Badge>
      ); },
    },
    {
      key: 'mfaEnabled',
      header: 'MFA',
      render: (row) => {
        const u = row as unknown as AdminUser;
        if (u.mfaEnabled && u.mfaConfigured) {
          // MFA fully active
          return (
            <button
              onClick={() => handleToggleMfa(u)}
              className="group flex items-center gap-1.5 transition-colors"
              title={t('admin.users.mfaDisableTooltip')}
            >
              <ShieldCheck className="h-5 w-5 text-green-600 group-hover:text-red-500" />
              <span className="text-xs font-medium text-green-700">{t('admin.users.mfaActive')}</span>
            </button>
          );
        }
        if (u.mfaEnabled && !u.mfaConfigured) {
          // MFA enabled by admin but user hasn't configured yet
          return (
            <button
              onClick={() => handleToggleMfa(u)}
              className="group flex items-center gap-1.5 transition-colors"
              title={t('admin.users.mfaDisableTooltip')}
            >
              <Shield className="h-5 w-5 text-amber-500 group-hover:text-red-500" />
              <span className="text-xs font-medium text-amber-600">{t('admin.users.mfaPending')}</span>
            </button>
          );
        }
        // MFA disabled
        return (
          <button
            onClick={() => handleToggleMfa(u)}
            className="group flex items-center gap-1.5 text-gray-400 hover:text-brand-gold transition-colors"
            title={t('admin.users.mfaEnableTooltip')}
          >
            <Shield className="h-5 w-5" />
            <span className="text-xs">{t('admin.users.mfaOff')}</span>
          </button>
        );
      },
    },
    {
      key: 'lastLogin',
      header: t('admin.users.lastLogin'),
      sortable: true,
      render: (row) => { const u = row as unknown as AdminUser; return (
        <span className="text-xs text-gray-500">
          {u.lastLogin ? new Date(u.lastLogin).toLocaleString('fr-FR') : '—'}
        </span>
      ); },
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => { const u = row as unknown as AdminUser; return (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(u)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setConfirmDelete(u)} className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ); },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.users.title')}</h1>
          <p className="text-sm text-gray-500">{t('admin.users.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.users.addUser')}
        </Button>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.users.searchPlaceholder')}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      ) : (
        <DataTable columns={columns} data={filtered as unknown as AnyRow[]} pageSize={10} />
      )}

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editUser ? t('admin.users.editUser') : t('admin.users.addUser')} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('admin.users.firstName')} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <Input label={t('admin.users.lastName')} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <Input label={t('admin.users.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editUser} />
          {!editUser && (
            <Input label={t('admin.users.password')} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          )}
          <Select
            label={t('admin.users.role')}
            value={form.roleId}
            onChange={(e) => setForm({ ...form, roleId: e.target.value })}
            options={roles.map((r) => ({ value: r.id, label: ROLE_LABELS[r.name] || r.name }))}
          />
          {/* Module assignment */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t('admin.users.allowedModules')}
            </label>
            <p className="mb-3 text-xs text-gray-500">{t('admin.users.allowedModulesHint')}</p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_MODULES.map((mod) => {
                const checked = form.allowedModules.includes(mod.id);
                return (
                  <label
                    key={mod.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                      checked
                        ? 'border-brand-gold bg-brand-gold/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? form.allowedModules.filter((m) => m !== mod.id)
                          : [...form.allowedModules, mod.id];
                        setForm({ ...form, allowedModules: next });
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
                    />
                    <mod.icon className={`h-4 w-4 ${mod.color}`} />
                    <span className="text-sm font-medium text-gray-700">{t(mod.labelKey)}</span>
                  </label>
                );
              })}
            </div>
          </div>
          {/* Company assignment */}
          {companies.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                <Building2 className="mr-1.5 inline h-4 w-4 text-emerald-500" />
                {t('admin.users.assignedCompanies')}
              </label>
              <p className="mb-3 text-xs text-gray-500">{t('admin.users.assignedCompaniesHint')}</p>
              <select
                multiple
                value={form.companyIds}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                  setForm({ ...form, companyIds: selected });
                }}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                style={{ minHeight: '120px' }}
              >
                {companies.filter((c) => c.isActive).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              {form.companyIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.companyIds.map((cid) => {
                    const comp = companies.find((c) => c.id === cid);
                    return comp ? (
                      <span key={cid} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                        {comp.name}
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, companyIds: form.companyIds.filter((id) => id !== cid) })}
                          className="ml-0.5 text-emerald-400 hover:text-red-500"
                        >×</button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} loading={createUser.isPending || updateUser.isPending}>
              {editUser ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={t('admin.users.confirmDelete')} size="sm">
        <p className="mb-4 text-sm text-gray-600">
          {t('admin.users.confirmDeleteMsg', { name: `${confirmDelete?.firstName} ${confirmDelete?.lastName}` })}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</Button>
          <Button variant="destructive" onClick={handleDelete} loading={deleteUser.isPending}>{t('common.delete')}</Button>
        </div>
      </Modal>
    </div>
  );
}
