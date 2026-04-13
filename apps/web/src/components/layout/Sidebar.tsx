import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Receipt,
  FileText,
  CreditCard,
  ShoppingBag,
  Users,
  Lock,
  TrendingUp,
  BarChart3,
  UserCog,
  Shield,
  ShieldCheck,
  FolderTree,
  Cog,
  ClipboardList,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  ChevronsUpDown,
  Wallet,
  BookOpen,
  Building2,
  GitBranch,
  History,
  FileSignature,
  FileCheck2,
  Landmark,
  BadgeDollarSign,
  Printer,
  Store,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useCashState } from '@/hooks/useClosing';
import { useAuthStore } from '@/stores/auth-store';
import { useTabStore } from '@/stores/tab-store';
import { useModuleStore, type ModuleId } from '@/stores/module-store';
import { useState, useMemo, useEffect } from 'react';

/* ─── Types ─────────────────────────────────────── */
interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

interface ModuleDef {
  id: ModuleId;
  labelKey: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  sections: NavSection[];
}

/* ─── Module definitions ────────────────────────── */
const modules: ModuleDef[] = [
  {
    id: 'expense',
    labelKey: 'modules.expense.name',
    icon: Wallet,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/15',
    sections: [
      {
        titleKey: 'modules.expense.overview',
        items: [
          { to: '/', labelKey: 'nav.closing', icon: Lock },
          { to: '/pending-requests', labelKey: 'nav.pendingRequests', icon: FileSignature },
        ],
      },
      {
        titleKey: 'modules.expense.operations',
        items: [
          { to: '/expenses', labelKey: 'modules.expense.list', icon: Receipt },
          { to: '/expenses/new', labelKey: 'modules.expense.new', icon: FileText },
        ],
      },
      {
        titleKey: 'modules.expense.tracking',
        items: [
          { to: '/expenses/cash-reports', labelKey: 'modules.expense.cashReports', icon: Printer },
          { to: '/notifications', labelKey: 'nav.notifications', icon: Bell },
        ],
      },
    ],
  },

  {
    id: 'fne',
    labelKey: 'modules.fne.name',
    icon: FileCheck2,
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/15',
    sections: [
      {
        titleKey: 'modules.fne.overview',
        items: [
          { to: '/fne', labelKey: 'modules.fne.dashboard', icon: LayoutDashboard },
        ],
      },
      {
        titleKey: 'modules.fne.operations',
        items: [
          { to: '/fne/invoices', labelKey: 'modules.fne.list', icon: FileText },
          { to: '/fne/invoices/new', labelKey: 'modules.fne.new', icon: CreditCard },
          { to: '/fne/clients', labelKey: 'modules.fne.clients', icon: Users },
          { to: '/fne/products', labelKey: 'modules.fne.products', icon: ShoppingBag },
          { to: '/fne/accounting', labelKey: 'modules.fne.accounting', icon: BookOpen },
        ],
      },
      {
        titleKey: 'modules.fne.tracking',
        items: [
          { to: '/notifications', labelKey: 'nav.notifications', icon: Bell },
        ],
      },
    ],
  },
  {
    id: 'admin',
    labelKey: 'modules.admin.name',
    icon: Cog,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    sections: [
      {
        titleKey: 'modules.admin.overview',
        items: [
          { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
        ],
      },
      {
        titleKey: 'modules.admin.users_section',
        items: [
          { to: '/admin/users', labelKey: 'modules.admin.users', icon: UserCog },
          { to: '/admin/roles', labelKey: 'modules.admin.roles', icon: Shield },
          { to: '/admin/employees', labelKey: 'modules.admin.employees', icon: Users },
          { to: '/admin/security', labelKey: 'modules.admin.security', icon: ShieldCheck },
        ],
      },
      {
        titleKey: 'modules.admin.config_section',
        items: [
          { to: '/admin/companies', labelKey: 'modules.admin.companies', icon: Building2 },
          { to: '/admin/fne-config', labelKey: 'modules.admin.fneConfig', icon: Store },
          { to: '/admin/approval-circuits', labelKey: 'modules.admin.approvalCircuits', icon: GitBranch },
        ],
      },
      {
        titleKey: 'modules.admin.audit_section',
        items: [
          { to: '/admin/audit', labelKey: 'modules.admin.audit', icon: ClipboardList },
          { to: '/admin/report-designer', labelKey: 'modules.admin.reportDesigner', icon: Printer },
          { to: '/notifications', labelKey: 'nav.notifications', icon: Bell },
        ],
      },
    ],
  },
  {
    id: 'manager-caisse',
    labelKey: 'modules.manager-caisse.name',
    icon: Landmark,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    sections: [
      {
        titleKey: 'modules.manager-caisse.overview',
        items: [
          { to: '/manager-caisse/dashboard', labelKey: 'modules.manager-caisse.dashboard', icon: LayoutDashboard },
        ],
      },
      {
        titleKey: 'modules.manager-caisse.config_section',
        items: [
          { to: '/manager-caisse/categories', labelKey: 'modules.manager-caisse.categories', icon: FolderTree },
          { to: '/manager-caisse/accounting', labelKey: 'modules.manager-caisse.accounting', icon: BookOpen },
          { to: '/manager-caisse/settings', labelKey: 'modules.manager-caisse.settings', icon: BadgeDollarSign },
        ],
      },
      {
        titleKey: 'modules.manager-caisse.operations_section',
        items: [
          { to: '/manager-caisse/closing', labelKey: 'modules.manager-caisse.closing', icon: Lock },
          { to: '/manager-caisse/closing-history', labelKey: 'modules.manager-caisse.closingHistory', icon: History },
        ],
      },
      {
        titleKey: 'modules.manager-caisse.tracking_section',
        items: [
          { to: '/manager-caisse/accounting-entries', labelKey: 'modules.manager-caisse.accountingEntries', icon: BookOpen },
          { to: '/manager-caisse/period-reports', labelKey: 'modules.manager-caisse.periodReports', icon: BarChart3 },
        ],
      },
    ],
  },
  {
    id: 'decision',
    labelKey: 'modules.decision.name',
    icon: TrendingUp,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/15',
    sections: [
      {
        titleKey: 'modules.decision.overview',
        items: [
          { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
          { to: '/validation', labelKey: 'modules.decision.validation', icon: FileSignature },
          { to: '/month-expenses', labelKey: 'modules.decision.monthExpenses', icon: Receipt },
          { to: '/devis', labelKey: 'modules.decision.devisList', icon: FileText },
        ],
      },
    ],
  },
];

/* ─── Component ─────────────────────────────────── */
export function Sidebar({ pendingExpenses = 0 }: { pendingExpenses?: number }) {
  const { t } = useTranslation();
  const { collapsed, toggle } = useSidebarStore();
  const { user, logout } = useAuthStore();
  const { openTab } = useTabStore();
  const { activeModule, setActiveModule } = useModuleStore();
  const { data: cashState } = useCashState();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  const currentModule = modules.find((m) => m.id === activeModule) || modules[0];

  // Filter modules based on user's allowedModules
  const visibleModules = useMemo(() => {
    if (!user) return modules;
    // If allowedModules is set, filter by it (applies to ALL roles including admin)
    if (user.allowedModules && user.allowedModules.length > 0) {
      return modules.filter((m) => user.allowedModules!.includes(m.id));
    }
    // No modules assigned → empty
    return [];
  }, [user]);

  // Check if user has access (has at least one module AND one company)
  const hasAccess = useMemo(() => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const hasModules = user.allowedModules && user.allowedModules.length > 0;
    const hasCompany = user.companyIds && user.companyIds.length > 0;
    return hasModules && hasCompany;
  }, [user]);

  // Cash day must be open for non-admin/manager users to see navigation
  const cashDayOpen = useMemo(() => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'manager') return true;
    return cashState?.status === 'OPEN';
  }, [user, cashState]);

  // Auto-switch to first allowed module if current is not allowed
  const effectiveModule = useMemo(() => {
    if (visibleModules.find((m) => m.id === activeModule)) return currentModule;
    return visibleModules[0] || modules[0];
  }, [visibleModules, activeModule, currentModule]);

  // Sync store when active module is not in visible list
  useEffect(() => {
    if (effectiveModule.id !== activeModule) {
      setActiveModule(effectiveModule.id);
    }
  }, [effectiveModule, activeModule, setActiveModule]);

  const handleNavClick = (item: NavItem) => {
    openTab({ path: item.to, labelKey: item.labelKey, pinned: item.to === '/' });
    navigate(item.to);
  };

  const getBadge = (path: string): number | undefined => {
    if (path === '/expenses' && pendingExpenses > 0) return pendingExpenses;
    return undefined;
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[272px]',
      )}
    >
      {/* ── Logo ──────────────────────────────────── */}
      <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold text-sm font-bold text-white">
          CF
        </div>
        {!collapsed && (
          <span className="text-lg font-semibold tracking-tight text-white">
            {t('app.name')}
          </span>
        )}
      </div>

      {/* ── Navigation ────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        {hasAccess && cashDayOpen && effectiveModule.sections.map((section, sIdx) => (
          <div key={sIdx} className={cn(sIdx > 0 && 'mt-4')}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {t(section.titleKey)}
              </p>
            )}
            {collapsed && sIdx > 0 && (
              <div className="mx-auto my-2 h-px w-6 bg-sidebar-border" />
            )}

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const badge = getBadge(item.to);
                const isActive =
                  item.to === '/'
                    ? location.pathname === '/'
                    : location.pathname === item.to || location.pathname.startsWith(item.to + '/');

                return (
                  <button
                    key={item.to}
                    onClick={() => handleNavClick(item)}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? `bg-sidebar-accent ${effectiveModule.color}`
                        : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-white',
                      collapsed && 'justify-center px-0',
                    )}
                    title={collapsed ? t(item.labelKey) : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{t(item.labelKey)}</span>
                        {badge !== undefined && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold px-1.5 text-xs font-semibold text-white">
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                      </>
                    )}
                    {collapsed && badge !== undefined && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold text-white">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── User profile ──────────────────────────── */}
      <div className="relative border-t border-sidebar-border p-3">
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-sidebar-accent',
            collapsed && 'justify-center',
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/20 text-xs font-semibold text-brand-gold">
            {user?.firstName?.[0]}
            {user?.lastName?.[0]}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 text-left">
                <p className="truncate text-sm font-medium text-white">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/40">
                  {user?.role}
                </p>
              </div>
              <ChevronsUpDown className="h-4 w-4 text-sidebar-foreground/40" />
            </>
          )}
        </button>

        {profileOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-sidebar-border bg-sidebar-accent p-1 shadow-lg">
            <NavLink
              to="/profile"
              onClick={() => setProfileOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar hover:text-white"
            >
              <User className="h-4 w-4" />
              {t('nav.profile')}
            </NavLink>
            <NavLink
              to="/manager-caisse/settings"
              onClick={() => setProfileOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar hover:text-white"
            >
              <Cog className="h-4 w-4" />
              {t('nav.settings')}
            </NavLink>
            <button
              onClick={() => {
                setProfileOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-400 hover:bg-sidebar hover:text-red-300"
            >
              <LogOut className="h-4 w-4" />
              {t('nav.logout')}
            </button>
          </div>
        )}
      </div>

      {/* ── Collapse toggle ───────────────────────── */}
      <button
        onClick={toggle}
        className="flex h-9 items-center justify-center border-t border-sidebar-border text-sidebar-foreground/40 transition-colors hover:text-white"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </aside>
  );
}
