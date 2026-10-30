// ===========================================================
// Contexto de Socket.IO: conecta cuando hay sesión activa,
// desconecta al cerrar sesión y expone las últimas notificaciones
// recibidas en tiempo real.
// ===========================================================

import { createContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getToken } from '../services/api';
import { useToast } from '../hooks/useToast';
import type { Notificacion } from '../types';

/**
 * Último cambio de estado de papeleta recibido por Socket.IO. El payload es
 * mínimo a propósito: cada página reacciona recargando sus datos de forma
 * autenticada (y por tanto respetando la visibilidad de cada rol).
 */
export interface CambioPapeleta {
  papeletaId: number;
  estado: string;
}

/**
 * Bloque A: aviso de papeleta que quedó sin aprobador válido (jerarquía
 * incompleta o titular P1C sin delegación). El backend lo emite únicamente a
 * la sala `admin`, por lo que solo los ADMIN lo reciben.
 */
export interface PapeletaBloqueada {
  papeletaId: number;
  numero: string;
  codigo: string;
  mensaje: string;
  solicitanteId: number;
}

export interface SocketContextValue {
  socket: Socket | null;
  notificacionesSocket: Omit<Notificacion, 'usuarioId'>[];
  limpiarNotificacionesSocket: () => void;
  papeletaCambios: CambioPapeleta[];
  limpiarPapeletaCambios: () => void;
  papeletasBloqueadas: PapeletaBloqueada[];
  limpiarPapeletasBloqueadas: () => void;
}

/**
 * Reproduce un tono corto de "campana" usando la Web Audio API.
 *
 * Se generan dos osciladores rápidos (~800 Hz y ~1200 Hz, ~0.15 s cada uno,
 * ~0.3 s en total) para no depender de archivos .mp3 externos. Todo va dentro
 * de try/catch porque algunos navegadores bloquean el audio automático
 * (autoplay policy) hasta que el usuario interactúa con la página: en ese caso
 * la notificación se muestra igual, solo sin sonido.
 */
function reproducirSonidoNotificacion(): void {
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const ahora = ctx.currentTime;
    const duracionTono = 0.14;
    const frecuencias = [800, 1200];

    frecuencias.forEach((frecuencia, indice) => {
      const inicio = ahora + indice * 0.15;
      const oscilador = ctx.createOscillator();
      const ganancia = ctx.createGain();

      oscilador.type = 'sine';
      oscilador.frequency.setValueAtTime(frecuencia, inicio);
      // Envolvente suave para evitar el "click" al cortar el tono.
      ganancia.gain.setValueAtTime(0.0001, inicio);
      ganancia.gain.exponentialRampToValueAtTime(0.2, inicio + 0.02);
      ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + duracionTono);

      oscilador.connect(ganancia);
      ganancia.connect(ctx.destination);
      oscilador.start(inicio);
      oscilador.stop(inicio + duracionTono + 0.02);
    });

    // El contexto se libera cuando ya terminaron los dos tonos (~0.3 s).
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 400);
  } catch (error) {
    console.warn('[Socket.IO] No se pudo reproducir el sonido de notificación:', error);
  }
}

export const SocketContext = createContext<SocketContextValue>({
  socket: null,
  notificacionesSocket: [],
  limpiarNotificacionesSocket: () => {},
  papeletaCambios: [],
  limpiarPapeletaCambios: () => {},
  papeletasBloqueadas: [],
  limpiarPapeletasBloqueadas: () => {},
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notificacionesSocket, setNotificacionesSocket] = useState<Omit<Notificacion, 'usuarioId'>[]>([]);
  const [papeletaCambios, setPapeletaCambios] = useState<CambioPapeleta[]>([]);
  const [papeletasBloqueadas, setPapeletasBloqueadas] = useState<PapeletaBloqueada[]>([]);
  const { mostrar } = useToast();

  const limpiarNotificacionesSocket = useCallback(() => {
    setNotificacionesSocket([]);
  }, []);

  const limpiarPapeletaCambios = useCallback(() => {
    setPapeletaCambios([]);
  }, []);

  const limpiarPapeletasBloqueadas = useCallback(() => {
    setPapeletasBloqueadas([]);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const s = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => {
      console.log('[Socket.IO] Conectado:', s.id);
    });

    s.on('connect_error', (err) => {
      console.warn('[Socket.IO] Error de conexión:', err.message);
    });

    s.on('notificacion', (payload: { id: number; mensaje: string; fecha: string; leida: boolean }) => {
      setNotificacionesSocket((prev) => [
        { id: payload.id, mensaje: payload.mensaje, fecha: payload.fecha, leida: false },
        ...prev,
      ].slice(0, 50)); // máximo 50 en memoria

      reproducirSonidoNotificacion();
      mostrar(payload.mensaje, 'info');
    });

    // Cambios de estado de papeletas (solicitante y aprobador). Solo se
    // acumulan los 20 últimos: las páginas hacen refetch con debounce y solo
    // necesitan saber que algo cambió (y, en el detalle, cuál papeleta).
    s.on('papeleta:cambio', (payload: CambioPapeleta) => {
      setPapeletaCambios((prev) =>
        [{ papeletaId: payload.papeletaId, estado: payload.estado }, ...prev].slice(0, 20)
      );
    });

    // Bloque A: papeletas que quedaron sin aprobador válido. Solo llegan a la
    // sala de administradores, así que el aviso se muestra sin comprobar rol.
    s.on('papeleta:bloqueada', (payload: PapeletaBloqueada) => {
      setPapeletasBloqueadas((prev) => {
        if (prev.some((p) => p.papeletaId === payload.papeletaId)) return prev;
        return [
          {
            papeletaId: payload.papeletaId,
            numero: payload.numero,
            codigo: payload.codigo,
            mensaje: payload.mensaje,
            solicitanteId: payload.solicitanteId,
          },
          ...prev,
        ].slice(0, 20);
      });

      mostrar(`Papeleta ${payload.numero} bloqueada: ${payload.mensaje}`, 'warning');
    });

    s.on('disconnect', () => {
      console.log('[Socket.IO] Desconectado');
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken()]); // Reconecta cuando cambia el token (login/logout)

  return (
    <SocketContext.Provider
      value={{
        socket,
        notificacionesSocket,
        limpiarNotificacionesSocket,
        papeletaCambios,
        limpiarPapeletaCambios,
        papeletasBloqueadas,
        limpiarPapeletasBloqueadas,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}
