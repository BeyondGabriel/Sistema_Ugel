// ===========================================================
// Dashboard del rol VIGILANTE (Design System · tema claro)
//
// Presencia del personal en sede y accesos a las tareas de portería.
// ===========================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  DocumentCheckIcon,
  IdentificationIcon,
  QrCodeIcon,
  UserCircleIcon,
  UsersIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { api } from '../../services/api';
import { Card } from '../../components/ui/Card';
import { extraerHoraLocal } from '../../utils/fechaHora';
import type { PresenciaItem } from '../../types';

const ACCESOS = [
  {
    label: 'Registrar asistencia',
    ruta: '/asistencias',
    Icono: ClipboardDocumentListIcon,
    clase: 'bg-state-info-bg text-state-info-fg',
  },
  {
    label: 'Registrar visita',
    ruta: '/visitas',
    Icono: IdentificationIcon,
    clase: 'bg-state-info-bg text-state-info-fg',
  },
  {
    label: 'Mis papeletas',
    ruta: '/papeletas',
    Icono: DocumentCheckIcon,
    clase: 'bg-state-warning-bg text-state-warning-fg',
  },
  {
    label: 'Verificar token',
    ruta: '/verificar-token',
    Icono: QrCodeIcon,
    clase: 'bg-state-success-bg text-state-success-fg',
  },
];

export function VigilanteDashboard() {
  const { user } = useAuth();
  const { mostrar } = useToast();
  const [presencia, setPresencia] = useState<PresenciaItem[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarPresencia() {
      try {
        const { data } = await api.get<{ presencia: PresenciaItem[] }>(
          '/asistencias/presencia',
        );
        setPresencia(data.presencia);
      } catch {
        mostrar('No se pudo cargar el estado de presencia', 'error');
      } finally {
        setCargando(false);
      }
    }
    cargarPresencia();
  }, [mostrar]);

  if (!user) return null;

  const presentes = presencia.filter((p) => p.estado === 'PRESENTE');
  const ausentes = presencia.filter((p) => p.estado === 'AUSENTE');

  const kpis = [
    {
      label: 'Presentes ahora',
      valor: cargando ? null : String(presentes.length),
      detalle: 'Con entrada registrada',
      Icono: CheckCircleIcon,
      claseIcono: 'bg-state-success-bg text-state-success-fg',
    },
    {
      label: 'Ausentes / sin registro',
      valor: cargando ? null : String(ausentes.length),
      detalle: 'Sin marcación el día de hoy',
      Icono: XCircleIcon,
      claseIcono: 'bg-state-error-bg text-state-error-fg',
    },
    {
      label: 'Total trabajadores',
      valor: cargando ? null : String(presencia.length),
      detalle: 'Padrón considerado',
      Icono: UsersIcon,
      claseIcono: 'bg-state-info-bg text-state-info-fg',
    },
  ];

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] bg-surface-bg px-6 py-8 text-content-primary">
      <div className="space-y-6">
        <header>
          <h1 className="heading-1">Panel de Vigilancia</h1>
          <p className="body-muted mt-1">
            {new Date().toLocaleDateString('es-PE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </header>
        {/* Contadores de presencia */}
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
        {/* Lista de presencia */}
        <Card theme="light">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="heading-3">Trabajadores presentes</h2>
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
              Ningún trabajador se ha registrado hoy.
            </p>
          ) : (
            <ul className="divide-y divide-line-light">
              {presentes.map((item) => (
                <li key={item.usuarioId} className="flex items-center gap-3 py-2.5">
                  <UserCircleIcon className="h-7 w-7 shrink-0 text-state-success-fg" />
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
                  <span className="badge-success ml-auto">Presente</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {/* Accesos rápidos */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-content-secondary">
            Acciones frecuentes
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ACCESOS.map(({ label, ruta, Icono, clase }) => (
              <Link
                key={ruta}
                to={ruta}
                className="flex items-center gap-3 rounded-ds-lg border border-line-light bg-surface-card p-4 shadow-card transition-colors hover:border-brand-blue hover:bg-surface-bg"
              >
                <span className={`rounded-ds-md p-2 ${clase}`}>
                  <Icono className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium text-content-primary">{label}</span>
              </Link>
            ))}
          </div>
        </div>



      </div>
    </div>
  );
}
