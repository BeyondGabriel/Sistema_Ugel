import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getToken } from '../../services/api';
import type { Rol } from '../../types';
import { Layout } from './Layout';

interface ProtectedRouteProps {
  allowedRoles?: Rol[];
  /** Si true, usa el layout con sidebar. Por defecto: true */
  conLayout?: boolean;
}

/**
 * Protege rutas de React Router v6.
 * Si no hay sesión activa redirige a /login.
 * Si se especifican allowedRoles y el usuario no tiene uno de ellos, redirige a /dashboard.
 */
export function ProtectedRoute({ allowedRoles, conLayout = true }: ProtectedRouteProps) {
  const { user } = useAuth();
  const token = getToken();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (conLayout) {
    return (
      <Layout>
        <Outlet />
      </Layout>
    );
  }

  return <Outlet />;
}
