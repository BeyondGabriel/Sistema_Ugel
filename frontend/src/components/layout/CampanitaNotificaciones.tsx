import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon, CheckIcon } from '@heroicons/react/24/outline';
import { BellAlertIcon } from '@heroicons/react/24/solid';
import { notificacionService } from '../../services/notificacion.service';
import { useSocket } from '../../hooks/useSocket';
import type { Notificacion } from '../../types';

function formatRelativo(fecha: string): string {
  const diff = Date.now() - new Date(fecha).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

export function CampanitaNotificaciones() {
  const navigate = useNavigate();
  const { notificacionesSocket } = useSocket();
  const [abierto, setAbierto] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [marcando, setMarcando] = useState(false);
  const refContenedor = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      const { notificaciones: data, noLeidas: count } = await notificacionService.listarNotificaciones();
      setNotificaciones(data.slice(0, 10));
      setNoLeidas(count);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Refresca el conteo cada vez que llega una notificación por socket
  useEffect(() => {
    if (notificacionesSocket.length > 0) {
      setNoLeidas((prev) => prev + 1);
    }
  }, [notificacionesSocket]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (refContenedor.current && !refContenedor.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    if (abierto) document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, [abierto]);

  function toggleAbrir() {
    setAbierto((prev) => {
      if (!prev) cargar(); // refresca al abrir
      return !prev;
    });
  }

  async function marcarTodas() {
    setMarcando(true);
    try {
      await notificacionService.marcarTodasLeidas();
      setNoLeidas(0);
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    } finally {
      setMarcando(false);
    }
  }

  return (
    <div ref={refContenedor} className="relative">
      <button
        onClick={toggleAbrir}
        className="relative rounded-lg p-2 text-content-inverse/80 transition-colors hover:bg-brand-navyLight hover:text-content-inverse"
        aria-label="Notificaciones"
      >
        {noLeidas > 0
          ? <BellAlertIcon className="h-5 w-5 text-brand-yellow" />
          : <BellIcon className="h-5 w-5" />
        }
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-state-error-fg text-[10px] font-bold text-white">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-ds-lg border border-line-light bg-surface-card shadow-modal">
          {/* Header del dropdown */}
          <div className="flex items-center justify-between border-b border-line-light px-4 py-3">
            <span className="text-sm font-semibold text-content-primary">Notificaciones</span>
            {noLeidas > 0 && (
              <button
                onClick={marcarTodas}
                disabled={marcando}
                className="flex items-center gap-1 text-xs text-brand-blue transition-colors hover:text-brand-blue-hover disabled:opacity-50"
              >
                <CheckIcon className="h-3.5 w-3.5" />
                Marcar todas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-80 divide-y divide-line-light overflow-y-auto">
            {notificaciones.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-content-tertiary">Sin notificaciones</p>
            ) : (
              notificaciones.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 text-sm ${n.leida ? 'bg-surface-card' : 'bg-surface-bg'}`}
                >
                  <p className={`leading-snug ${n.leida ? 'text-content-secondary' : 'text-content-primary'}`}>
                    {n.mensaje}
                  </p>
                  <p className="mt-0.5 text-xs text-content-tertiary">{formatRelativo(n.fecha)}</p>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-line-light px-4 py-2">
            <button
              onClick={() => { setAbierto(false); navigate('/notificaciones'); }}
              className="w-full py-1 text-center text-xs text-brand-blue transition-colors hover:text-brand-blue-hover"
            >
              Ver todas las notificaciones →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
