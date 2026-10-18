import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-bg text-center">
      <h1 className="text-6xl font-bold text-content-secondary">404</h1>
      <p className="text-xl text-content-secondary">Página no encontrada</p>
      <Link to="/dashboard" className="text-brand-blue hover:underline">
        Volver al dashboard
      </Link>
    </div>
  );
}