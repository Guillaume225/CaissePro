import { Navigate } from 'react-router-dom';
import { useEmployeeAuthStore } from '@/stores/employee-auth-store';
import type { ReactNode } from 'react';

export function EmployeeGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useEmployeeAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/demande/login" replace />;
  }

  return <>{children}</>;
}
