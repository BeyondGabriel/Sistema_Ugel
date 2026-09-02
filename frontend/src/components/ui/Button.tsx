import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variante = 'primary' | 'secondary' | 'danger' | 'ghost';
type Tamano = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
  icono?: ReactNode;
  iconoDerecho?: ReactNode;
  children?: ReactNode;
  fullWidth?: boolean;
}

const clasesPorVariante: Record<Variante, string> = {
  primary:
    'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent focus-visible:ring-emerald-500',
  secondary:
    'bg-gray-700 hover:bg-gray-600 text-gray-100 border-transparent focus-visible:ring-gray-500',
  danger:
    'bg-red-700 hover:bg-red-600 text-white border-transparent focus-visible:ring-red-500',
  ghost:
    'bg-transparent hover:bg-gray-700 text-gray-300 hover:text-gray-100 border-gray-600 focus-visible:ring-gray-500',
};

const clasesPorTamano: Record<Tamano, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export function Button({
  variante = 'primary',
  tamano = 'md',
  cargando = false,
  icono,
  iconoDerecho,
  children,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || cargando}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium',
        'transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        clasesPorVariante[variante],
        clasesPorTamano[tamano],
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
