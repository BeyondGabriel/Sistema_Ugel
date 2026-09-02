import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DocumentCheckIcon,
  IdentificationIcon,
  ClipboardDocumentListIcon,
  QrCodeIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { api } from '../../services/api';
import { Card } from '../../components/ui/Card';
import type { PresenciaItem } from '../../types';

export function VigilanteDashboard() {
  const { user } = useAuth();
  const { mostrar } = useToast();
  const [presencia, setPresencia] = useState<PresenciaItem[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarPresencia() {
      try {
        const { data } = await api.get<{ presencia: PresenciaItem[] }>('/asistencias/presencia');
        setPresencia(data.presencia);
      } catch {
        mostrar('No se pudo cargar el estado de presencia', 'error');
      } finally {
        setCargando(false);
      }
    }
    cargarPresencia();
  }, [mostrar]);

  if (!user) return null;

  const presentes = presencia.filter((p) => p.estado === 'PRESENTE');
  const ausentes = presencia.filter((p) => p.estado === 'AUSENTE');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Panel de Vigilancia</h1>
        <p className="mt-1 text-sm text-gray-400">
          {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Contadores de presencia */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-gray-500">Presentes ahora</p>
          {cargando ? (
            <div className="mt-1 h-7 w-16 animate-pulse rounded bg-gray-700" />
          ) : (
            <p className="mt-1 text-3xl font-bold text-emerald-400">{presentes.length}</p>
          )}
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Ausentes / Sin registro</p>
          {cargando ? (
            <div className="mt-1 h-7 w-16 animate-pulse rounded bg-gray-700" />
          ) : (
            <p className="mt-1 text-3xl font-bold text-gray-400">{ausentes.length}</p>
          )}
        </Card>
        <Card>
          <p className="text-xs text-gray-500">Total trabajadores</p>
          {cargando ? (
            <div className="mt-1 h-7 w-16 animate-pulse rounded bg-gray-700" />
          ) : (
            <p className="mt-1 text-3xl font-bold text-gray-100">{presencia.length}</p>
          )}
        </Card>
      </div>

      {/* Lista de presencia */}
      <Card titulo="Trabajadores presentes">
        {cargando ? (
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-10 animate-pulse rounded bg-gray-700" />
            ))}
          </div>
        ) : presentes.length === 0 ? (
          <p className="text-sm text-gray-500">Ningún trabajador se ha registrado hoy.</p>
        ) : (
          <ul className="divide-y divide-gray-700">
            {presentes.map((item) => (
              <li key={item.usuarioId} className="flex items-center gap-3 py-2.5">
                <UserCircleIcon className="h-7 w-7 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-sm font-medium text-gray-100">
                    {item.nombres} {item.apellidos}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.jefatura?.nombre ?? 'Sin jefatura'} · Entrada{' '}
                    {item.ultimoMovimiento
                      ? new Date(item.ultimoMovimiento).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </p>
                </div>
                <span className="ml-auto rounded-full bg-emerald-900/50 px-2 py-0.5 text-xs font-medium text-emerald-400">
                  Presente
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Accesos rápidos */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Acciones frecuentes
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Registrar asistencia', ruta: '/asistencias', Icono: ClipboardDocumentListIcon, color: 'text-blue-400' },
            { label: 'Registrar visita', ruta: '/visitas', Icono: IdentificationIcon, color: 'text-violet-400' },
            { label: 'Mis Papeletas', ruta: '/papeletas', Icono: DocumentCheckIcon, color: 'text-amber-400' },
            { label: 'Verificar token', ruta: '/verificar-token', Icono: QrCodeIcon, color: 'text-emerald-400' },
          ].map(({ label, ruta, Icono, color }) => (
            <Link
              key={ruta}
              to={ruta}
              className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800 p-4 hover:border-emerald-700 hover:bg-gray-700 transition-colors"
            >
              <Icono className={`h-5 w-5 shrink-0 ${color}`} />
              <span className="text-sm font-medium text-gray-100">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
