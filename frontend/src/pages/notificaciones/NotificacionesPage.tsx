import { useEffect, useState, useCallback } from 'react';
import { BellIcon, CheckIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { notificacionService } from '../../services/notificacion.service';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import type { Notificacion } from '../../types';

function formatFechaHora(ts: string): string {
  return new Date(ts).toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function NotificacionesPage() {
  const { mostrar } = useToast();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [noLeidas, setNoLeidas] = useState(0);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const [marcandoId, setMarcandoId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { notificaciones: data, noLeidas: count } = await notificacionService.listarNotificaciones();
      setNotificaciones(data);
      setNoLeidas(count);
    } catch {
      mostrar('Error al cargar las notificaciones', 'error');
    } finally {
      setCargando(false);
    }
  }, [mostrar]);

  useEffect(() => { cargar(); }, [cargar]);

  async function marcarLeida(id: number) {
    setMarcandoId(id);
    try {
      await notificacionService.marcarLeida(id);
      setNotificaciones((prev) =>
        prev.map((n) => n.id === id ? { ...n, leida: true } : n),
      );
      setNoLeidas((prev) => Math.max(0, prev - 1));
    } catch {
      mostrar('Error al marcar la notificación', 'error');
    } finally {
      setMarcandoId(null);
    }
  }

  async function marcarTodas() {
    setMarcandoTodas(true);
    try {
      await notificacionService.marcarTodasLeidas();
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
      setNoLeidas(0);
      mostrar('Todas las notificaciones marcadas como leídas', 'success');
    } catch {
      mostrar('Error al marcar las notificaciones', 'error');
    } finally {
      setMarcandoTodas(false);
    }
  }

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] bg-surface-bg px-6 py-8">
      <div className="max-w-2xl space-y-5">
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BellIcon className="h-6 w-6 text-brand-blue" />
            <div>
              <h1 className="text-xl font-bold text-content-primary">Notificaciones</h1>
              <p className="text-sm text-content-secondary">
                {noLeidas > 0 ? `${noLeidas} sin leer` : 'Todo al día'}
              </p>
            </div>
          </div>
          {noLeidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              theme="light"
              disabled={marcandoTodas}
              onClick={marcarTodas}
            >
              <CheckIcon className="h-4 w-4" /> Marcar todas como leídas
            </Button>
          )}
        </div>

        {/* Lista */}
        {cargando ? (
          <div className="flex justify-center py-16">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
          </div>
        ) : notificaciones.length === 0 ? (
          <div className="rounded-ds-lg border border-line-light bg-surface-card py-14 text-center shadow-card">
            <BellIcon className="mx-auto mb-3 h-10 w-10 text-content-tertiary" />
            <p className="text-sm text-content-tertiary">No tienes notificaciones aún</p>
          </div>
        ) : (
          <div className="divide-y divide-line-light overflow-hidden rounded-ds-lg border border-line-light bg-surface-card shadow-card">
            {notificaciones.map((n) => (
              <div
                key={n.id}
                className={[
                  'flex items-start gap-4 px-5 py-4 transition-colors',
                  n.leida ? 'bg-surface-bg opacity-80' : 'bg-surface-card',
                ].join(' ')}
              >
                {/* Indicador */}
                <div className="mt-0.5 shrink-0">
                  {n.leida
                    ? <CheckCircleIcon className="h-5 w-5 text-content-tertiary" />
                    : <span className="mt-1 block h-2.5 w-2.5 rounded-full bg-brand-blue" />
                  }
                </div>

                {/* Contenido */}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-snug ${n.leida ? 'text-content-secondary' : 'text-content-primary'}`}>
                    {n.mensaje}
                  </p>
                  <p className="mt-1 text-xs text-content-tertiary">{formatFechaHora(n.fecha)}</p>
                </div>

                {/* Acción */}
                {!n.leida && (
                  <button
                    onClick={() => marcarLeida(n.id)}
                    disabled={marcandoId === n.id}
                    className="shrink-0 text-xs font-medium text-brand-blue transition-colors hover:text-brand-blue-hover disabled:opacity-50"
                  >
                    {marcandoId === n.id ? '…' : 'Leída'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}