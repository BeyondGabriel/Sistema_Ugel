import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusIcon, ArrowDownTrayIcon, FunnelIcon,
} from '@heroicons/react/24/outline';
import { visitaService } from '../../services/visita.service';
import { adminService } from '../../services/admin.service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import type { Visita, Usuario } from '../../types';
import { fechaHaceDiasLocal, fechaHoyLocal } from '../../utils/fechaHora';

function formatHora(ts: string): string {
  return new Date(ts).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function VisitasPage() {
  const { user } = useAuth();
  const { mostrar } = useToast();

  const puedeAccionar = user?.rol === 'VIGILANTE' || user?.rol === 'ADMIN';
  // Bloque A: JEFE y DIRECTORA ven las visitas de su equipo según jerarquía.
  const esJefeODirectora = user?.rol === 'JEFE' || user?.rol === 'DIRECTORA';
  // GET /usuarios solo está disponible para ADMIN, RRHH y VIGILANTE.
  const puedeListarUsuarios = ['ADMIN', 'RRHH', 'VIGILANTE'].includes(user?.rol ?? '');

  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [accionId, setAccionId] = useState<number | null>(null);

  const [fechaInicio, setFechaInicio] = useState(fechaHaceDiasLocal(7));
  const [fechaFin, setFechaFin] = useState(fechaHoyLocal());
  const [trabajadorFiltro, setTrabajadorFiltro] = useState<number | ''>('');
  const [alcance, setAlcance] = useState<'propios' | 'equipo'>('equipo');

  useEffect(() => {
    if (puedeListarUsuarios) {
      adminService
        .listarUsuarios({ activo: true })
        .then((data: Usuario[]) => setUsuarios(data))
        .catch(() => setUsuarios([]));
    }
  }, [puedeListarUsuarios]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await visitaService.listarVisitas({
        fechaInicio,
        fechaFin,
        trabajadorVisitadoId: puedeListarUsuarios && trabajadorFiltro ? trabajadorFiltro : undefined,
        ...(esJefeODirectora ? { alcance } : {}),
      });
      // El backend devuelve { visitas: [...] }
      setVisitas(data.visitas ?? []);
    } catch {
      mostrar('Error al cargar las visitas', 'error');
    } finally {
      setCargando(false);
    }
  }, [
    fechaInicio,
    fechaFin,
    trabajadorFiltro,
    puedeListarUsuarios,
    esJefeODirectora,
    alcance,
    mostrar,
  ]);

  useEffect(() => { cargar(); }, [cargar]);

  async function registrarSalida(id: number) {
    setAccionId(id);
    try {
      const actualizada = await visitaService.registrarSalida(id);
      // Fusionar la visita actualizada con la existente para conservar relaciones
      setVisitas((prev) =>
        prev.map((v) =>
          v.id === id
            ? { ...v, ...actualizada, trabajadorVisitado: v.trabajadorVisitado }
            : v
        )
      );
      mostrar('Salida registrada', 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error';
      mostrar(msg, 'error');
    } finally {
      setAccionId(null);
    }
  }

  async function exportar() {
    setExportando(true);
    mostrar('Preparando descarga…', 'info');
    try {
      await visitaService.exportarVisitas({ fechaInicio, fechaFin, trabajadorVisitadoId: trabajadorFiltro || undefined });
      mostrar('Archivo descargado', 'success');
    } catch { mostrar('Error al exportar', 'error'); }
    finally { setExportando(false); }
  }

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] bg-surface-bg px-6 py-8 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-content-primary">Visitas</h1>
          <p className="text-sm text-content-secondary">{visitas.length} registro(s)</p>
        </div>
        <div className="flex gap-2">
          <Button theme="light" variant="ghost" size="sm" disabled={exportando} onClick={exportar}>
            <ArrowDownTrayIcon className="h-4 w-4" /> Excel
          </Button>
          {puedeAccionar && (
            <Link to="/visitas/registro">
              <Button theme="light" variant="primary" size="sm">
                <PlusIcon className="h-4 w-4" /> Registrar visita
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 rounded-ds-lg border border-line-light bg-surface-card p-4 shadow-card">
        <FunnelIcon className="h-4 w-4 mt-1.5 text-content-tertiary shrink-0" />
        {esJefeODirectora && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-content-secondary">Alcance</span>
            <div className="inline-flex overflow-hidden rounded-ds-lg border border-line-light">
              {([
                { valor: 'equipo', label: 'Mis subordinados' },
                { valor: 'propios', label: 'Solo mis registros' },
              ] as const).map((opcion) => (
                <button
                  key={opcion.valor}
                  type="button"
                  onClick={() => setAlcance(opcion.valor)}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    alcance === opcion.valor
                      ? 'bg-brand-blue text-content-inverse'
                      : 'bg-surface-card text-content-secondary hover:bg-surface-bg'
                  }`}
                >
                  {opcion.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-content-secondary">Desde</span>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="input-field sm:w-auto" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-content-secondary">Hasta</span>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="input-field sm:w-auto" />
        </div>
        {puedeListarUsuarios && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-content-secondary">Trabajador visitado</span>
            <select value={trabajadorFiltro} onChange={(e) => setTrabajadorFiltro(e.target.value ? Number(e.target.value) : '')} className="input-field sm:w-auto">
              <option value="">Todos</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombres} {u.apellidos}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-ds-lg border border-line-light shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-bg text-xs font-semibold text-content-secondary uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Visitante</th>
              <th className="px-4 py-3 text-left">DNI</th>
              <th className="px-4 py-3 text-left">Trabajador visitado</th>
              <th className="px-4 py-3 text-left">Jefatura</th>
              <th className="px-4 py-3 text-left">Entrada</th>
              <th className="px-4 py-3 text-left">Salida</th>
              {puedeAccionar && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="bg-surface-card divide-y divide-line-light">
            {cargando ? (
              <tr><td colSpan={puedeAccionar ? 7 : 6} className="px-4 py-10 text-center">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
              </td></tr>
            ) : visitas.length === 0 ? (
              <tr><td colSpan={puedeAccionar ? 7 : 6} className="px-4 py-10 text-center text-content-tertiary">Sin registros</td></tr>
            ) : (
              visitas.map((v) => (
                <tr key={v.id} className="hover:bg-surface-bg transition-colors">
                  <td className="px-4 py-2.5 font-medium text-content-primary whitespace-nowrap">{v.visitanteNombre}</td>
                  <td className="px-4 py-2.5 text-content-secondary">{v.visitanteDni}</td>
                  <td className="px-4 py-2.5 text-content-primary whitespace-nowrap">
                    {v.trabajadorVisitado ? `${v.trabajadorVisitado.nombres} ${v.trabajadorVisitado.apellidos}` : `#${v.trabajadorVisitadoId}`}
                  </td>
                  <td className="px-4 py-2.5 text-content-secondary">{v.trabajadorVisitado?.jefatura?.nombre ?? '—'}</td>
                  <td className="px-4 py-2.5 text-content-secondary whitespace-nowrap">{formatHora(v.horaEntrada)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {v.horaSalida
                      ? <span className="text-content-secondary">{formatHora(v.horaSalida)}</span>
                      : <span className="badge-warning">Aún en sede</span>
                    }
                  </td>
                  {puedeAccionar && (
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-2">
                        {!v.horaSalida && (
                          <Button theme="light" variant="secondary" size="sm" disabled={accionId === v.id} onClick={() => registrarSalida(v.id)}>
                            Salida
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}