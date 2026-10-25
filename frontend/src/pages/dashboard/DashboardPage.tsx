import { useAuth } from '../../hooks/useAuth';
import { AdminDashboard } from './AdminDashboard';
import { DirectoraDashboard } from './DirectoraDashboard';
import { EspecialistaDashboard } from './EspecialistaDashboard';
import { JefeDashboard } from './JefeDashboard';
import { RrhhDashboard } from './RrhhDashboard';
import { VigilanteDashboard } from './VigilanteDashboard';

/**
 * Selector de dashboard según el rol del usuario autenticado.
 * Cada rol tiene su propia vista construida con el Design System.
 */
export function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  switch (user.rol) {
    case 'ADMIN':
      return <AdminDashboard />;
    case 'JEFE':
      return <JefeDashboard />;
    case 'DIRECTORA':
      return <DirectoraDashboard />;
    case 'RRHH':
      return <RrhhDashboard />;
    case 'VIGILANTE':
      return <VigilanteDashboard />;
    case 'ESPECIALISTA':
    default:
      return <EspecialistaDashboard />;
  }
}
