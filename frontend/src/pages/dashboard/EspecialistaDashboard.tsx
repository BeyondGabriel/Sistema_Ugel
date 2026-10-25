// ===========================================================
// Dashboard del rol ESPECIALISTA (Design System · tema claro)
//
// Resumen personal: papeletas activas propias, días asistidos en el mes
// en curso y notificaciones sin leer.
// ===========================================================

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BellIcon,
  CalendarDaysIcon,
  DocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { papeletaService } from '../../services/papeleta.service';
import { asistenciaService } from '../../services/asistencia.service';
import { notificacionService } from '../../services/notificacion.service';
import { Card } from '../../components/ui/Card';
import { extraerFechaLocal, extraerHoraLocal } from '../../utils/fechaHora';
import type { EstadoPapeleta, Notificacion, Papeleta } from '../../types';

/** Estados que el solicitante considera "papeleta activa". */
const ESTADOS_ACTIVOS: EstadoPapeleta[] = ['PENDIENTE', 'EN_REVISION', 'OBSERVADO'];

const ETIQUETA_ESTADO: Partial<Record<EstadoPapeleta, string>> = {
  PENDIENTE: 'Pendiente',
  EN_REVISION: 'En revisión',
  OBSERVADO: 'Observado',
};

/** Clase de badge del Design System según el estado de la papeleta. */
function claseEstado(estado: EstadoPapeleta): string {
  if (estado === 'PENDIENTE') return 'badge-warning';
  if (estado === 'EN_REVISION') return 'badge-info';
  if (estado === 'OBSERVADO') return 'badge-error';
  if (estado === 'APROBADO') return 'badge-success';
  return 'badge bg-line-light text-content-secondary';
}

/** Primer día del mes actual en formato "YYYY-MM-DD" (zona local). */
function primerDiaDelMesLocal(): string {
  const hoy = new Date();
  const anio = String(hoy.getFullYear()).padStart(4, '0');
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  return `${anio}-${mes}-01`;
}

function horaCorta(valor: string | null | undefined, iso: string): string {
  if (valor) return valor.slice(0, 5);
  return extraerHoraLocal(iso) || '—';
}

function formatearPeriodo(papeleta: Papeleta): string {
  const inicio = extraerFechaLocal(papeleta.fechaInicio) || '—';
  const fin = extraerFechaLocal(papeleta.fechaFin) || '—';

  if (papeleta.tipoTiempo === 'HORAS') {
    const desde = horaCorta(papeleta.horaSalida, papeleta.fechaInicio);
    const hasta = horaCorta(papeleta.horaRetorno, papeleta.fechaFin);
    return `${inicio} · ${desde}–${hasta}`;
  }

  return inicio === fin ? inicio : `${inicio} → ${fin}`;
}

