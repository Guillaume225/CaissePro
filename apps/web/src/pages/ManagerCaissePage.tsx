import { Outlet, useLocation, Navigate } from 'react-router-dom';

export default function ManagerCaissePage() {
  const location = useLocation();

  // If on exact /manager-caisse, redirect to /manager-caisse/dashboard
  if (location.pathname === '/manager-caisse') {
    return <Navigate to="dashboard" replace />;
  }

  return <Outlet />;
}
