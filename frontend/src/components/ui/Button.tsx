import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variante = 'primary' | 'secondary' | 'danger' | 'ghost';
type Tamano = 'sm' | 'md' | 'lg';
/**
 * Tema visual del botón.
 * - `dark`  → aspecto original del producto (DEFAULT). Sus clases no deben cambiar:
 *             las páginas aún no rediseñadas dependen de él.
 * - `light` → Design System institucional (navy + azul + blanco).
 */
type Tema = 'dark' | 'light';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** API original del componente (en español). */
  variante?: Variante;
  /** Alias en inglés: las páginas lo usan como `variant`. Se normaliza a `variante`. */
  variant?: Variante;
  /** API original del componente (en español). */
  tamano?: Tamano;
  /** Alias en inglés: las páginas lo usan como `size`. Se normaliza a `tamano`. */
  size?: Tamano;
  /** Tema visual. `dark` (por defecto) = comportamiento actual, sin cambios visuales. */
  theme?: Tema;
  cargando?: boolean;
  icono?: ReactNode;
  iconoDerecho?: ReactNode;
  children?: ReactNode;
  fullWidth?: boolean;
}

/** Clases base (layout + foco + disabled) por tema. */
const clasesBasePorTema: Record<Tema, string> = {
  dark: [
    'inline-flex items-center justify-center gap-2 rounded-lg border font-medium',
    'transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  light: [
    'inline-flex items-center justify-center gap-2 rounded-ds-lg border font-medium',
    'transition-colors duration-150 focus:outline-none focus-visible:ring-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
};

const clasesPorVariante: Record<Tema, Record<Variante, string>> = {
  dark: {
    primary:
      'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent focus-visible:ring-emerald-500',
    secondary:
      'bg-gray-700 hover:bg-gray-600 text-gray-100 border-transparent focus-visible:ring-gray-500',
    danger:
      'bg-red-700 hover:bg-red-600 text-white border-transparent focus-visible:ring-red-500',
    ghost:
      'bg-transparent hover:bg-gray-700 text-gray-300 hover:text-gray-100 border-gray-600 focus-visible:ring-gray-500',
  },
  light: {
    primary:
      'bg-brand-blue hover:bg-brand-blue-hover text-content-inverse border-transparent focus-visible:ring-brand-blue',
    secondary:
      'bg-line-light hover:bg-line-strong text-content-primary border-transparent focus-visible:ring-brand-blue',
    danger:
      'bg-state-error-fg text-content-inverse hover:opacity-90 border-transparent focus-visible:ring-state-error-fg',
    ghost:
      'bg-transparent text-content-secondary hover:bg-line-light hover:text-content-primary border-transparent focus-visible:ring-brand-blue',
  },
};

const clasesPorTamano: Record<Tamano, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export function Button({
  variante,
  variant,
  tamano,
  size,
  theme = 'dark',
  cargando = false,
  icono,
  iconoDerecho,
  children,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  // El componente nació con la API en español (`variante`/`tamano`); las páginas
  // lo consumen con los alias en inglés (`variant`/`size`). Se aceptan ambos
  // nombres para no romper a ningún consumidor y aquí se normalizan: el resto
  // del componente trabaja sólo con las variables `*Final`.
  const varianteFinal: Variante = variante ?? variant ?? 'primary';
  const tamanoFinal: Tamano = tamano ?? size ?? 'md';

  return (
    <button
      {...props}
      disabled={disabled || cargando}
      className={[
        clasesBasePorTema[theme],
        clasesPorVariante[theme][varianteFinal],
        clasesPorTamano[tamanoFinal],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {cargando ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icono && <span className="h-4 w-4 shrink-0">{icono}</span>
      )}
      {children}
      {!cargando && iconoDerecho && (
        <span className="h-4 w-4 shrink-0">{iconoDerecho}</span>
      )}
    </button>
  );
}
