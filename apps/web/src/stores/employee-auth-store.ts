import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Employee {
  matricule: string;
  firstName: string;
  lastName: string;
  email: string;
  service: string;
  position: string;
  phone: string;
}

interface EmployeeAuthState {
  employee: Employee | null;
  isAuthenticated: boolean;

  login: (employee: Employee) => void;
  logout: () => void;
}

export const useEmployeeAuthStore = create<EmployeeAuthState>()(
  persist(
    (set) => ({
      employee: null,
      isAuthenticated: false,

      login: (employee) => set({ employee, isAuthenticated: true }),

      logout: () => set({ employee: null, isAuthenticated: false }),
    }),
    {
      name: 'caisseflow-employee-auth',
      partialize: (state) => ({
        employee: state.employee,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
