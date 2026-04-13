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

const GENERAL_TAB: Tab = {
  id: '/general',
  path: '/general',
  labelKey: 'nav.general',
  icon: 'Home',
  pinned: true,
};

export const useTabStore = create<TabState>()(
  persist(
    (set, get) => ({
      tabs: [GENERAL_TAB],
      activeTabId: '/general',

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
          set({ tabs: [GENERAL_TAB], activeTabId: '/general' });
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
        set({ tabs: [GENERAL_TAB], activeTabId: '/general' });
      },
    }),
    {
      name: 'caisseflow-tabs',
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
    },
  ),
);
