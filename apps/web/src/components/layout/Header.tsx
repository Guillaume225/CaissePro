import { useTranslation } from 'react-i18next';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Bell, Search, Globe, Bot, Building2, ChevronDown, Check, Wallet, Cog, TrendingUp, Landmark, FileCheck2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { useUnreadCount } from '@/hooks/useDashboard';
import { useAuthStore } from '@/stores/auth-store';
import { useSwitchCompany } from '@/hooks/useAdmin';
import { useModuleStore, type ModuleId } from '@/stores/module-store';
import { useTabStore } from '@/stores/tab-store';

/* ─── Module definitions (Header) ─────────────── */
interface HeaderModule {
  id: ModuleId;
  labelKey: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  textColor: string;
  firstRoute: { path: string; labelKey: string };
}

const headerModules: HeaderModule[] = [
  { id: 'expense', labelKey: 'modules.expense.name', icon: Wallet, color: 'text-orange-500', bgColor: 'bg-orange-50', textColor: 'text-orange-700', firstRoute: { path: '/', labelKey: 'nav.dashboard' } },
  { id: 'admin', labelKey: 'modules.admin.name', icon: Cog, color: 'text-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', firstRoute: { path: '/', labelKey: 'nav.dashboard' } },
  { id: 'manager-caisse', labelKey: 'modules.manager-caisse.name', icon: Landmark, color: 'text-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700', firstRoute: { path: '/manager-caisse/dashboard', labelKey: 'modules.manager-caisse.dashboard' } },
  { id: 'fne', labelKey: 'modules.fne.name', icon: FileCheck2, color: 'text-teal-500', bgColor: 'bg-teal-50', textColor: 'text-teal-700', firstRoute: { path: '/fne', labelKey: 'modules.fne.overview' } },
  { id: 'decision', labelKey: 'modules.decision.name', icon: TrendingUp, color: 'text-purple-500', bgColor: 'bg-purple-50', textColor: 'text-purple-700', firstRoute: { path: '/', labelKey: 'nav.dashboard' } },
];

const routeLabels: Record<string, string> = {
  '/': 'nav.dashboard',
  '/expenses': 'modules.expense.list',
  '/expenses/new': 'modules.expense.new',
  '/reports': 'modules.decision.reports',
  '/reports/generator': 'modules.decision.generator',
  '/reports/narrative': 'modules.decision.narrative',
  '/admin': 'nav.admin',
  '/admin/users': 'modules.admin.users',
  '/admin/roles': 'modules.admin.roles',
  '/admin/employees': 'modules.admin.employees',
  '/admin/companies': 'modules.admin.companies',
  '/admin/audit': 'modules.admin.audit',
  '/admin/security': 'modules.admin.security',
  '/manager-caisse/dashboard': 'modules.manager-caisse.dashboard',
  '/manager-caisse/categories': 'modules.manager-caisse.categories',
  '/manager-caisse/accounting': 'modules.manager-caisse.accounting',
  '/manager-caisse/settings': 'modules.manager-caisse.settings',
  '/manager-caisse/closing': 'modules.manager-caisse.closing',
  '/manager-caisse/closing-history': 'modules.manager-caisse.closingHistory',
  '/manager-caisse/accounting-entries': 'modules.manager-caisse.accountingEntries',
  '/fne': 'modules.fne.overview',
  '/fne/invoices': 'modules.fne.list',
  '/fne/invoices/new': 'modules.fne.new',
  '/fne/clients': 'modules.fne.clients',
  '/fne/products': 'modules.fne.products',
  '/fne/accounting': 'modules.fne.accounting',
  '/admin/fne-config': 'modules.admin.fneConfig',
  '/notifications': 'nav.notifications',
  '/profile': 'nav.profile',
};

