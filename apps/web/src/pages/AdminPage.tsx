import { Outlet, useLocation, Navigate } from 'react-router-dom';

export default function AdminPage() {
  const location = useLocation();

  // If on exact /admin, redirect to /admin/users
  if (location.pathname === '/admin') {
    return <Navigate to="users" replace />;
  }

  return <Outlet />;
}
