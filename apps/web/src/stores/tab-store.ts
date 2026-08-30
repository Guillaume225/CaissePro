import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Tab {
  id: string; // unique key = path
  path: string; // route path
  labelKey: string; // i18n key
  icon?: string; // lucide icon name
  pinned?: boolean; // pinned tabs can't be closed
}

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;

  openTab: (tab: Omit<Tab, 'id'>) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
}

const DASHBOARD_TAB: Tab = {
  id: '/',
  path: '/',
  labelKey: 'nav.dashboard',
  icon: 'LayoutDashboard',
  pinned: true,
};

export const useTabStore = create<TabState>()(
  persist(
    (set, get) => ({
      tabs: [DASHBOARD_TAB],
      activeTabId: '/',

      openTab: (tab) => {
        const { tabs } = get();
        const id = tab.path;
        const exists = tabs.find((t) => t.id === id);
        if (!exists) {
          set({ tabs: [...tabs, { ...tab, id }], activeTabId: id });
        } else {
          set({ activeTabId: id });
        }
      },

      closeTab: (id) => {
        const { tabs, activeTabId } = get();
        const tab = tabs.find((t) => t.id === id);
        if (tab?.pinned) return;

        const newTabs = tabs.filter((t) => t.id !== id);
        if (newTabs.length === 0) {
          set({ tabs: [DASHBOARD_TAB], activeTabId: '/' });
          return;
        }
        if (activeTabId === id) {
          const idx = tabs.findIndex((t) => t.id === id);
          const next = newTabs[Math.min(idx, newTabs.length - 1)];
          set({ tabs: newTabs, activeTabId: next.id });
        } else {
          set({ tabs: newTabs });
        }
      },

      setActiveTab: (id) => set({ activeTabId: id }),

      closeOtherTabs: (id) => {
        const { tabs } = get();
        const kept = tabs.filter((t) => t.id === id || t.pinned);
        set({ tabs: kept, activeTabId: id });
      },

      closeAllTabs: () => {
        set({ tabs: [DASHBOARD_TAB], activeTabId: '/' });
      },
    }),
    {
      name: 'caisseflow-tabs',
      version: 1,
      // v0 -> v1: the pinned "Général" tab (/general) was replaced by a
      // pinned "Tableau de bord" tab (/) — rewrite any session's persisted
      // tabs so it doesn't keep resurrecting the removed tab forever.
      migrate: (persistedState, version) => {
        const state = persistedState as { tabs?: Tab[]; activeTabId?: string | null } | undefined;
        if (version >= 1 || !state) return state;

        const tabs = (state.tabs ?? []).map((t) => (t.id === '/general' ? DASHBOARD_TAB : t));
        if (!tabs.some((t) => t.id === '/')) tabs.unshift(DASHBOARD_TAB);

        const activeTabId = state.activeTabId === '/general' ? '/' : state.activeTabId;
        return { ...state, tabs, activeTabId };
      },
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
    },
  ),
);