export function Header({
  onAIClick,
}: {
  onAIClick?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [langOpen, setLangOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [companyOpen, setCompanyOpen] = useState(false);
  const [moduleOpen, setModuleOpen] = useState(false);
  const { data: notificationCount = 0 } = useUnreadCount();
  const { user } = useAuthStore();
  const switchCompany = useSwitchCompany();
  const { activeModule, setActiveModule } = useModuleStore();
  const { openTab } = useTabStore();

  // ── Module filtering ─────────────────────────
  const visibleModules = useMemo(() => {
    if (!user) return headerModules;
    // Filter by allowedModules for ALL roles including admin
    if (user.allowedModules && user.allowedModules.length > 0) {
      return headerModules.filter((m) => user.allowedModules!.includes(m.id));
    }
    return [];
  }, [user]);

  const currentModule = visibleModules.find((m) => m.id === activeModule) || visibleModules[0] || headerModules[0];

  const handleModuleChange = (mod: HeaderModule) => {
    setActiveModule(mod.id);
    setModuleOpen(false);
    openTab({ path: mod.firstRoute.path, labelKey: mod.firstRoute.labelKey, pinned: mod.firstRoute.path === '/' });
    navigate(mod.firstRoute.path);
  };

  const userCompanies = (user?.companyIds || []).map((id, i) => ({
    id,
    name: user?.companyNames?.[i] || id,
  }));

  const handleCompanySwitch = async (companyId: string, companyName: string) => {
    await switchCompany.mutateAsync(companyId);
    useAuthStore.setState((s) => ({
      user: s.user ? { ...s.user, companyId, companyName } : s.user,
    }));
    setCompanyOpen(false);
  };

  // ── Breadcrumbs ──────────────────────────────
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = [
    { path: '/', label: t('nav.dashboard') },
    ...pathSegments.map((segment, i) => {
      const path = '/' + pathSegments.slice(0, i + 1).join('/');
      const labelKey = routeLabels[path];
      return {
        path,
        label: labelKey ? t(labelKey) : segment.charAt(0).toUpperCase() + segment.slice(1),
      };
    }),
  ];

  const switchLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('caisseflow-lang', lang);
    setLangOpen(false);
  };

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* ── Breadcrumb ──────────────────────────── */}
      <nav className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.path} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-gray-300">/</span>}
            {i === breadcrumbs.length - 1 ? (
              <span className="font-medium text-gray-900">{crumb.label}</span>
            ) : (
              <Link to={crumb.path} className="text-gray-500 hover:text-gray-700">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* ── Right actions ──────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Module Switcher */}
        {visibleModules.length > 0 && (
        <div className="relative">
          <button
            onClick={() => { setModuleOpen(!moduleOpen); setCompanyOpen(false); }}
            className={cn(
              'flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
              currentModule.bgColor, currentModule.textColor, 'border-gray-200 hover:opacity-90',
            )}
          >
            <currentModule.icon className={cn('h-4 w-4', currentModule.color)} />
            <span className="max-w-[120px] truncate">{t(currentModule.labelKey)}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 opacity-60 transition-transform', moduleOpen && 'rotate-180')} />
          </button>
          {moduleOpen && (
            <div className="absolute left-0 top-full mt-1 w-52 rounded-lg border border-gray-200 bg-white p-1 shadow-lg z-50">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {t('nav.modules')}
              </p>
              {visibleModules.map((mod) => (
                <button
                  key={mod.id}
                  onClick={() => handleModuleChange(mod)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                    activeModule === mod.id
                      ? `${mod.bgColor} ${mod.textColor} font-medium`
                      : 'text-gray-600 hover:bg-gray-50',
                  )}
                >
                  <mod.icon className={cn('h-4 w-4 shrink-0', mod.color)} />
                  <span className="flex-1 text-left truncate">{t(mod.labelKey)}</span>
                  {activeModule === mod.id && <Check className={cn('h-4 w-4', mod.color)} />}
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Company Switcher */}
        {userCompanies.length >= 1 && (
          <div className="relative">
            <button
              onClick={() => { setCompanyOpen(!companyOpen); setModuleOpen(false); }}
              className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              <Building2 className="h-4 w-4 text-emerald-500" />
              <span className="max-w-[140px] truncate font-medium">{user?.companyName || '—'}</span>
              <ChevronDown className={cn('h-3.5 w-3.5 text-gray-400 transition-transform', companyOpen && 'rotate-180')} />
            </button>
            {companyOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-gray-200 bg-white p-1 shadow-lg z-50">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {t('admin.companies.switchCompany')}
                </p>
                {userCompanies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleCompanySwitch(c.id, c.name)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                      user?.companyId === c.id
                        ? 'bg-emerald-50 text-emerald-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 text-left truncate">{c.name}</span>
                    {user?.companyId === c.id && <Check className="h-4 w-4 text-emerald-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Search"
          >
            <Search className="h-4.5 w-4.5" />
          </button>
          {searchOpen && (
            <div className="absolute right-0 top-full mt-1 w-80 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('common.search')}
                className="w-full rounded-md border-gray-200 px-3 py-2 text-sm focus:border-brand-gold focus:ring-brand-gold"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Notifications */}
        <Link
          to="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          {notificationCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </Link>

        {/* Language selector */}
        <div className="relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <Globe className="h-4 w-4" />
            <span className="font-medium uppercase">{i18n.language}</span>
          </button>
          {langOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
              <button
                onClick={() => switchLanguage('fr')}
                className={cn(
                  'flex w-full items-center rounded-md px-3 py-2 text-sm',
                  i18n.language === 'fr'
                    ? 'bg-brand-gold/10 font-medium text-brand-gold'
                    : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                {t('language.fr')}
              </button>
              <button
                onClick={() => switchLanguage('en')}
                className={cn(
                  'flex w-full items-center rounded-md px-3 py-2 text-sm',
                  i18n.language === 'en'
                    ? 'bg-brand-gold/10 font-medium text-brand-gold'
                    : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                {t('language.en')}
              </button>
            </div>
          )}
        </div>

        {/* AI Assistant button */}
        <button
          onClick={onAIClick}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-gold px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-gold-dark"
        >
          <Bot className="h-4 w-4" />
          <span className="hidden sm:inline">{t('ai.assistant')}</span>
        </button>
      </div>
    </header>
  );
}
