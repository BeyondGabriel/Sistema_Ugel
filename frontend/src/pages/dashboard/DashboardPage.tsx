import { useAuth } from '../../hooks/useAuth';
import { AdminDashboard } from './AdminDashboard';
import { VigilanteDashboard } from './VigilanteDashboard';

export function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  switch (user.rol) {
    case 'ADMIN':
      return <AdminDashboard />;
    case 'VIGILANTE':
      return <VigilanteDashboard />;
    // Para los demás roles (ESPECIALISTA, JEFE, DIRECTORA, RRHH)
    // usamos un dashboard genérico mientras no esté listo el específico.
    default:
      return <AdminDashboard />; // Placeholder
  }
}