import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  IdentificationIcon,
  DocumentCheckIcon,
  QrCodeIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import type { Rol } from '../../types';

const STORAGE_KEY = 'sigper:sidebar-collapsed';

/** Etiqueta legible de cada rol. Se comparte con el Top bar (Layout). */
export const ETIQUETA_ROL: Record<Rol, string> = {
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

interface NavGroup {
  titulo: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    titulo: 'Principal',
    items: [
      { label: 'Dashboard', ruta: '/dashboard', Icono: HomeIcon, roles: ['ADMIN', 'RRHH', 'DIRECTORA', 'JEFE', 'ESPECIALISTA', 'VIGILANTE'] },
      { label: 'Asistencias', ruta: '/asistencias', Icono: ClipboardDocumentListIcon, roles: ['VIGILANTE', 'ADMIN', 'RRHH'] },
      { label: 'Mis Asistencias', ruta: '/mis-asistencias', Icono: ClipboardDocumentListIcon, roles: ['ESPECIALISTA', 'JEFE', 'DIRECTORA'] },
      { label: 'Papeletas', ruta: '/papeletas', Icono: DocumentCheckIcon, roles: ['ADMIN', 'RRHH', 'DIRECTORA', 'JEFE', 'ESPECIALISTA', 'VIGILANTE'] },
      { label: 'Visitas', ruta: '/visitas', Icono: IdentificationIcon, roles: ['VIGILANTE', 'ADMIN', 'RRHH', 'JEFE', 'DIRECTORA', 'ESPECIALISTA'] },
      { label: 'Verificar Token', ruta: '/verificar-token', Icono: QrCodeIcon, roles: ['VIGILANTE', 'ADMIN', 'RRHH'] },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { label: 'Usuarios', ruta: '/usuarios', Icono: UserGroupIcon, roles: ['ADMIN'] },
      { label: 'Jefaturas', ruta: '/jefaturas', Icono: BuildingOfficeIcon, roles: ['ADMIN'] },
      { label: 'Delegaciones', ruta: '/delegaciones', Icono: ArrowsRightLeftIcon, roles: ['ADMIN'] },
    ],
  },
];

interface SidebarProps {
  /** Solo aplica en móvil: controla si el drawer está visible. */
  mobileAbierto?: boolean;
  /** Se llama al navegar o al tocar el backdrop para cerrar el drawer móvil. */
  onCerrarMovil?: () => void;
}

export function Sidebar({ mobileAbierto = false, onCerrarMovil }: SidebarProps) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [colapsado, setColapsado] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(colapsado));
  }, [colapsado]);

  if (!user) return null;

  const groupsVisibles = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(user.rol)),
  })).filter((g) => g.items.length > 0);

  const anchoEscritorio = colapsado ? 'md:w-16' : 'md:w-60';

  // Activo también en rutas hijas (/papeletas/12, /usuarios/nuevo, ...)
  const esActivo = (ruta: string) => pathname === ruta || pathname.startsWith(`${ruta}/`);

  return (
    <aside
      className={[
        // En móvil (< md) el menú es un drawer superpuesto que se abre con el
        // botón hamburguesa del Layout; en escritorio vuelve al flujo normal.
        'fixed inset-y-0 left-0 z-40 flex h-screen w-60 shrink-0 flex-col bg-brand-navy text-content-inverse',
        'transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:transition-[width]',
        anchoEscritorio,
        mobileAbierto ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
    >
      {/* Header / Logo / Chevron */}
      <div className={`flex ${colapsado ? 'flex-col items-center gap-2 py-4' : 'items-start justify-between px-4 py-4'}`}>
        {!colapsado ? (
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="h-7 w-7 shrink-0 stroke-2 text-brand-yellow" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold leading-none text-brand-yellow">SIGPER</p>
              <p className="text-xs text-content-inverse/60">UGEL Talara</p>
            </div>
          </div>
        ) : (
          <ShieldCheckIcon className="h-7 w-7 stroke-2 text-brand-yellow" aria-hidden="true" />
        )}
        <button
          onClick={() => setColapsado(!colapsado)}
          className="hidden rounded-md p-1.5 text-content-inverse/60 transition-colors hover:bg-brand-navyLight hover:text-content-inverse md:block"
          title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
          aria-label={colapsado ? 'Expandir menú' : 'Colapsar menú'}
          aria-expanded={!colapsado}
        >
          {colapsado ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
        </button>
      </div>

      {/* Navegación */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden py-2">
        {groupsVisibles.map((grupo) => (
          <div key={grupo.titulo} className="mb-2">
            {!colapsado && (
              <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-content-inverse/40">
                {grupo.titulo}
              </p>
            )}
            {grupo.items.map(({ label, ruta, Icono }) => {
              const activo = esActivo(ruta);
              return (
                <NavLink
                  key={ruta}
                  to={ruta}
                  title={colapsado ? label : undefined}
                  aria-label={label}
                  onClick={() => onCerrarMovil?.()}
                  className={[
                    'relative mx-2 my-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    colapsado ? 'justify-center' : '',
                    activo
                      ? 'bg-brand-navyLight font-medium text-brand-yellow'
                      : 'text-content-inverse/80 hover:bg-brand-navyLight hover:text-content-inverse',
                  ].join(' ')}
                >
                  {activo && (
                    <span
                      className="absolute bottom-1 left-0 top-1 w-[3px] rounded-r bg-brand-yellow"
                      aria-hidden="true"
                    />
                  )}
                  <Icono className="h-5 w-5 shrink-0 stroke-2" aria-hidden="true" />
                  {!colapsado && <span className="truncate">{label}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer: Cerrar sesión */}
      <div className="border-t border-content-inverse/10 p-2">
        <button
          onClick={logout}
          title={colapsado ? 'Cerrar sesión' : undefined}
          aria-label="Cerrar sesión"
          className={[
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
            colapsado ? 'justify-center' : '',
            'text-content-inverse/70 hover:bg-red-500/15 hover:text-red-300',
          ].join(' ')}
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
          {!colapsado && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
