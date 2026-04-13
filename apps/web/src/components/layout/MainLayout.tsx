import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { TabBar } from './TabBar';
import { AiChatbot } from '@/components/AiChatbot';
import { useSocket } from '@/hooks/useSocket';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useTabStore } from '@/stores/tab-store';
import { useAuthStore } from '@/stores/auth-store';
import { useCashState } from '@/hooks/useClosing';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo, lazy, Suspense } from 'react';

const NoAccessPage = lazy(() => import('@/pages/NoAccessPage'));
const CashDayRequiredPage = lazy(() => import('@/pages/CashDayRequiredPage'));

export function MainLayout() {
  const { collapsed } = useSidebarStore();
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const location = useLocation();
  const { tabs, activeTabId, setActiveTab } = useTabStore();
  const { user } = useAuthStore();

  // Check if user has access (has at least one module AND one company)
  const hasAccess = useMemo(() => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const hasModules = user.allowedModules && user.allowedModules.length > 0;
    const hasCompany = user.companyIds && user.companyIds.length > 0;
    return hasModules && hasCompany;
  }, [user]);

  // Check if cash register is open (non-admin/manager users must open cash first)
  const { data: cashState, isLoading: cashStateLoading } = useCashState();
  const cashDayRequired = useMemo(() => {
    if (!user || user.role === 'admin' || user.role === 'manager') return false;
    if (cashStateLoading) return false;
    return !cashState || cashState.status !== 'OPEN';
  }, [user, cashState, cashStateLoading]);

  // Sync active tab when URL changes (e.g. browser back/forward)
  useEffect(() => {
    const matchingTab = tabs.find((t) => t.path === location.pathname);
    if (matchingTab && matchingTab.id !== activeTabId) {
      setActiveTab(matchingTab.id);
    }
  }, [location.pathname]);

  // Activate WebSocket connection globally
  useSocket();

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar pendingExpenses={3} />

      <div
        className={cn(
          'flex min-h-screen flex-col transition-all duration-300 print:!ml-0',
          collapsed ? 'ml-[68px]' : 'ml-[272px]',
        )}
      >
        <Header onAIClick={() => setAiPanelOpen(!aiPanelOpen)} />
        <TabBar />

        <main className="flex-1 p-6 print:!p-0">
          {!hasAccess ? (
            <Suspense fallback={null}>
              <NoAccessPage />
            </Suspense>
          ) : cashDayRequired ? (
            <Suspense fallback={null}>
              <CashDayRequiredPage />
            </Suspense>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* AI Assistant floating panel */}
      <AiChatbot open={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
    </div>
  );
}