export function EspecialistaDashboard() {
  const { user } = useAuth();
  const usuarioId = user?.id;

  const [papeletas, setPapeletas] = useState<Papeleta[]>([]);
  const [diasAsistidos, setDiasAsistidos] = useState<number | null>(null);
  const [noLeidas, setNoLeidas] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);

  // Se usa `allSettled`: el fallo de una consulta no oculta los datos de las
  // otras dos tarjetas.
  const cargarResumen = useCallback(async () => {
    if (usuarioId === undefined) return;

    const [resPapeletas, resAsistencias, resNotificaciones] = await Promise.allSettled([
      papeletaService.listarPapeletas(),
      asistenciaService.listarMovimientos({
        usuarioId,
        fechaInicio: primerDiaDelMesLocal(),
      }),
      notificacionService.listarNotificaciones(true),
    ]);

    if (resPapeletas.status === 'fulfilled') {
      setPapeletas(
        resPapeletas.value
          .filter((p) => ESTADOS_ACTIVOS.includes(p.estado))
          .sort(
            (a, b) =>
              new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime(),
          ),
      );
    }

    if (resAsistencias.status === 'fulfilled') {
      const dias = new Set(
        resAsistencias.value
          .filter((movimiento) => movimiento.tipo === 'ENTRADA')
          .map((movimiento) => extraerFechaLocal(movimiento.timestamp))
          .filter((fecha) => fecha.length > 0),
      );
      setDiasAsistidos(dias.size);
    }

    if (resNotificaciones.status === 'fulfilled') {
      const respuesta = resNotificaciones.value as {
        notificaciones?: Notificacion[];
        noLeidas?: number;
      };
      setNoLeidas(respuesta.noLeidas ?? respuesta.notificaciones?.length ?? 0);
    }

    setCargando(false);
  }, [usuarioId]);

  useEffect(() => {
    cargarResumen();
  }, [cargarResumen]);

  if (!user) return null;

  const kpis = [
    {
      label: 'Mis papeletas activas',
      valor: cargando ? null : String(papeletas.length),
      detalle: 'Pendientes, en revisión u observadas',
      Icono: DocumentCheckIcon,
      claseIcono: 'bg-state-info-bg text-state-info-fg',
    },
    {
      label: 'Días asistidos este mes',
      valor: cargando ? null : String(diasAsistidos ?? 0),
      detalle: new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }),
      Icono: CalendarDaysIcon,
      claseIcono: 'bg-state-success-bg text-state-success-fg',
    },
    {
      label: 'Notificaciones sin leer',
      valor: cargando ? null : String(noLeidas ?? 0),
      detalle: 'Avisos de tus papeletas y delegaciones',
      Icono: BellIcon,
      claseIcono: 'bg-state-warning-bg text-state-warning-fg',
    },
  ];

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] bg-surface-bg px-6 py-8 text-content-primary">
      <div className="space-y-6">
        <header>
          <h1 className="heading-1">Mi panel</h1>
          <p className="body-muted mt-1">
            Hola, {user.nombres}.{' '}
            {new Date().toLocaleDateString('es-PE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </header>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map(({ label, valor, detalle, Icono, claseIcono }) => (
            <div key={label} className="kpi-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-content-secondary">
                    {label}
                  </p>
                  {valor === null ? (
                    <div className="mt-2 h-9 w-16 animate-pulse rounded-ds-sm bg-line-light" />
                  ) : (
                    <p className="mt-2 text-3xl font-bold text-content-primary">{valor}</p>
                  )}
                  <p className="mt-1 text-xs text-content-secondary">{detalle}</p>
                </div>
                <span className={`shrink-0 rounded-ds-md p-2.5 ${claseIcono}`}>
                  <Icono className="h-5 w-5" />
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Últimas papeletas activas */}
        <Card theme="light">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="heading-3">Mis últimas papeletas activas</h2>
            <Link
              to="/papeletas"
              className="text-sm font-medium text-brand-blue hover:text-brand-blue-hover"
            >
              Ver todas
            </Link>
          </div>

          {cargando ? (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-10 animate-pulse rounded-ds-sm bg-line-light" />
              ))}
            </div>
          ) : papeletas.length === 0 ? (
            <p className="rounded-ds-md border border-line-light bg-surface-bg px-4 py-4 text-sm text-content-secondary">
              No tienes papeletas activas en este momento.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-ds-md border border-line-light">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface-bg text-xs uppercase tracking-wide text-content-secondary">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Número</th>
                    <th className="px-4 py-3 font-semibold">Motivo</th>
                    <th className="px-4 py-3 font-semibold">Periodo</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-light bg-surface-card">
                  {papeletas.slice(0, 5).map((papeleta) => (
                    <tr key={papeleta.id} className="transition-colors hover:bg-surface-bg">
                      <td className="px-4 py-3 font-medium text-content-primary">
                        {papeleta.numero}
                      </td>
                      <td className="px-4 py-3 text-content-secondary">{papeleta.motivo}</td>
                      <td className="px-4 py-3 text-content-secondary">
                        {formatearPeriodo(papeleta)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={claseEstado(papeleta.estado)}>
                          {ETIQUETA_ESTADO[papeleta.estado] ?? papeleta.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/papeletas/${papeleta.id}`}
                          className="text-xs font-medium text-brand-blue hover:text-brand-blue-hover"
                        >
                          Ver detalle
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
