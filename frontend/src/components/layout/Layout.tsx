import { type ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { Sidebar, ETIQUETA_ROL } from './Sidebar';
import { CampanitaNotificaciones } from './CampanitaNotificaciones';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../hooks/useAuth';

/**
 * Páginas que YA han sido migradas al tema claro.
 * Cuando se migre una página, añadir su ruta aquí.
 * Por ahora está vacío (todas las páginas usan el fondo oscuro de transición).
 */
const MIGRATED_PATHS: string[] = [];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/usuarios': 'Usuarios',
  '/usuarios/nuevo': 'Nuevo usuario',
  '/jefaturas': 'Jefaturas',
  '/asistencias': 'Asistencias',
  '/asistencias/registro': 'Registro de asistencia',
  '/mis-asistencias': 'Mis Asistencias',
  '/papeletas': 'Papeletas',
  '/papeletas/nueva': 'Nueva papeleta',
  '/visitas': 'Visitas',
  '/visitas/registro': 'Registrar visita',
  '/notificaciones': 'Notificaciones',
  '/verificar-token': 'Verificar Token',
};

function obtenerTitulo(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const match = Object.keys(PAGE_TITLES)
    .filter((k) => pathname.startsWith(k) && k !== '/')
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_TITLES[match] : 'SIGPER';
}

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { socket } = useSocket();
  const { user } = useAuth();
  const [conectado, setConectado] = useState<boolean>(() => socket?.connected ?? false);
  // Drawer de navegación en móvil (< md). En escritorio el sidebar siempre
  // está visible y este estado no tiene efecto.
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const migrada = MIGRATED_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + '/'),
  );

  // El estado `connected` del socket no provoca renders por sí solo:
  // se escuchan los eventos para que el indicador se actualice en vivo.
  useEffect(() => {
    setConectado(socket?.connected ?? false);
    if (!socket) return;

    const alConectar = () => setConectado(true);
    const alDesconectar = () => setConectado(false);

    socket.on('connect', alConectar);
    socket.on('disconnect', alDesconectar);

    return () => {
      socket.off('connect', alConectar);
      socket.off('disconnect', alDesconectar);
    };
  }, [socket]);

  // Al cambiar de ruta se cierra el drawer móvil.
  useEffect(() => {
    setMenuMovilAbierto(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar mobileAbierto={menuMovilAbierto} onCerrarMovil={() => setMenuMovilAbierto(false)} />

      {/* Backdrop del drawer móvil */}
      {menuMovilAbierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMenuMovilAbierto(false)}
          className="fixed inset-0 z-30 bg-brand-navy/50 md:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 bg-brand-navy px-4 text-content-inverse sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(true)}
              aria-label="Abrir menú"
              aria-expanded={menuMovilAbierto}
              className="rounded-md p-1.5 text-content-inverse/80 transition-colors hover:bg-brand-navyLight hover:text-content-inverse md:hidden"
            >
              <Bars3Icon className="h-5 w-5" aria-hidden="true" />
            </button>
            <h1 className="truncate text-base font-semibold">{obtenerTitulo(location.pathname)}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            {/* Status indicator (el texto se oculta en pantallas muy pequeñas) */}
            <div className="flex items-center gap-2 text-xs text-content-inverse/70">
              <span
                className={`inline-block h-2 w-2 rounded-full ${conectado ? 'bg-green-400' : 'bg-red-400'}`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">{conectado ? 'En línea' : 'Desconectado'}</span>
            </div>

            {/* Notificaciones */}
            <CampanitaNotificaciones />

            {/* Usuario */}
            {user && (
              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-sm font-semibold text-content-onYellow"
                  aria-hidden="true"
                >
                  {user.nombres.charAt(0).toUpperCase()}
                </div>
                <div className="hidden leading-tight sm:block">
                  <p className="text-sm font-medium text-content-inverse">{user.nombres}</p>
                  <p className="text-[11px] text-content-inverse/60">{ETIQUETA_ROL[user.rol]}</p>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div
            className={[
              'min-h-full',
              migrada ? 'bg-surface-bg text-content-primary' : 'bg-gray-900 text-gray-100',
            ].join(' ')}
          >
            <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
