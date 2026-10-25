// ===========================================================
// Dashboard del rol JEFE (Design System · tema claro)
//
// Papeletas pendientes de su equipo, presencia del equipo y delegaciones
// de aprobación vigentes.
// ===========================================================

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  DocumentCheckIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { papeletaService } from '../../services/papeleta.service';
import { asistenciaService } from '../../services/asistencia.service';
import { delegacionService } from '../../services/delegacion.service';
import { Card } from '../../components/ui/Card';
import { extraerFechaLocal, extraerHoraLocal } from '../../utils/fechaHora';
import type { Delegacion, Papeleta, PresenciaItem } from '../../types';

function formatearPeriodo(papeleta: Papeleta): string {
  const inicio = extraerFechaLocal(papeleta.fechaInicio) || '—';
  const fin = extraerFechaLocal(papeleta.fechaFin) || '—';

  if (papeleta.tipoTiempo === 'HORAS') {
    const desde = papeleta.horaSalida
      ? papeleta.horaSalida.slice(0, 5)
      : extraerHoraLocal(papeleta.fechaInicio) || '—';
    const hasta = papeleta.horaRetorno
      ? papeleta.horaRetorno.slice(0, 5)
      : extraerHoraLocal(papeleta.fechaFin) || '—';
    return `${inicio} · ${desde}–${hasta}`;
  }

  return inicio === fin ? inicio : `${inicio} → ${fin}`;
}

function nombreDe(
  usuario: Delegacion['titular'] | undefined,
  id: number,
): string {
  return usuario ? `${usuario.nombres} ${usuario.apellidos}` : `Usuario #${id}`;
}

function descripcionDelegacion(delegacion: Delegacion, usuarioId: number): string {
  const titular = nombreDe(delegacion.titular, delegacion.titularId);
  const encargado = nombreDe(delegacion.encargado, delegacion.encargadoId);
  const fin = extraerFechaLocal(delegacion.fechaFin);
  const accion =
    delegacion.titularId === usuarioId
      ? `Delegaste la aprobación a ${encargado}`
      : `Estás cubriendo la aprobación de ${titular}`;
  return `${accion}${fin ? ` · hasta ${fin}` : ''}`;
}

export function JefeDashboard() {
  const { user } = useAuth();
  const usuarioId = user?.id;

  const [pendientes, setPendientes] = useState<Papeleta[]>([]);
  const [presencia, setPresencia] = useState<PresenciaItem[]>([]);
  const [delegaciones, setDelegaciones] = useState<Delegacion[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargarResumen = useCallback(async () => {
    if (usuarioId === undefined) return;

    const [resPapeletas, resPresencia, resDelegaciones] = await Promise.allSettled([
      papeletaService.listarPapeletas({ estado: 'PENDIENTE' }),
      asistenciaService.obtenerPresencia(),
      delegacionService.listar({ soloVigentes: true }),
    ]);

    if (resPapeletas.status === 'fulfilled') setPendientes(resPapeletas.value);
    if (resPresencia.status === 'fulfilled') {
      // El servicio declara un tipo reducido (sin nombres/apellidos) aunque el
      // backend sí los devuelve; se ensancha al tipo global para listarlos.
      setPresencia(resPresencia.value as unknown as PresenciaItem[]);
    }
    if (resDelegaciones.status === 'fulfilled') setDelegaciones(resDelegaciones.value);

    setCargando(false);
  }, [usuarioId]);

  useEffect(() => {
    cargarResumen();
  }, [cargarResumen]);

  if (!user) return null;

  const presentes = presencia.filter((p) => p.estado === 'PRESENTE');
  const ausentes = presencia.filter((p) => p.estado === 'AUSENTE');

  const kpis = [
    {
      label: 'Papeletas por aprobar',
      valor: cargando ? null : String(pendientes.length),
      detalle: 'Pendientes de tu equipo',
      Icono: DocumentCheckIcon,
      claseIcono: 'bg-state-warning-bg text-state-warning-fg',
    },
    {
      label: 'Personal presente',
      valor: cargando ? null : String(presentes.length),
      detalle: 'Con entrada registrada hoy',
      Icono: CheckCircleIcon,
      claseIcono: 'bg-state-success-bg text-state-success-fg',
    },
    {
      label: 'Personal ausente',
      valor: cargando ? null : String(ausentes.length),
      detalle: 'Sin entrada registrada hoy',
      Icono: XCircleIcon,
      claseIcono: 'bg-state-error-bg text-state-error-fg',
    },
  ];

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] bg-surface-bg px-6 py-8 text-content-primary">
      <div className="space-y-6">
        <header>
          <h1 className="heading-1">Panel de jefatura</h1>
          <p className="body-muted mt-1">
            {user.nombres} ·{' '}
            {new Date().toLocaleDateString('es-PE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </header>

        {delegaciones.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-ds-lg bg-state-success-bg px-4 py-3">
            <ArrowsRightLeftIcon className="h-5 w-5 shrink-0 text-state-success-fg" />
            <span className="badge-success">
              {delegaciones.length > 1
                ? `${delegaciones.length} delegaciones activas`
                : 'Delegación activa'}
            </span>
            <p className="text-xs text-state-success-fg">
              {descripcionDelegacion(delegaciones[0], user.id)}
              {delegaciones.length > 1 && ` · y ${delegaciones.length - 1} más`}
            </p>
          </div>
        )}

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

        {/* Papeletas del equipo + personal presente */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card theme="light">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="heading-3">Papeletas pendientes</h2>
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
            ) : pendientes.length === 0 ? (
              <p className="rounded-ds-md border border-line-light bg-surface-bg px-4 py-4 text-sm text-content-secondary">
                No hay papeletas pendientes de aprobación.
              </p>
            ) : (
              <ul className="divide-y divide-line-light">
                {pendientes.slice(0, 5).map((papeleta) => (
                  <li
                    key={papeleta.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-content-primary">
                        {papeleta.numero}
                        {papeleta.solicitante && (
                          <span className="ml-2 text-xs font-normal text-content-secondary">
                            {papeleta.solicitante.nombres} {papeleta.solicitante.apellidos}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-content-secondary">{papeleta.motivo}</p>
                      <p className="mt-0.5 text-xs text-content-secondary">
                        {formatearPeriodo(papeleta)}
                      </p>
                    </div>
                    <Link to={`/papeletas/${papeleta.id}`} className="btn-primary btn-sm">
                      Revisar
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card theme="light">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="heading-3">Personal presente</h2>
              <span className="badge-success">{presentes.length} presentes</span>
            </div>

            {cargando ? (
              <div className="space-y-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-10 animate-pulse rounded-ds-sm bg-line-light" />
                ))}
              </div>
            ) : presentes.length === 0 ? (
              <p className="rounded-ds-md border border-line-light bg-surface-bg px-4 py-4 text-sm text-content-secondary">
                Ningún trabajador del equipo se ha registrado hoy.
              </p>
            ) : (
              <ul className="divide-y divide-line-light">
                {presentes.map((item) => (
                  <li
                    key={item.usuarioId}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-content-primary">
                        {item.nombres} {item.apellidos}
                      </p>
                      <p className="text-xs text-content-secondary">
                        {item.jefatura?.nombre ?? 'Sin jefatura'} · Entrada{' '}
                        {item.ultimoMovimiento
                          ? extraerHoraLocal(item.ultimoMovimiento) || '—'
                          : '—'}
                      </p>
                    </div>
                    <span className="badge-success">Presente</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
