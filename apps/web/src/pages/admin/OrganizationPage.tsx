import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Briefcase, Plus, Pencil, Trash2, X } from 'lucide-react';
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useOrgServices,
  useCreateOrgService,
  useUpdateOrgService,
  useDeleteOrgService,
} from '@/hooks/useOrganization';
import { useAuthStore } from '@/stores/auth-store';
import { extractApiErrorMessage as extractErrorMessage } from '@/lib/errors';
import type { Department, OrgService } from '@/types/admin';

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
      <div className="relative w-full max-w-md rounded-md bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e0e6eb] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#0a2540]">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#697386] hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

export default function OrganizationPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuthStore();
  const canConfigure = hasPermission('user.update');

  const { data: departments = [], isLoading: loadingDepts } = useDepartments();
  const { data: services = [], isLoading: loadingServices } = useOrgServices();
  const createDept = useCreateDepartment();
  const updateDept = useUpdateDepartment();
  const deleteDept = useDeleteDepartment();
  const createSvc = useCreateOrgService();
  const updateSvc = useUpdateOrgService();
  const deleteSvc = useDeleteOrgService();

  const [deptModal, setDeptModal] = useState<{ open: boolean; edit: Department | null }>({
    open: false,
    edit: null,
  });
  const [deptName, setDeptName] = useState('');
  const [deptError, setDeptError] = useState<string | null>(null);

  const [svcModal, setSvcModal] = useState<{ open: boolean; edit: OrgService | null }>({
    open: false,
    edit: null,
  });
  const [svcName, setSvcName] = useState('');
  const [svcDeptId, setSvcDeptId] = useState('');
  const [svcError, setSvcError] = useState<string | null>(null);

  const openCreateDept = () => {
    setDeptModal({ open: true, edit: null });
    setDeptName('');
    setDeptError(null);
  };
  const openEditDept = (d: Department) => {
    setDeptModal({ open: true, edit: d });
    setDeptName(d.name);
    setDeptError(null);
  };
  const saveDept = async () => {
    if (!deptName.trim()) return;
    setDeptError(null);
    try {
      if (deptModal.edit) {
        await updateDept.mutateAsync({ id: deptModal.edit.id, name: deptName.trim() });
      } else {
        await createDept.mutateAsync(deptName.trim());
      }
      setDeptModal({ open: false, edit: null });
    } catch (err) {
      setDeptError(extractErrorMessage(err));
    }
  };

  const openCreateSvc = () => {
    setSvcModal({ open: true, edit: null });
    setSvcName('');
    setSvcDeptId(departments[0]?.id || '');
    setSvcError(null);
  };
  const openEditSvc = (s: OrgService) => {
    setSvcModal({ open: true, edit: s });
    setSvcName(s.name);
    setSvcDeptId(s.departmentId);
    setSvcError(null);
  };
  const saveSvc = async () => {
    if (!svcName.trim() || !svcDeptId) return;
    setSvcError(null);
    try {
      if (svcModal.edit) {
        await updateSvc.mutateAsync({ id: svcModal.edit.id, name: svcName.trim(), departmentId: svcDeptId });
      } else {
        await createSvc.mutateAsync({ name: svcName.trim(), departmentId: svcDeptId });
      }
    } catch (err) {
      setSvcError(extractErrorMessage(err));
      return;
    }
    setSvcModal({ open: false, edit: null });
  };

  const departmentName = (id: string) => departments.find((d) => d.id === id)?.name || '—';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#0a2540]">
          {t('admin.organization.title', 'Services & Départements')}
        </h2>
        <p className="text-sm text-[#697386]">
          {t(
            'admin.organization.subtitle',
            "Ces listes alimentent l'attribution d'un service (et de son département) à chaque utilisateur, depuis Gestion des utilisateurs.",
          )}
        </p>
      </div>

      {/* Departments */}
      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[#e0e6eb] px-4 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-[#0a2540]">
              {t('admin.organization.departments', 'Départements')}
            </h3>
          </div>
          {canConfigure && (
            <button className="btn-secondary" onClick={openCreateDept}>
              <Plus className="h-4 w-4" />
              {t('common.add', 'Ajouter')}
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <tbody>
            {!loadingDepts && departments.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-[#aab7c4]">{t('common.noData')}</td>
              </tr>
            )}
            {departments.map((d) => (
              <tr key={d.id} className="border-b border-[#f0f3f6] last:border-0">
                <td className="px-4 py-2.5 text-[#0a2540]">{d.name}</td>
                <td className="px-4 py-2.5 text-right">
                  {canConfigure && (
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => openEditDept(d)}
                        className="rounded-md p-1.5 text-[#697386] hover:bg-zinc-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteDept.mutate(d.id)}
                        className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Services */}
      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[#e0e6eb] px-4 py-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-sky-600" />
            <h3 className="text-sm font-semibold text-[#0a2540]">
              {t('admin.organization.services', 'Services')}
            </h3>
          </div>
          {canConfigure && (
            <button
              className="btn-secondary"
              onClick={openCreateSvc}
              disabled={departments.length === 0}
              title={departments.length === 0 ? t('admin.organization.needDepartmentFirst', 'Créez d\'abord un département') : undefined}
            >
              <Plus className="h-4 w-4" />
              {t('common.add', 'Ajouter')}
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#f6f9fc] text-left text-xs font-medium text-[#697386]">
            <tr>
              <th className="px-4 py-2">{t('admin.organization.services', 'Services')}</th>
              <th className="px-4 py-2">{t('admin.organization.departments', 'Départements')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!loadingServices && services.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-[#aab7c4]">
                  {t('common.noData')}
                </td>
              </tr>
            )}
            {services.map((s) => (
              <tr key={s.id} className="border-b border-[#f0f3f6] last:border-0">
                <td className="px-4 py-2.5 text-[#0a2540]">{s.name}</td>
                <td className="px-4 py-2.5 text-[#697386]">{s.department?.name || departmentName(s.departmentId)}</td>
                <td className="px-4 py-2.5 text-right">
                  {canConfigure && (
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => openEditSvc(s)}
                        className="rounded-md p-1.5 text-[#697386] hover:bg-zinc-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteSvc.mutate(s.id)}
                        className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Department modal */}
      <ModalShell
        open={deptModal.open}
        onClose={() => setDeptModal({ open: false, edit: null })}
        title={deptModal.edit ? t('admin.organization.editDepartment', 'Modifier le département') : t('admin.organization.newDepartment', 'Nouveau département')}
      >
        <div className="space-y-3">
          <div>
            <label className="label">{t('common.name', 'Nom')}</label>
            <input
              className="input"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              autoFocus
            />
          </div>
          {deptError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{deptError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setDeptModal({ open: false, edit: null })}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" onClick={saveDept} disabled={!deptName.trim()}>
              {t('common.save')}
            </button>
          </div>
        </div>
      </ModalShell>

      {/* Service modal */}
      <ModalShell
        open={svcModal.open}
        onClose={() => setSvcModal({ open: false, edit: null })}
        title={svcModal.edit ? t('admin.organization.editService', 'Modifier le service') : t('admin.organization.newService', 'Nouveau service')}
      >
        <div className="space-y-3">
          <div>
            <label className="label">{t('common.name', 'Nom')}</label>
            <input className="input" value={svcName} onChange={(e) => setSvcName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">{t('admin.organization.departments', 'Départements')}</label>
            <select className="input" value={svcDeptId} onChange={(e) => setSvcDeptId(e.target.value)}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {svcError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{svcError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setSvcModal({ open: false, edit: null })}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" onClick={saveSvc} disabled={!svcName.trim() || !svcDeptId}>
              {t('common.save')}
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
