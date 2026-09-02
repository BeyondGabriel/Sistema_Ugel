import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center">
      <h1 className="text-6xl font-bold text-gray-500">404</h1>
      <p className="text-xl text-gray-400">Página no encontrada</p>
      <Link to="/dashboard" className="text-emerald-500 hover:underline">
        Volver al dashboard
      </Link>
    </div>
  );
}