import { type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Ícono decorativo que se muestra a la izquierda del campo. */
  icono?: ReactNode;
}

export function Input({ label, error, icono, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-300">{label}</label>
      )}
      <div className="relative">
        {icono && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 [&>svg]:h-5 [&>svg]:w-5">
            {icono}
          </span>
        )}
        <input
          className={`w-full bg-gray-700 border border-gray-600 rounded-lg ${
            icono ? 'pl-10 pr-4' : 'px-4'
          } py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
            error ? 'border-red-500' : ''
          } ${className}`}
          {...props}
        />
      </div>
      {error && <span className="text-sm text-red-400">{error}</span>}
    </div>
  );
}