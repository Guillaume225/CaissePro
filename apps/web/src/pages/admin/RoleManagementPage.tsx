import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import {
  useRoles,
  usePermissions,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
} from '@/hooks/useAdmin';
import type { Role, CreateRoleDto } from '@/types/admin';

const MODULE_ORDER = ['expenses', 'sales', 'fne', 'closing', 'reports', 'admin', 'dashboard'];

function ModalShell({
  open,
  onClose,
  title,
  size = 'md',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg';
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
      <div
        className={`relative w-full rounded-md bg-white shadow-2xl ${size === 'lg' ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex items-center justify-between border-b border-[#e0e6eb] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#0a2540]">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#697386] hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">{children}</div>
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

export default function RoleManagementPage() {
  const { t } = useTranslation();
  const { data: roles = [], isLoading } = useRoles();
  const { data: allPermissions = [] } = usePermissions();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [showModal, setShowModal] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);
  const [form, setForm] = useState<CreateRoleDto>({ name: '', description: '', permissions: [] });
  const [sortKey, setSortKey] = useState<'name' | 'usersCount' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);

  const grouped = MODULE_ORDER.reduce<Record<string, { key: string; label: string }[]>>(
    (acc, mod) => {
      const perms = allPermissions.filter((p) => p.module === mod);
      if (perms.length) acc[mod] = perms;
      return acc;
    },
    {},
  );

  const openCreate = () => {
    setEditRole(null);
    setForm({ name: '', description: '', permissions: [] });
    setShowModal(true);
  };

  const openEdit = (r: Role) => {
    setEditRole(r);
    setForm({ name: r.name, description: r.description, permissions: [...r.permissions] });
    setShowModal(true);
  };

  const togglePerm = (key: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((p) => p !== key)
        : [...f.permissions, key],
    }));
  };

  const toggleModule = (mod: string) => {
    const keys = (grouped[mod] || []).map((p) => p.key);
    const allSelected = keys.every((k) => form.permissions.includes(k));
    setForm((f) => ({
      ...f,
      permissions: allSelected
        ? f.permissions.filter((p) => !keys.includes(p))
        : [...new Set([...f.permissions, ...keys])],
    }));
  };

  const handleSubmit = async () => {
    if (editRole) {
      await updateRole.mutateAsync({ id: editRole.id, ...form });
    } else {
      await createRole.mutateAsync(form);
    }
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      await deleteRole.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    }
  };

  const toggleSort = (key: 'name' | 'usersCount') => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir(null);
    }
  };

  const sortedRoles = useMemo(() => {
    if (!sortKey || !sortDir) return roles;
    return [...roles].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [roles, sortKey, sortDir]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0a2540]">{t('admin.rolesPage.title')}</h1>
          <p className="text-sm text-[#697386]">{t('admin.rolesPage.subtitle')}</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('admin.rolesPage.addRole')}
        </button>
      </div>

      {isLoading ? (
        <div className="card animate-pulse text-sm text-[#697386]">{t('common.loading')}</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-[#e0e6eb] bg-[#f6f9fc]">
                <tr>
                  <th
                    className="cursor-pointer select-none px-3 py-2 text-left text-xs font-medium text-[#697386]"
                    onClick={() => toggleSort('name')}
                  >
                    <span className="flex items-center gap-1">
                      {t('admin.rolesPage.name')}
                      <SortIcon active={sortKey === 'name'} dir={sortDir} />
                    </span>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                    {t('admin.rolesPage.description')}
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                    {t('admin.rolesPage.permissions')}
                  </th>
                  <th
                    className="cursor-pointer select-none px-3 py-2 text-left text-xs font-medium text-[#697386]"
                    onClick={() => toggleSort('usersCount')}
                  >
                    <span className="flex items-center gap-1">
                      {t('admin.rolesPage.usersCount')}
                      <SortIcon active={sortKey === 'usersCount'} dir={sortDir} />
                    </span>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[#697386]">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRoles.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-b border-[#e0e6eb] ${i % 2 === 1 ? 'bg-[#fafbfc]' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-brand-gold" />
                        <span className="font-medium text-[#0a2540]">{r.name}</span>
                        {r.isSystem && (
                          <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                            {t('admin.rolesPage.systemRole')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-[#697386]">{r.description}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-medium text-[#1e40af]">
                        {r.permissions.length} {t('admin.rolesPage.permsCount')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-[#0a2540]">{r.usersCount}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(r)}
                          className="rounded-md p-1.5 text-[#697386] hover:bg-zinc-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {!r.isSystem && (
                          <button
                            onClick={() => setConfirmDelete(r)}
                            className="rounded-md p-1.5 text-[#697386] hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ModalShell
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editRole ? t('admin.rolesPage.editRole') : t('admin.rolesPage.addRole')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('admin.rolesPage.name')}</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t('admin.rolesPage.description')}</label>
              <input
                className="input"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          <div className="card">
            <h3 className="mb-3 text-sm font-semibold text-[#0a2540]">
              {t('admin.rolesPage.permissionsGrid')}
            </h3>
            <div className="space-y-4">
              {Object.entries(grouped).map(([mod, perms]) => {
                const allChecked = perms.every((p) => form.permissions.includes(p.key));
                const someChecked = perms.some((p) => form.permissions.includes(p.key));
                return (
                  <div key={mod}>
                    <label className="mb-2 flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = someChecked && !allChecked;
                        }}
                        onChange={() => toggleModule(mod)}
                        className="h-4 w-4 rounded border-zinc-300 text-brand-gold focus:ring-brand-gold"
                      />
                      <span className="text-sm font-semibold capitalize text-[#0a2540]">{mod}</span>
                    </label>
                    <div className="ml-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {perms.map((p) => (
                        <label key={p.key} className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={form.permissions.includes(p.key)}
                            onChange={() => togglePerm(p.key)}
                            className="h-3.5 w-3.5 rounded border-zinc-300 text-brand-gold focus:ring-brand-gold"
                          />
                          <span className="text-xs text-[#697386]">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setShowModal(false)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary disabled:opacity-50"
              onClick={handleSubmit}
              disabled={createRole.isPending || updateRole.isPending}
            >
              {(createRole.isPending || updateRole.isPending) && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {editRole ? t('common.save') : t('common.create')}
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={t('admin.rolesPage.confirmDelete')}
        size="sm"
      >
        <p className="mb-4 text-sm text-[#697386]">
          {t('admin.rolesPage.confirmDeleteMsg', { name: confirmDelete?.name })}
        </p>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>
            {t('common.cancel')}
          </button>
          <button
            className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
            onClick={handleDelete}
            disabled={deleteRole.isPending}
          >
            {deleteRole.isPending && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {t('common.delete')}
          </button>
        </div>
      </ModalShell>
    </div>
  );
}
