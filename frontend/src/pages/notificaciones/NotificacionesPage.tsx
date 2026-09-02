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
    <div className="max-w-2xl space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BellIcon className="h-6 w-6 text-emerald-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-100">Notificaciones</h1>
            <p className="text-sm text-gray-400">
              {noLeidas > 0 ? `${noLeidas} sin leer` : 'Todo al día'}
            </p>
          </div>
        </div>
        {noLeidas > 0 && (
          <Button
            variant="ghost"
            size="sm"
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
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : notificaciones.length === 0 ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800 py-14 text-center">
          <BellIcon className="h-10 w-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No tienes notificaciones aún</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-700 rounded-xl border border-gray-700 overflow-hidden">
          {notificaciones.map((n) => (
            <div
              key={n.id}
              className={[
                'flex items-start gap-4 px-5 py-4 transition-colors',
                n.leida ? 'bg-gray-900 opacity-70' : 'bg-gray-800',
              ].join(' ')}
            >
              {/* Indicador */}
              <div className="mt-0.5 shrink-0">
                {n.leida
                  ? <CheckCircleIcon className="h-5 w-5 text-gray-600" />
                  : <span className="block h-2.5 w-2.5 rounded-full bg-emerald-400 mt-1" />
                }
              </div>

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${n.leida ? 'text-gray-400' : 'text-gray-100'}`}>
                  {n.mensaje}
                </p>
                <p className="mt-1 text-xs text-gray-600">{formatFechaHora(n.fecha)}</p>
              </div>

              {/* Acción */}
              {!n.leida && (
                <button
                  onClick={() => marcarLeida(n.id)}
                  disabled={marcandoId === n.id}
                  className="shrink-0 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                >
                  {marcandoId === n.id ? '…' : 'Leída'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}