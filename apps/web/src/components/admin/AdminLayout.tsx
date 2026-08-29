import { Outlet, useLocation, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { AdminTreeNav } from './AdminTreeNav';

const BREADCRUMB_LABELS: Record<string, string> = {
  '/admin/users': 'modules.admin.users',
  '/admin/roles': 'modules.admin.roles',
  '/admin/employees': 'modules.admin.employees',
  '/admin/security': 'modules.admin.security',
  '/admin/companies': 'modules.admin.companies',
  '/admin/fne-config': 'modules.admin.fneConfig',
  '/admin/approval-circuits': 'modules.admin.approvalCircuits',
  '/admin/audit': 'modules.admin.audit',
  '/admin/report-designer': 'modules.admin.reportDesigner',
};

export function AdminLayout() {
  const location = useLocation();
  const { t } = useTranslation();

  if (location.pathname === '/admin') {
    return <Navigate to="users" replace />;
  }

  const currentLabelKey = BREADCRUMB_LABELS[location.pathname];

  return (
    <div
      className="flex h-screen w-full flex-col bg-white text-[#0a2540]"
      style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif" }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 text-[11px]"
        style={{ background: '#d4d0c8', borderBottom: '1px solid #a0a0a0' }}
      >
        <Settings size={14} strokeWidth={1.5} />
        <span className="font-bold">{t('modules.admin.name')}</span>
      </div>

      <div
        className="px-3 py-1 text-[11px] text-[#697386]"
        style={{ borderBottom: '1px solid #a0a0a0', background: '#f6f9fc' }}
      >
        <Link to="/admin" className="hover:underline">
          {t('modules.admin.name')}
        </Link>
        {currentLabelKey && (
          <>
            <span className="mx-1">›</span>
            <span className="text-[#0a2540]">{t(currentLabelKey)}</span>
          </>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <AdminTreeNav />
        <main className="min-w-0 flex-1 overflow-y-auto bg-zinc-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
