import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Título opcional. Si se define, se renderiza como header dentro de la card. */
  titulo?: string;
}

export function Card({ children, className = '', titulo }: CardProps) {
  return (
    <div className={`bg-gray-800 p-6 rounded-lg shadow ${className}`}>
      {titulo && (
        <h2 className="text-base font-semibold text-gray-100 mb-3">{titulo}</h2>
      )}
      {children}
    </div>
  );
}