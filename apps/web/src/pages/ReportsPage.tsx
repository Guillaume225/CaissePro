import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { FileBarChart, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: 'generator', icon: FileBarChart, label: 'reports.tabs.generator' },
  { to: 'narrative', icon: Brain, label: 'reports.tabs.narrative' },
];

export default function ReportsPage() {
  const { t } = useTranslation();
  const location = useLocation();

  if (location.pathname === '/reports') {
    return <Navigate to="generator" replace />;
  }

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 pb-px">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-brand-gold text-brand-gold'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {t(label)}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
