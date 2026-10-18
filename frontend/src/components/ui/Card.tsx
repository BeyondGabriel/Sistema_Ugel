import { type ReactNode } from 'react';

/**
 * Tema visual de la card.
 * - `dark`  → aspecto original del producto (DEFAULT), sin cambios visuales.
 * - `light` → Design System institucional (blanco + borde sutil + sombra suave).
 */
type Tema = 'dark' | 'light';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Título opcional. Si se define, se renderiza como header dentro de la card. */
  titulo?: string;
  /** Tema visual. `dark` (por defecto) = comportamiento actual, sin cambios visuales. */
  theme?: Tema;
}

const clasesCard: Record<Tema, string> = {
  dark: 'bg-gray-800 p-6 rounded-lg shadow',
  light: 'bg-surface-card border border-line-light shadow-card p-6 rounded-ds-lg',
};

const clasesTitulo: Record<Tema, string> = {
  dark: 'text-base font-semibold text-gray-100 mb-3',
  light: 'text-base font-semibold text-content-primary mb-3',
};

export function Card({ children, className = '', titulo, theme = 'dark' }: CardProps) {
  return (
    <div className={`${clasesCard[theme]} ${className}`}>
      {titulo && <h2 className={clasesTitulo[theme]}>{titulo}</h2>}
      {children}
    </div>
  );
}