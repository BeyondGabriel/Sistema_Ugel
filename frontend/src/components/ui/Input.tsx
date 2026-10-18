import { type InputHTMLAttributes, type ReactNode } from 'react';

/**
 * Tema visual del input.
 * - `dark`  → aspecto original del producto (DEFAULT), sin cambios visuales.
 * - `light` → Design System institucional (blanco + navy + azul).
 */
type Tema = 'dark' | 'light';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Ícono decorativo que se muestra a la izquierda del campo. */
  icono?: ReactNode;
  /** Tema visual. `dark` (por defecto) = comportamiento actual, sin cambios visuales. */
  theme?: Tema;
}

const clasesLabel: Record<Tema, string> = {
  dark: 'text-sm font-medium text-gray-300',
  light: 'text-sm font-medium text-content-primary',
};

const clasesIcono: Record<Tema, string> = {
  dark: 'text-gray-400',
  light: 'text-content-tertiary',
};

const clasesError: Record<Tema, string> = {
  dark: 'text-sm text-red-400',
  light: 'text-sm text-state-error-fg',
};

/** Clases del <input> por tema (sin `className`, que se añade al final). */
function clasesInput(tema: Tema, conIcono: boolean, conError: boolean): string {
  const padding = conIcono ? 'pl-10 pr-4' : 'px-4';

  if (tema === 'light') {
    return [
      'w-full bg-surface-card border rounded-ds-lg',
      padding,
      'py-2 text-content-primary placeholder:text-content-tertiary',
      'focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent',
      conError ? 'border-state-error-fg' : 'border-line-light',
    ].join(' ');
  }

  return [
    'w-full bg-gray-700 border border-gray-600 rounded-lg',
    padding,
    'py-2 text-gray-100 placeholder-gray-400',
    'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
    conError ? 'border-red-500' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function Input({
  label,
  error,
  icono,
  theme = 'dark',
  className = '',
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className={`text-sm font-medium ${clasesLabel[theme]}`}>{label}</label>}
      <div className="relative">
        {icono && (
          <span
            className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 [&>svg]:h-5 [&>svg]:w-5 ${clasesIcono[theme]}`}
          >
            {icono}
          </span>
        )}
        <input
          className={`${clasesInput(theme, Boolean(icono), Boolean(error))} ${className}`}
          {...props}
        />
      </div>
      {error && <span className={clasesError[theme]}>{error}</span>}
    </div>
  );
}