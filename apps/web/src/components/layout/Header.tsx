import { useTranslation } from 'react-i18next';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Search,
  Globe,
  Bot,
  Building2,
  ChevronDown,
  Check,
  Wallet,
  Cog,
  TrendingUp,
  Landmark,
  FileCheck2,
  ShoppingCart,
  CheckCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useDashboard';
import { useAuthStore } from '@/stores/auth-store';
import { useSwitchCompany } from '@/hooks/useAdmin';
import { useModuleStore, type ModuleId } from '@/stores/module-store';
import { useTabStore } from '@/stores/tab-store';
import { getNotificationRoute } from '@/lib/notificationRoutes';
import type { AppNotification } from '@/types/dashboard';

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
  {
    id: 'expense',
    labelKey: 'modules.expense.name',
    icon: Wallet,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    firstRoute: { path: '/', labelKey: 'nav.dashboard' },
  },
  {
    id: 'admin',
    labelKey: 'modules.admin.name',
    icon: Cog,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    firstRoute: { path: '/', labelKey: 'nav.dashboard' },
  },
  {
    id: 'manager-caisse',
    labelKey: 'modules.manager-caisse.name',
    icon: Landmark,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    firstRoute: { path: '/manager-caisse/dashboard', labelKey: 'modules.manager-caisse.dashboard' },
  },
  {
    id: 'fne',
    labelKey: 'modules.fne.name',
    icon: FileCheck2,
    color: 'text-teal-500',
    bgColor: 'bg-teal-50',
    textColor: 'text-teal-700',
    firstRoute: { path: '/fne', labelKey: 'modules.fne.overview' },
  },
  {
    id: 'decision',
    labelKey: 'modules.decision.name',
    icon: TrendingUp,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    firstRoute: { path: '/', labelKey: 'nav.dashboard' },
  },
  {
    id: 'demande-achat',
    labelKey: 'modules.demande-achat.name',
    icon: ShoppingCart,
    color: 'text-sky-500',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-700',
    firstRoute: { path: '/demande-achat', labelKey: 'modules.demande-achat.list' },
  },
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
  '/demande-achat': 'modules.demande-achat.list',
  '/demande-achat/new': 'modules.demande-achat.new',
  '/demande-achat/to-validate': 'modules.demande-achat.toValidate',
  '/demande-achat/achats': 'modules.demande-achat.purchasing',
  '/demande-achat/dashboard': 'modules.demande-achat.dashboard',
  '/admin/demande-achat-circuits': 'modules.demande-achat.circuits',
};

