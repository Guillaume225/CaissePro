import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { User } from '@/types/auth';

const REMEMBER_ME_KEY = 'caisseflow-remember-me';

export function setRememberMe(remember: boolean): void {
  try {
    localStorage.setItem(REMEMBER_ME_KEY, remember ? 'true' : 'false');
  } catch {
    /* ignore (private browsing / storage disabled) */
  }
}

function rememberMeEnabled(): boolean {
  try {
    // Default to true so existing sessions (set before this preference existed) keep working.
    return localStorage.getItem(REMEMBER_ME_KEY) !== 'false';
  } catch {
    return true;
  }
}

// Persists to localStorage when "remember me" is on (survives browser restarts),
// otherwise to sessionStorage (cleared when the browser/tab is closed).
const rememberAwareStorage: StateStorage = {
  getItem: (name) => {
    const store = rememberMeEnabled() ? localStorage : sessionStorage;
    return store.getItem(name);
  },
  setItem: (name, value) => {
    const store = rememberMeEnabled() ? localStorage : sessionStorage;
    store.setItem(name, value);
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  },
};

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  setUser: (user: User) => void;
  setTokens: (token: string, refreshToken: string) => void;
  login: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: User['role']) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      setUser: (user) => set({ user }),

      setTokens: (token, refreshToken) => set({ token, refreshToken }),

      login: (user, token, refreshToken) =>
        set({ user, token, refreshToken, isAuthenticated: true }),

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        });
        setRememberMe(true);
      },

      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === 'admin') return true;
        return user.permissions.includes(permission);
      },

      hasRole: (role) => {
        const { user } = get();
        if (!user) return false;
        const hierarchy: Record<string, number> = {
          admin: 4,
          manager: 3,
          cashier: 2,
          viewer: 1,
        };
        return hierarchy[user.role] >= hierarchy[role];
      },
    }),
    {
      name: 'caisseflow-auth',
      storage: createJSONStorage(() => rememberAwareStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
