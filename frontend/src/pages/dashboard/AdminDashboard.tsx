import { useCallback, useEffect, useState } from 'react';
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
  ArrowsRightLeftIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { adminService } from '../../services/admin.service';
import { papeletaService } from '../../services/papeleta.service';
import { Card } from '../../components/ui/Card';
import type { Papeleta } from '../../types';

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
  { label: 'Delegaciones', descripcion: 'Delegar la aprobación de papeletas', ruta: '/delegaciones', Icono: ArrowsRightLeftIcon, color: 'text-rose-400', bg: 'bg-rose-900/40' },
  { label: 'Asistencias', descripcion: 'Registros de entrada y salida', ruta: '/asistencias', Icono: ClipboardDocumentListIcon, color: 'text-cyan-400', bg: 'bg-cyan-900/40' },
  { label: 'Papeletas', descripcion: 'Gestión de permisos de salida', ruta: '/papeletas', Icono: DocumentCheckIcon, color: 'text-amber-400', bg: 'bg-amber-900/40' },
  { label: 'Visitas', descripcion: 'Control de visitantes en sede', ruta: '/visitas', Icono: IdentificationIcon, color: 'text-emerald-400', bg: 'bg-emerald-900/40' },
  { label: 'Verificar token', descripcion: 'Comprobar validez de una papeleta', ruta: '/verificar-token', Icono: QrCodeIcon, color: 'text-gray-400', bg: 'bg-gray-700/60' },
];

export function AdminDashboard() {
  const { user } = useAuth();
  const { papeletaCambios, papeletasBloqueadas } = useSocket();

  const [papeletasPendientes, setPapeletasPendientes] = useState<Papeleta[]>([]);
  const [usuariosActivos, setUsuariosActivos] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);

  // Resumen real desde el API. Se usa `allSettled` para que el fallo de una
  // consulta (p. ej. un rol sin acceso al listado de usuarios) no oculte la
  // información de la otra.
  const cargarResumen = useCallback(async () => {
    const [resPapeletas, resUsuarios] = await Promise.allSettled([
      papeletaService.listarPapeletas({ estado: 'PENDIENTE' }),
      adminService.listarUsuarios({ activo: true }),
    ]);

    if (resPapeletas.status === 'fulfilled') setPapeletasPendientes(resPapeletas.value);
    if (resUsuarios.status === 'fulfilled') setUsuariosActivos(resUsuarios.value.length);
    setCargando(false);
  }, []);

  useEffect(() => {
    cargarResumen();
  }, [cargarResumen]);

  // Refresca el resumen al recibir cambios de papeleta o avisos de bloqueo.
  useEffect(() => {
    if (papeletaCambios.length === 0 && papeletasBloqueadas.length === 0) return;
    cargarResumen();
  }, [papeletaCambios, papeletasBloqueadas, cargarResumen]);

  if (!user) return null;

  // Bloque A: una papeleta está bloqueada cuando requiere un aprobador
  // especial y todavía no tiene uno asignado.
  const bloqueadas = papeletasPendientes
    .filter((p) => p.requiereAprobadorEspecial && !p.aprobadorId)
    .sort(
      (a, b) =>
        new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime()
    );

  const resumen = [
    { label: 'Usuarios activos', valor: usuariosActivos === null ? '—' : String(usuariosActivos), Icono: UsersIcon, color: 'text-blue-400', bg: 'bg-blue-900/40' },
    { label: 'Papeletas pendientes', valor: cargando ? '—' : String(papeletasPendientes.length), Icono: DocumentTextIcon, color: 'text-amber-400', bg: 'bg-amber-900/40' },
    { label: 'Papeletas bloqueadas', valor: cargando ? '—' : String(bloqueadas.length), Icono: ExclamationTriangleIcon, color: 'text-rose-400', bg: 'bg-rose-900/40' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Panel de administración</h1>
        <p className="mt-1 text-sm text-gray-400">
          {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Resumen rápido */}
      <div className="grid gap-4 sm:grid-cols-3">
        {resumen.map(({ label, valor, Icono, color, bg }) => (
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
          </Card>
        ))}
      </div>

      {/* Bloque A: papeletas sin aprobador válido */}
      {user.rol === 'ADMIN' && (
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-100">
              <ExclamationTriangleIcon className="h-5 w-5 text-rose-400" />
              Papeletas bloqueadas
            </h2>
            <Link
              to="/papeletas"
              className="flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
            >
              Ver papeletas <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>

          {cargando ? (
            <p className="py-4 text-center text-sm text-gray-500">Cargando…</p>
          ) : bloqueadas.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 p-4 text-sm text-gray-400">
              <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
              No hay papeletas bloqueadas: todas tienen un aprobador válido.
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-gray-400">
                Quedaron sin aprobador por jerarquía incompleta o porque el titular está
                marcado como P1C sin delegación vigente.
              </p>
              <ul className="divide-y divide-gray-700 overflow-hidden rounded-lg border border-gray-700">
                {bloqueadas.slice(0, 5).map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 bg-gray-900 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-100">
                        {p.numero}
                        <span className="ml-2 rounded-full bg-rose-900/50 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                          Bloqueada
                        </span>
                      </p>
                      <p className="text-xs text-gray-400">
                        {p.solicitante
                          ? `${p.solicitante.nombres} ${p.solicitante.apellidos}`
                          : `Solicitante #${p.solicitanteId}`}
                        {' · '}
                        {new Date(p.fechaCreacion).toLocaleDateString('es-PE')}
                      </p>
                    </div>
                    <Link
                      to={`/papeletas/${p.id}`}
                      className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
                    >
                      Desbloquear
                    </Link>
                  </li>
                ))}
              </ul>
              {bloqueadas.length > 5 && (
                <p className="mt-2 text-xs text-gray-500">
                  y {bloqueadas.length - 5} papeleta(s) bloqueada(s) más.
                </p>
              )}
            </>
          )}
        </Card>
      )}

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
