// ===========================================================
// Contexto de toasts (notificaciones emergentes)
// ===========================================================

import { createContext, useState, useCallback, type ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  mensaje: string;
  tipo: ToastType;
}

export interface ToastContextValue {
  toasts: Toast[];
  mostrar: (mensaje: string, tipo?: ToastType) => void;
  cerrar: (id: number) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;
const DURACION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const cerrar = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const mostrar = useCallback(
    (mensaje: string, tipo: ToastType = 'info') => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, mensaje, tipo }]);
      setTimeout(() => cerrar(id), DURACION_MS);
    },
    [cerrar],
  );

  return (
    <ToastContext.Provider value={{ toasts, mostrar, cerrar }}>
      {children}
    </ToastContext.Provider>
  );
}
