// ===========================================================
// Dashboard del rol ADMIN (Design System · tema claro)
//
// Resumen del sistema, alerta de papeletas bloqueadas y accesos a los
// módulos de administración.
// ===========================================================

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowsRightLeftIcon,
  ArrowRightIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  IdentificationIcon,
  QrCodeIcon,
  UserGroupIcon,
  UsersIcon,
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
  clase: string;
}

const ACCESOS: TarjetaAcceso[] = [
  {
    label: 'Gestionar usuarios',
    descripcion: 'Crear, editar y desactivar usuarios',
    ruta: '/usuarios',
    Icono: UserGroupIcon,
    clase: 'bg-state-info-bg text-state-info-fg',
  },
  {
    label: 'Gestionar jefaturas',
    descripcion: 'Configurar estructura organizacional',
    ruta: '/jefaturas',
    Icono: BuildingOfficeIcon,
    clase: 'bg-state-info-bg text-state-info-fg',
  },
  {
    label: 'Delegaciones',
    descripcion: 'Delegar la aprobación de papeletas',
    ruta: '/delegaciones',
    Icono: ArrowsRightLeftIcon,
    clase: 'bg-state-warning-bg text-state-warning-fg',
  },
  {
    label: 'Asistencias',
    descripcion: 'Registros de entrada y salida',
    ruta: '/asistencias',
    Icono: ClipboardDocumentListIcon,
    clase: 'bg-state-success-bg text-state-success-fg',
  },
  {
    label: 'Papeletas',
    descripcion: 'Gestión de permisos de salida',
    ruta: '/papeletas',
    Icono: DocumentCheckIcon,
    clase: 'bg-state-warning-bg text-state-warning-fg',
  },
  {
    label: 'Visitas',
    descripcion: 'Control de visitantes en sede',
    ruta: '/visitas',
    Icono: IdentificationIcon,
    clase: 'bg-state-success-bg text-state-success-fg',
  },
  {
    label: 'Verificar token',
    descripcion: 'Comprobar validez de una papeleta',
    ruta: '/verificar-token',
    Icono: QrCodeIcon,
    clase: 'bg-line-light text-content-secondary',
  },
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
        new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime(),
    );

  const resumen = [
    {
      label: 'Usuarios activos',
      valor: usuariosActivos === null ? '—' : String(usuariosActivos),
      detalle: 'Cuentas habilitadas',
      Icono: UsersIcon,
      claseIcono: 'bg-state-info-bg text-state-info-fg',
    },
    {
      label: 'Papeletas pendientes',
      valor: cargando ? '—' : String(papeletasPendientes.length),
      detalle: 'En espera de aprobación',
      Icono: DocumentTextIcon,
      claseIcono: 'bg-state-warning-bg text-state-warning-fg',
    },
    {
      label: 'Papeletas bloqueadas',
      valor: cargando ? '—' : String(bloqueadas.length),
      detalle: 'Sin aprobador asignado',
      Icono: ExclamationTriangleIcon,
      claseIcono: 'bg-state-error-bg text-state-error-fg',
    },
  ];

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] bg-surface-bg px-6 py-8 text-content-primary">
      <div className="space-y-6">
        <header>
          <h1 className="heading-1">Panel de administración</h1>
          <p className="body-muted mt-1">
            {new Date().toLocaleDateString('es-PE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </header>
        {/* Resumen rápido */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resumen.map(({ label, valor, detalle, Icono, claseIcono }) => (
            <div key={label} className="kpi-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-content-secondary">
                    {label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-content-primary">{valor}</p>
                  <p className="mt-1 text-xs text-content-secondary">{detalle}</p>
                </div>
                <span className={`shrink-0 rounded-ds-md p-2.5 ${claseIcono}`}>
                  <Icono className="h-5 w-5" />
                </span>
              </div>
            </div>
          ))}
        </div>
        {/* Bloque A: papeletas sin aprobador válido */}
        {user.rol === 'ADMIN' && (
          <Card theme="light">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 heading-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-state-error-fg" />
                Papeletas bloqueadas
              </h2>
              <Link
                to="/papeletas"
                className="flex items-center gap-1 text-xs font-medium text-brand-blue hover:text-brand-blue-hover"
              >
                Ver papeletas <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>

            {cargando ? (
              <div className="space-y-2">
                {[1, 2].map((n) => (
                  <div key={n} className="h-10 animate-pulse rounded-ds-sm bg-line-light" />
                ))}
              </div>
            ) : bloqueadas.length === 0 ? (
              <div className="flex items-center gap-2 rounded-ds-md border border-line-light bg-surface-bg p-4 text-sm text-content-secondary">
                <CheckCircleIcon className="h-5 w-5 shrink-0 text-state-success-fg" />
                No hay papeletas bloqueadas: todas tienen un aprobador válido.
              </div>
            ) : (
              <>
                <p className="mb-3 text-xs text-content-secondary">
                  Quedaron sin aprobador por jerarquía incompleta o porque el titular está
                  marcado como P1C sin delegación vigente.
                </p>
                <ul className="divide-y divide-line-light overflow-hidden rounded-ds-md border border-line-light">
                  {bloqueadas.slice(0, 5).map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 bg-surface-card px-4 py-3"
                    >
                      <div>
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-content-primary">
                          {p.numero}
                          <span className="badge-error">Bloqueada</span>
                        </p>
                        <p className="text-xs text-content-secondary">
                          {p.solicitante
                            ? `${p.solicitante.nombres} ${p.solicitante.apellidos}`
                            : `Solicitante #${p.solicitanteId}`}
                          {' · '}
                          {new Date(p.fechaCreacion).toLocaleDateString('es-PE')}
                        </p>
                      </div>
                      <Link
                        to={`/papeletas/${p.id}`}
                        className="text-xs font-medium text-brand-blue hover:text-brand-blue-hover"
                      >
                        Desbloquear
                      </Link>
                    </li>
                  ))}
                </ul>
                {bloqueadas.length > 5 && (
                  <p className="mt-2 text-xs text-content-secondary">
                    y {bloqueadas.length - 5} papeleta(s) bloqueada(s) más.
                  </p>
                )}
              </>
            )}
          </Card>
        )}
        {/* Grid de accesos */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-content-secondary">
            Módulos del sistema
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ACCESOS.map(({ label, descripcion, ruta, Icono, clase }) => (
              <Link
                key={ruta}
                to={ruta}
                className="flex items-start gap-4 rounded-ds-lg border border-line-light bg-surface-card p-4 shadow-card transition-colors hover:border-brand-blue hover:bg-surface-bg"
              >
                <div className={`mt-0.5 rounded-ds-md p-2 ${clase}`}>
                  <Icono className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-content-primary">{label}</p>
                  <p className="text-xs text-content-secondary">{descripcion}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>



      </div>
    </div>
  );
}
