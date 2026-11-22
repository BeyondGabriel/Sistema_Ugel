import { Suspense } from 'react';
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
 * Fallback local que se muestra DENTRO del layout mientras se descarga el
 * chunk de la página. Al no incluir el shell (sidebar/topbar), el layout
 * permanece montado y no se produce el "destello blanco" al navegar.
 */
function SpinnerPagina() {
  return (
    <div className="flex justify-center py-24" role="status" aria-live="polite">
      <div className="animate-spin h-8 w-8 border-4 border-brand-blue border-t-transparent rounded-full" />
      <span className="sr-only">Cargando página...</span>
    </div>
  );
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
        <Suspense fallback={<SpinnerPagina />}>
          <Outlet />
        </Suspense>
      </Layout>
    );
  }

  return (
    <Suspense fallback={<SpinnerPagina />}>
      <Outlet />
    </Suspense>
  );
}
