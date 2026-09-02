import { useToast } from '../../hooks/useToast';
import { type ToastType } from '../../contexts/ToastContext';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const ICONO_POR_TIPO: Record<ToastType, typeof CheckCircleIcon> = {
  success: CheckCircleIcon,
  error: ExclamationCircleIcon,
  warning: ExclamationTriangleIcon,
  info: InformationCircleIcon,
};

const COLOR_POR_TIPO: Record<ToastType, string> = {
  success: 'bg-emerald-800 border-emerald-600 text-emerald-100',
  error: 'bg-red-900 border-red-600 text-red-100',
  warning: 'bg-amber-900 border-amber-600 text-amber-100',
  info: 'bg-blue-900 border-blue-600 text-blue-100',
};

const ICONO_COLOR: Record<ToastType, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-blue-400',
};

/** Renderiza la lista de toasts en esquina inferior-derecha. Incluir una
 * sola vez, cerca de la raíz del árbol React (p. ej. en App.tsx). */
export function ToastContainer() {
  const { toasts, cerrar } = useToast();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((toast) => {
        const Icono = ICONO_POR_TIPO[toast.tipo];
        return (
          <div
            key={toast.id}
            role="alert"
            className={[
              'pointer-events-auto flex max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg',
              'animate-in slide-in-from-right-4 duration-200',
              COLOR_POR_TIPO[toast.tipo],
            ].join(' ')}
          >
            <Icono className={`h-5 w-5 mt-0.5 shrink-0 ${ICONO_COLOR[toast.tipo]}`} />
            <p className="flex-1 text-sm leading-snug">{toast.mensaje}</p>
            <button
              onClick={() => cerrar(toast.id)}
              className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Cerrar notificación"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
