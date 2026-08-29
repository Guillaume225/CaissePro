import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  UserCog,
  Shield,
  Users,
  ShieldCheck,
  Building2,
  Store,
  GitBranch,
  ClipboardList,
  Printer,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react';

interface AdminNavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  color: string;
}

interface AdminNavSection {
  titleKey: string;
  items: AdminNavItem[];
}

const SECTIONS: AdminNavSection[] = [
  {
    titleKey: 'modules.admin.users_section',
    items: [
      { to: '/admin/users', labelKey: 'modules.admin.users', icon: UserCog, color: '#0a2540' },
      { to: '/admin/roles', labelKey: 'modules.admin.roles', icon: Shield, color: '#0a2540' },
      { to: '/admin/employees', labelKey: 'modules.admin.employees', icon: Users, color: '#0a2540' },
      {
        to: '/admin/security',
        labelKey: 'modules.admin.security',
        icon: ShieldCheck,
        color: '#0a2540',
      },
    ],
  },
  {
    titleKey: 'modules.admin.config_section',
    items: [
      {
        to: '/admin/companies',
        labelKey: 'modules.admin.companies',
        icon: Building2,
        color: '#0a2540',
      },
      { to: '/admin/fne-config', labelKey: 'modules.admin.fneConfig', icon: Store, color: '#0a2540' },
      {
        to: '/admin/organization',
        labelKey: 'modules.admin.organization',
        icon: Building2,
        color: '#0a2540',
      },
      {
        to: '/admin/approval-circuits',
        labelKey: 'modules.admin.approvalCircuits',
        icon: GitBranch,
        color: '#0a2540',
      },
      {
        to: '/admin/demande-achat-circuits',
        labelKey: 'modules.demande-achat.circuits',
        icon: ShoppingCart,
        color: '#0a2540',
      },
    ],
  },
  {
    titleKey: 'modules.admin.audit_section',
    items: [
      { to: '/admin/audit', labelKey: 'modules.admin.audit', icon: ClipboardList, color: '#0a2540' },
      {
        to: '/admin/report-designer',
        labelKey: 'modules.admin.reportDesigner',
        icon: Printer,
        color: '#0a2540',
      },
    ],
  },
];

function ic(Icon: AdminNavItem['icon'], color: string) {
  return <Icon size={16} strokeWidth={1.5} style={{ color }} />;
}

export function AdminTreeNav() {
  const { t } = useTranslation();

  return (
    <nav
      className="flex h-full w-[260px] flex-shrink-0 flex-col overflow-y-auto bg-[#ece9d8]"
      style={{ borderRight: '2px solid #808080', fontFamily: "'Segoe UI', Tahoma, sans-serif" }}
    >
      <NavLink
        to="/"
        className="flex items-center gap-2 px-3 py-2 text-[11px] text-[#0a2540] hover:bg-[#d4d0c8]"
        style={{ borderBottom: '1px solid #a0a0a0' }}
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        {t('modules.admin.backToApp')}
      </NavLink>

      {SECTIONS.map((section) => (
        <div key={section.titleKey} className="py-2">
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-[#697386]">
            {t(section.titleKey)}
          </div>
          {section.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 text-[11px] ${
                  isActive ? 'bg-[#316ac5] text-white' : 'text-[#0a2540] hover:bg-[#d4d0c8]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {ic(item.icon, isActive ? '#ffffff' : item.color)}
                  {t(item.labelKey)}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
