import { Link } from 'react-router-dom';
import {
  UserGroupIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
  DocumentCheckIcon,
  IdentificationIcon,
  QrCodeIcon,
  UsersIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/ui/Card';

interface TarjetaAcceso {
  label: string;
  descripcion: string;
  ruta: string;
  Icono: typeof UserGroupIcon;
  color: string;
  bg: string;
}

const ACCESOS: TarjetaAcceso[] = [
  { label: 'Gestionar usuarios', descripcion: 'Crear, editar y desactivar usuarios', ruta: '/usuarios', Icono: UserGroupIcon, color: 'text-blue-400', bg: 'bg-blue-900/40' },
  { label: 'Gestionar jefaturas', descripcion: 'Configurar estructura organizacional', ruta: '/jefaturas', Icono: BuildingOfficeIcon, color: 'text-violet-400', bg: 'bg-violet-900/40' },
  { label: 'Asistencias', descripcion: 'Registros de entrada y salida', ruta: '/asistencias', Icono: ClipboardDocumentListIcon, color: 'text-cyan-400', bg: 'bg-cyan-900/40' },
  { label: 'Papeletas', descripcion: 'Gestión de permisos de salida', ruta: '/papeletas', Icono: DocumentCheckIcon, color: 'text-amber-400', bg: 'bg-amber-900/40' },
  { label: 'Visitas', descripcion: 'Control de visitantes en sede', ruta: '/visitas', Icono: IdentificationIcon, color: 'text-emerald-400', bg: 'bg-emerald-900/40' },
  { label: 'Verificar token', descripcion: 'Comprobar validez de una papeleta', ruta: '/verificar-token', Icono: QrCodeIcon, color: 'text-gray-400', bg: 'bg-gray-700/60' },
];

export function AdminDashboard() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Panel de administración</h1>
        <p className="mt-1 text-sm text-gray-400">
          {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Resumen rápido (placeholders) */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Usuarios activos', valor: '—', Icono: UsersIcon, color: 'text-blue-400', bg: 'bg-blue-900/40' },
          { label: 'Papeletas pendientes hoy', valor: '—', Icono: DocumentTextIcon, color: 'text-amber-400', bg: 'bg-amber-900/40' },
          { label: 'Visitas activas ahora', valor: '—', Icono: IdentificationIcon, color: 'text-emerald-400', bg: 'bg-emerald-900/40' },
        ].map(({ label, valor, Icono, color, bg }) => (
          <Card key={label}>
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2.5 ${bg}`}>
                <Icono className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-100">{valor}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-600">Se conectará al API en la siguiente fase</p>
          </Card>
        ))}
      </div>

      {/* Grid de accesos */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Módulos del sistema
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACCESOS.map(({ label, descripcion, ruta, Icono, color, bg }) => (
            <Link
              key={ruta}
              to={ruta}
              className="flex items-start gap-4 rounded-xl border border-gray-700 bg-gray-800 p-4 hover:border-emerald-700 hover:bg-gray-700 transition-colors"
            >
              <div className={`mt-0.5 rounded-lg p-2 ${bg}`}>
                <Icono className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-100">{label}</p>
                <p className="text-xs text-gray-400">{descripcion}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
