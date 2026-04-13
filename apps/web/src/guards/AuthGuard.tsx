import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import type { ReactNode } from 'react';

interface AuthGuardProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'manager' | 'cashier' | 'viewer';
  requiredPermission?: string;
}

export function AuthGuard({ children, requiredRole, requiredPermission }: AuthGuardProps) {
  const { isAuthenticated, hasRole, hasPermission } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
