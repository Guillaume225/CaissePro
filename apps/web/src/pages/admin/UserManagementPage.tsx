import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Shield,
  ShieldCheck,
  Pencil,
  Trash2,
  Wallet,
  Cog,
  TrendingUp,
  Building2,
  Landmark,
  FileCheck2,
  ShoppingCart,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useToggleMfa,
  useCompanies,
  useRoles,
} from '@/hooks/useAdmin';
import { useOrgServices } from '@/hooks/useOrganization';
import type { AdminUser, CreateUserDto, UpdateUserDto } from '@/types/admin';
import type { ModuleId } from '@/stores/module-store';

const PAGE_SIZE = 10;

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
  { id: 'fne', labelKey: 'modules.fne.name', icon: FileCheck2, color: 'text-teal-500' },
  {
    id: 'manager-caisse',
    labelKey: 'modules.manager-caisse.name',
    icon: Landmark,
    color: 'text-amber-500',
  },
  { id: 'admin', labelKey: 'modules.admin.name', icon: Cog, color: 'text-emerald-500' },
  { id: 'decision', labelKey: 'modules.decision.name', icon: TrendingUp, color: 'text-purple-500' },
  {
    id: 'demande-achat',
    labelKey: 'modules.demande-achat.name',
    icon: ShoppingCart,
    color: 'text-sky-500',
  },
];

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
      <div className="relative w-full max-w-lg rounded-md bg-white shadow-2xl">
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

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' | null }) {
  if (!active || !dir) return <ArrowUpDown className="h-3 w-3 text-[#aab7c4]" />;
  return dir === 'asc' ? (
    <ArrowUp className="h-3 w-3 text-[#0a2540]" />
  ) : (
    <ArrowDown className="h-3 w-3 text-[#0a2540]" />
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    admin: 'bg-[#eff6ff] text-[#1e40af]',
    manager: 'bg-[#eff6ff] text-[#1e40af]',
    cashier: 'bg-[#dcfce7] text-[#166534]',
    viewer: 'bg-amber-50 text-amber-800',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[role] || map.manager}`}>
      {ROLE_LABELS[role] || ROLE_LABELS[role.toUpperCase()] || role}
    </span>
  );
}

export default function UserManagementPage() {
  const { t } = useTranslation();
  const { data: users = [], isLoading } = useUsers();
  const { data: companies = [] } = useCompanies();
  const { data: roles = [] } = useRoles();
  const { data: orgServices = [] } = useOrgServices();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const toggleMfa = useToggleMfa();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const [sortKey, setSortKey] = useState<'firstName' | 'role' | 'lastLogin' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [page, setPage] = useState(1);

  const [form, setForm] = useState<
    CreateUserDto & {
      id?: string;
      allowedModules: ModuleId[];
      companyIds: string[];
      roleId: string;
    }
  >({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    allowedModules: ['expense'],
    companyIds: [],
    roleId: '',
  });

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir(null);
    }
    setPage(1);
  };

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const av = sortKey === 'role' ? a.roleName || a.role : a[sortKey] || '';
      const bv = sortKey === 'role' ? b.roleName || b.role : b[sortKey] || '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => {
    setEditUser(null);
    const defaultRoleId = roles.length ? roles[0].id : '';
    setForm({
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      allowedModules: ['expense'],
      companyIds: [],
      roleId: defaultRoleId,
    });
    setShowModal(true);
  };

  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    setForm({
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      password: '',
      allowedModules: u.allowedModules || ['expense'],
      companyIds: u.companyIds || [],
      roleId: u.roleId || '',
      serviceId: u.serviceId || null,
    });
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
          serviceId: form.serviceId || null,
          ...(form.allowedModules?.length ? { allowedModules: form.allowedModules } : {}),
          ...(form.companyIds?.length ? { companyIds: form.companyIds } : {}),
        };
        await updateUser.mutateAsync(dto);
      } else {
        const dto: CreateUserDto = {
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          roleId: form.roleId,
          password: form.password,
          serviceId: form.serviceId || null,
          ...(form.allowedModules?.length ? { allowedModules: form.allowedModules } : {}),
          ...(form.companyIds?.length ? { companyIds: form.companyIds } : {}),
        };
        await createUser.mutateAsync(dto);
      }
      setShowModal(false);
    } catch (err: unknown) {
      const axErr = err as {
        response?: { data?: { error?: { details?: unknown; message?: string } } };
      };
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

  const Th = ({ label, sortKeyName }: { label: string; sortKeyName: typeof sortKey }) => (
    <th
      className="cursor-pointer select-none px-3 py-2 text-left text-xs font-medium text-[#697386]"
      onClick={() => toggleSort(sortKeyName)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === sortKeyName} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0a2540]">{t('admin.users.title')}</h1>
          <p className="text-sm text-[#697386]">{t('admin.users.subtitle')}</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('admin.users.addUser')}
        </button>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.users.searchPlaceholder')}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="card animate-pulse text-sm text-[#697386]">{t('common.loading')}</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-[#e0e6eb] bg-[#f6f9fc]">
                <tr>
                  <Th label={t('admin.users.name')} sortKeyName="firstName" />
                  <Th label={t('admin.users.role')} sortKeyName="role" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                    {t('admin.users.companies')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                    {t('common.status')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">MFA</th>
                  <Th label={t('admin.users.lastLogin')} sortKeyName="lastLogin" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-[#aab7c4]">
                      {t('common.noData')}
                    </td>
                  </tr>
                )}
                {pageData.map((u, i) => (
                  <tr
                    key={u.id}
                    className={`border-b border-[#e0e6eb] ${i % 2 === 1 ? 'bg-[#fafbfc]' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold/10 text-xs font-bold text-brand-gold">
                          {u.firstName[0]}
                          {u.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-[#0a2540]">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="text-xs text-[#aab7c4]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <RoleBadge role={u.roleName || u.role} />
                    </td>
                    <td className="px-3 py-2">
                      {(u.companyNames || []).length === 0 ? (
                        <span className="text-xs text-[#aab7c4]">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(u.companyNames || []).map((name) => (
                            <span
                              key={name}
                              className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                            >
                              <Building2 className="mr-1 h-3 w-3" />
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.isActive ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#991b1b]'
                        }`}
                      >
                        {u.isActive ? t('admin.users.active') : t('admin.users.inactive')}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {u.mfaEnabled && u.mfaConfigured ? (
                        <button
                          onClick={() => handleToggleMfa(u)}
                          className="group flex items-center gap-1.5"
                          title={t('admin.users.mfaDisableTooltip')}
                        >
                          <ShieldCheck className="h-5 w-5 text-green-600 group-hover:text-red-500" />
                          <span className="text-xs font-medium text-green-700">
                            {t('admin.users.mfaActive')}
                          </span>
                        </button>
                      ) : u.mfaEnabled && !u.mfaConfigured ? (
                        <button
                          onClick={() => handleToggleMfa(u)}
                          className="group flex items-center gap-1.5"
                          title={t('admin.users.mfaDisableTooltip')}
                        >
                          <Shield className="h-5 w-5 text-amber-500 group-hover:text-red-500" />
                          <span className="text-xs font-medium text-amber-600">
                            {t('admin.users.mfaPending')}
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleMfa(u)}
                          className="group flex items-center gap-1.5 text-[#aab7c4] hover:text-brand-gold"
                          title={t('admin.users.mfaEnableTooltip')}
                        >
                          <Shield className="h-5 w-5" />
                          <span className="text-xs">{t('admin.users.mfaOff')}</span>
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#697386]">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleString('fr-FR') : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          className="rounded-md p-1.5 text-[#697386] hover:bg-zinc-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(u)}
                          className="rounded-md p-1.5 text-[#697386] hover:bg-red-50 hover:text-red-600"
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#e0e6eb] px-3 py-2 text-xs text-[#697386]">
              <span>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} sur{' '}
                {sorted.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  className="rounded p-1 hover:bg-zinc-100 disabled:opacity-40"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  className="rounded p-1 hover:bg-zinc-100 disabled:opacity-40"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      <ModalShell
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editUser ? t('admin.users.editUser') : t('admin.users.addUser')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('admin.users.firstName')}</label>
              <input
                className="input"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t('admin.users.lastName')}</label>
              <input
                className="input"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">{t('admin.users.email')}</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={!!editUser}
            />
          </div>
          {!editUser && (
            <div>
              <label className="label">{t('admin.users.password')}</label>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          )}
          <div>
            <label className="label">{t('admin.users.role')}</label>
            <select
              className="input"
              value={form.roleId}
              onChange={(e) => setForm({ ...form, roleId: e.target.value })}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {ROLE_LABELS[r.name] || r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('admin.users.service', 'Service')}</label>
            <select
              className="input"
              value={form.serviceId || ''}
              onChange={(e) => setForm({ ...form, serviceId: e.target.value || null })}
            >
              <option value="">{t('admin.users.noService', '— Aucun —')}</option>
              {orgServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.department?.name ? `(${s.department.name})` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[#aab7c4]">
              {t(
                'admin.users.serviceHint',
                "Le département est déterminé automatiquement par le service. Gérez les listes dans Admin > Configuration > Services & Départements.",
              )}
            </p>
          </div>
          {/* Module assignment */}
          <div>
            <label className="label">{t('admin.users.allowedModules')}</label>
            <p className="mb-3 text-xs text-[#aab7c4]">{t('admin.users.allowedModulesHint')}</p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_MODULES.map((mod) => {
                const checked = form.allowedModules.includes(mod.id);
                return (
                  <label
                    key={mod.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                      checked ? 'border-brand-gold bg-brand-gold/5' : 'border-zinc-200 hover:border-zinc-300'
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
                      className="h-4 w-4 rounded border-zinc-300 text-brand-gold focus:ring-brand-gold"
                    />
                    <mod.icon className={`h-4 w-4 ${mod.color}`} />
                    <span className="text-sm font-medium text-[#0a2540]">{t(mod.labelKey)}</span>
                  </label>
                );
              })}
            </div>
          </div>
          {/* Company assignment */}
          {companies.length > 0 && (
            <div>
              <label className="label">
                <Building2 className="mr-1.5 inline h-4 w-4 text-emerald-500" />
                {t('admin.users.assignedCompanies')}
              </label>
              <p className="mb-3 text-xs text-[#aab7c4]">{t('admin.users.assignedCompaniesHint')}</p>
              <select
                multiple
                className="input"
                value={form.companyIds}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                  setForm({ ...form, companyIds: selected });
                }}
                style={{ minHeight: '120px' }}
              >
                {companies
                  .filter((c) => c.isActive)
                  .map((c) => (
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
                      <span
                        key={cid}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                      >
                        {comp.name}
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              companyIds: form.companyIds.filter((id) => id !== cid),
                            })
                          }
                          className="ml-0.5 text-emerald-400 hover:text-red-500"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setShowModal(false)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary disabled:opacity-50"
              onClick={handleSubmit}
              disabled={createUser.isPending || updateUser.isPending}
            >
              {(createUser.isPending || updateUser.isPending) && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {editUser ? t('common.save') : t('common.create')}
            </button>
          </div>
        </div>
      </ModalShell>

      {/* Delete Confirmation */}
      <ModalShell
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={t('admin.users.confirmDelete')}
      >
        <p className="mb-4 text-sm text-[#697386]">
          {t('admin.users.confirmDeleteMsg', {
            name: `${confirmDelete?.firstName} ${confirmDelete?.lastName}`,
          })}
        </p>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>
            {t('common.cancel')}
          </button>
          <button
            className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
            onClick={handleDelete}
            disabled={deleteUser.isPending}
          >
            {deleteUser.isPending && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {t('common.delete')}
          </button>
        </div>
      </ModalShell>
    </div>
  );
}
