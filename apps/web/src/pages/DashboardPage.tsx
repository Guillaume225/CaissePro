import { useTranslation } from 'react-i18next';
import { lazy, Suspense } from 'react';
import { useModuleStore, type ModuleId } from '@/stores/module-store';

/* ─── Lazy-loaded module dashboards ─────────────── */
const ClosingPage = lazy(() => import('./ClosingPage'));
const AdminDashboard = lazy(() => import('./dashboards/AdminDashboard'));
const DecisionDashboard = lazy(() => import('./dashboards/DecisionDashboard'));

const dashboardMap: Record<ModuleId, React.LazyExoticComponent<() => JSX.Element>> = {
  expense: ClosingPage,
  admin: AdminDashboard,
  decision: DecisionDashboard,
};

function DashboardLoader() {
  return (
    <div className="flex h-32 items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { activeModule } = useModuleStore();

  return (
    <div className="space-y-6">
      {/* Module dashboard */}
      <Suspense fallback={<DashboardLoader />}>
        {(() => {
          const ModuleDashboard = dashboardMap[activeModule];
          return ModuleDashboard ? <ModuleDashboard /> : null;
        })()}
      </Suspense>
    </div>
  );
}
