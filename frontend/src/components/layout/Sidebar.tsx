import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  IdentificationIcon,
  DocumentCheckIcon,
  QrCodeIcon,
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import type { Rol } from '../../types';

const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  RRHH: 'RRHH',
  DIRECTORA: 'Directora',
  JEFE: 'Jefe',
  ESPECIALISTA: 'Especialista',
  VIGILANTE: 'Vigilante',
};

interface NavItem {
  label: string;
  ruta: string;
  Icono: typeof HomeIcon;
  roles: Rol[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', ruta: '/dashboard', Icono: HomeIcon, roles: ['ADMIN', 'RRHH', 'DIRECTORA', 'JEFE', 'ESPECIALISTA', 'VIGILANTE'] },
  { label: 'Usuarios', ruta: '/usuarios', Icono: UserGroupIcon, roles: ['ADMIN'] },
  { label: 'Jefaturas', ruta: '/jefaturas', Icono: BuildingOfficeIcon, roles: ['ADMIN'] },
  { label: 'Asistencias', ruta: '/asistencias', Icono: ClipboardDocumentListIcon, roles: ['VIGILANTE', 'ADMIN', 'RRHH'] },
  { label: 'Mis Asistencias', ruta: '/mis-asistencias', Icono: ClipboardDocumentListIcon, roles: ['ESPECIALISTA', 'JEFE', 'DIRECTORA'] },
  { label: 'Papeletas', ruta: '/papeletas', Icono: DocumentCheckIcon, roles: ['ADMIN', 'RRHH', 'DIRECTORA', 'JEFE', 'ESPECIALISTA', 'VIGILANTE'] },
  { label: 'Visitas', ruta: '/visitas', Icono: IdentificationIcon, roles: ['VIGILANTE', 'ADMIN', 'RRHH', 'JEFE', 'DIRECTORA', 'ESPECIALISTA'] },
  { label: 'Verificar Token', ruta: '/verificar-token', Icono: QrCodeIcon, roles: ['VIGILANTE', 'ADMIN', 'RRHH'] },
];

const LINK_ACTIVO = 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium bg-emerald-600/20 text-emerald-400';
const LINK_INACTIVO = 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-gray-100 transition-colors';

export function Sidebar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const itemsVisibles = NAV_ITEMS.filter((item) => item.roles.includes(user.rol));

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-gray-800 bg-gray-950">
      {/* Logo / nombre app */}
      <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-4">
        <ShieldCheckIcon className="h-7 w-7 text-emerald-500" />
        <div>
          <p className="text-sm font-bold text-gray-100 leading-none">SIGPER</p>
          <p className="text-xs text-gray-500">UGEL Talara</p>
        </div>
      </div>

      {/* Perfil del usuario */}
      <div className="border-b border-gray-800 px-4 py-3">
        <p className="text-sm font-semibold text-gray-100 truncate">{user.nombres}</p>
        <span className="mt-0.5 inline-block rounded-full bg-emerald-900/60 px-2 py-0.5 text-xs font-medium text-emerald-400">
          {ETIQUETA_ROL[user.rol]}
        </span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {itemsVisibles.map(({ label, ruta, Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            className={({ isActive }) => (isActive ? LINK_ACTIVO : LINK_INACTIVO)}
          >
            <Icono className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Cerrar sesión */}
      <div className="border-t border-gray-800 p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors"
        >
          <ArrowRightOnRectangleIcon className="h-4 w-4 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
