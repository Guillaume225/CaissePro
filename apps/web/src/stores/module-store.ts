import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useTabStore } from './tab-store';

export type ModuleId = 'expense' | 'fne' | 'admin' | 'decision' | 'manager-caisse';

interface ModuleState {
  activeModule: ModuleId;
  setActiveModule: (id: ModuleId) => void;
}

export const useModuleStore = create<ModuleState>()(
  persist(
    (set, get) => ({
      activeModule: 'expense',
      setActiveModule: (id) => {
        if (id !== get().activeModule) {
          useTabStore.getState().closeAllTabs();
        }
        set({ activeModule: id });
      },
    }),
    { name: 'caisseflow-module' },
  ),
);