export function Header({ onAIClick }: { onAIClick?: () => void }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [langOpen, setLangOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [companyOpen, setCompanyOpen] = useState(false);
  const [moduleOpen, setModuleOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { data: notificationCount = 0 } = useUnreadCount();
  const { data: notifications = [] } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const { user } = useAuthStore();
  const switchCompany = useSwitchCompany();
  const { activeModule, setActiveModule } = useModuleStore();
  const { openTab } = useTabStore();

  // ── Click-outside-to-close for all header dropdowns ──
  const moduleRef = useRef<HTMLDivElement>(null);
  const companyRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (moduleRef.current && !moduleRef.current.contains(target)) setModuleOpen(false);
      if (companyRef.current && !companyRef.current.contains(target)) setCompanyOpen(false);
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (langRef.current && !langRef.current.contains(target)) setLangOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotifClick = (notif: AppNotification) => {
    if (!notif.isRead) markAsRead.mutate(notif.id);
    const route = getNotificationRoute(notif.entityType, notif.entityId);
    if (route) navigate(route);
    setNotifOpen(false);
  };

  // ── Module filtering ─────────────────────────
  const visibleModules = useMemo(() => {
    if (!user) return headerModules;
    // Filter by allowedModules for ALL roles including admin
    if (user.allowedModules && user.allowedModules.length > 0) {
      return headerModules.filter((m) => user.allowedModules!.includes(m.id));
    }
    return [];
  }, [user]);

  const currentModule =
    visibleModules.find((m) => m.id === activeModule) || visibleModules[0] || headerModules[0];

  const handleModuleChange = (mod: HeaderModule) => {
    setActiveModule(mod.id);
    setModuleOpen(false);
    openTab({
      path: mod.firstRoute.path,
      labelKey: mod.firstRoute.labelKey,
      pinned: mod.firstRoute.path === '/',
    });
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
          <div className="relative" ref={moduleRef}>
            <button
              onClick={() => {
                setModuleOpen(!moduleOpen);
                setCompanyOpen(false);
              }}
              className={cn(
                'flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
                currentModule.bgColor,
                currentModule.textColor,
                'border-gray-200 hover:opacity-90',
              )}
            >
              <currentModule.icon className={cn('h-4 w-4', currentModule.color)} />
              <span className="max-w-[120px] truncate">{t(currentModule.labelKey)}</span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 opacity-60 transition-transform',
                  moduleOpen && 'rotate-180',
                )}
              />
            </button>
            {moduleOpen && (
              <div className="absolute left-0 top-full mt-1 w-52 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg z-50">
                <p className="border-b border-zinc-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {t('nav.modules')}
                </p>
                {visibleModules.map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => handleModuleChange(mod)}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                      activeModule === mod.id
                        ? 'bg-orange-50 text-[#EA761D] font-medium'
                        : 'text-zinc-700 hover:bg-zinc-50 hover:text-[#EA761D]',
                    )}
                  >
                    <mod.icon className={cn('h-3.5 w-3.5 shrink-0', mod.color)} strokeWidth={1.5} />
                    <span className="flex-1 text-left truncate">{t(mod.labelKey)}</span>
                    {activeModule === mod.id && <Check className="h-3.5 w-3.5 text-[#EA761D]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Company Switcher */}
        {userCompanies.length >= 1 && (
          <div className="relative" ref={companyRef}>
            <button
              onClick={() => {
                setCompanyOpen(!companyOpen);
                setModuleOpen(false);
              }}
              className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              <Building2 className="h-4 w-4 text-emerald-500" />
              <span className="max-w-[140px] truncate font-medium">{user?.companyName || '—'}</span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 text-gray-400 transition-transform',
                  companyOpen && 'rotate-180',
                )}
              />
            </button>
            {companyOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg z-50">
                <p className="border-b border-zinc-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {t('admin.companies.switchCompany')}
                </p>
                {userCompanies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleCompanySwitch(c.id, c.name)}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                      user?.companyId === c.id
                        ? 'bg-orange-50 text-[#EA761D] font-medium'
                        : 'text-zinc-700 hover:bg-zinc-50 hover:text-[#EA761D]',
                    )}
                  >
                    <Building2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                    <span className="flex-1 text-left truncate">{c.name}</span>
                    {user?.companyId === c.id && <Check className="h-3.5 w-3.5 text-[#EA761D]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative" ref={searchRef}>
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Search"
          >
            <Search className="h-4.5 w-4.5" />
          </button>
          {searchOpen && (
            <div className="absolute right-0 top-full mt-1 w-80 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg z-50">
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
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Notifications"
          >
            <Bell className="h-4.5 w-4.5" />
            {notificationCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-96 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                <span className="text-sm font-semibold text-gray-900">
                  {t('notifications.title')}
                </span>
                {notificationCount > 0 && (
                  <button
                    className="flex items-center gap-1 text-xs font-medium text-brand-gold hover:text-brand-gold-dark disabled:opacity-50"
                    onClick={() => markAllAsRead.mutate()}
                    disabled={markAllAsRead.isPending}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    {t('notifications.markAllRead')}
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                    <Bell className="h-8 w-8 text-gray-200" />
                    <p className="text-sm text-gray-400">{t('notifications.noNotifications')}</p>
                  </div>
                ) : (
                  notifications.slice(0, 8).map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className={cn(
                        'flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50',
                        !notif.isRead && 'bg-brand-gold/5',
                      )}
                    >
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-gold" style={{ visibility: notif.isRead ? 'hidden' : 'visible' }} />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-sm',
                            notif.isRead ? 'font-normal text-gray-700' : 'font-semibold text-gray-900',
                          )}
                        >
                          {notif.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{notif.message}</p>
                        <span className="mt-1 block text-[10px] text-gray-400">
                          {new Date(notif.createdAt).toLocaleString([], {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <Link
                to="/notifications"
                onClick={() => setNotifOpen(false)}
                className="block border-t border-gray-100 px-4 py-2.5 text-center text-xs font-medium text-brand-gold hover:bg-gray-50"
              >
                {t('notifications.viewAll', 'Voir toutes les notifications')}
              </Link>
            </div>
          )}
        </div>

        {/* Language selector */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <Globe className="h-4 w-4" />
            <span className="font-medium uppercase">{i18n.language}</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 opacity-60 transition-transform',
                langOpen && 'rotate-180',
              )}
            />
          </button>
          {langOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg z-50">
              <button
                onClick={() => switchLanguage('fr')}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                  i18n.language === 'fr'
                    ? 'bg-orange-50 text-[#EA761D] font-medium'
                    : 'text-zinc-700 hover:bg-zinc-50 hover:text-[#EA761D]',
                )}
              >
                <span className="flex-1 text-left">{t('language.fr')}</span>
                {i18n.language === 'fr' && <Check className="h-3.5 w-3.5 text-[#EA761D]" />}
              </button>
              <button
                onClick={() => switchLanguage('en')}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                  i18n.language === 'en'
                    ? 'bg-orange-50 text-[#EA761D] font-medium'
                    : 'text-zinc-700 hover:bg-zinc-50 hover:text-[#EA761D]',
                )}
              >
                <span className="flex-1 text-left">{t('language.en')}</span>
                {i18n.language === 'en' && <Check className="h-3.5 w-3.5 text-[#EA761D]" />}
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
