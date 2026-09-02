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

export interface SocketContextValue {
  socket: Socket | null;
  notificacionesSocket: Omit<Notificacion, 'usuarioId'>[];
  limpiarNotificacionesSocket: () => void;
}

export const SocketContext = createContext<SocketContextValue>({
  socket: null,
  notificacionesSocket: [],
  limpiarNotificacionesSocket: () => {},
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notificacionesSocket, setNotificacionesSocket] = useState<Omit<Notificacion, 'usuarioId'>[]>([]);
  const { mostrar } = useToast();

  const limpiarNotificacionesSocket = useCallback(() => {
    setNotificacionesSocket([]);
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

      mostrar(payload.mensaje, 'info');
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
    <SocketContext.Provider value={{ socket, notificacionesSocket, limpiarNotificacionesSocket }}>
      {children}
    </SocketContext.Provider>
  );
}
