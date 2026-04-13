import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Button,
  Input,
  Modal,
  Badge,
  DataTable,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui';
import type { Column } from '@/components/ui/DataTable';
import {
  useRoles,
  usePermissions,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
} from '@/hooks/useAdmin';
import type { Role, CreateRoleDto } from '@/types/admin';

type AnyRow = Record<string, unknown>;

const MODULE_ORDER = ['expenses', 'sales', 'fne', 'closing', 'reports', 'admin', 'dashboard'];

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

  // Group permissions by module
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

  const columns: Column<AnyRow>[] = [
    {
      key: 'name',
      header: t('admin.rolesPage.name'),
      sortable: true,
      render: (row) => {
        const r = row as unknown as Role;
        return (
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-gold" />
            <span className="font-medium text-gray-900">{r.name}</span>
            {r.isSystem && <Badge variant="outline">{t('admin.rolesPage.systemRole')}</Badge>}
          </div>
        );
      },
    },
    {
      key: 'description',
      header: t('admin.rolesPage.description'),
      render: (row) => (
        <span className="text-sm text-gray-500">{(row as unknown as Role).description}</span>
      ),
    },
    {
      key: 'permissions',
      header: t('admin.rolesPage.permissions'),
      render: (row) => (
        <Badge variant="info">
          {(row as unknown as Role).permissions.length} {t('admin.rolesPage.permsCount')}
        </Badge>
      ),
    },
    {
      key: 'usersCount',
      header: t('admin.rolesPage.usersCount'),
      sortable: true,
      render: (row) => <span className="text-sm">{(row as unknown as Role).usersCount}</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => {
        const r = row as unknown as Role;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => openEdit(r)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <Pencil className="h-4 w-4" />
            </button>
            {!r.isSystem && (
              <button
                onClick={() => setConfirmDelete(r)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.rolesPage.title')}</h1>
          <p className="text-sm text-gray-500">{t('admin.rolesPage.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.rolesPage.addRole')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      ) : (
        <DataTable columns={columns} data={roles as unknown as AnyRow[]} pageSize={10} />
      )}

      {/* Create / Edit Modal with permission grid */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editRole ? t('admin.rolesPage.editRole') : t('admin.rolesPage.addRole')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('admin.rolesPage.name')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label={t('admin.rolesPage.description')}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Permissions Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('admin.rolesPage.permissionsGrid')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(grouped).map(([mod, perms]) => {
                  const allChecked = perms.every((p) => form.permissions.includes(p.key));
                  const someChecked = perms.some((p) => form.permissions.includes(p.key));
                  return (
                    <div key={mod}>
                      <label className="flex items-center gap-2 mb-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={(el) => {
                            if (el) el.indeterminate = someChecked && !allChecked;
                          }}
                          onChange={() => toggleModule(mod)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
                        />
                        <span className="text-sm font-semibold text-gray-700 capitalize">
                          {mod}
                        </span>
                      </label>
                      <div className="ml-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {perms.map((p) => (
                          <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.permissions.includes(p.key)}
                              onChange={() => togglePerm(p.key)}
                              className="h-3.5 w-3.5 rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
                            />
                            <span className="text-xs text-gray-600">{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} loading={createRole.isPending || updateRole.isPending}>
              {editRole ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={t('admin.rolesPage.confirmDelete')}
        size="sm"
      >
        <p className="mb-4 text-sm text-gray-600">
          {t('admin.rolesPage.confirmDeleteMsg', { name: confirmDelete?.name })}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleDelete} loading={deleteRole.isPending}>
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
