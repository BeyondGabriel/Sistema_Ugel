import { useEffect, useState, useCallback } from 'react';
import { ArrowDownTrayIcon, FunnelIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { asistenciaService, type MovimientoConJefatura } from '../../services/asistencia.service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import { extraerFechaLocal, fechaHaceDiasLocal, fechaHoyLocal } from '../../utils/fechaHora';

function formatFecha(ts: string): string {
  // Sumar T00:00:00 evita desplazamiento de zona horaria con fechas YYYY-MM-DD
  return new Date(ts + 'T00:00:00').toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
function formatHora(ts: string): string {
  return new Date(ts).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
interface FilaDia {
  diaKey: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  estado: 'Presente' | 'Falta';
}

function agruparPorDia(movimientos: MovimientoConJefatura[]): FilaDia[] {
  const mapa = new Map<string, FilaDia>();
  for (const m of movimientos) {
    // El día se calcula en la zona horaria local del navegador, no en UTC
    const diaKey = extraerFechaLocal(m.timestamp);
    if (!mapa.has(diaKey)) {
      mapa.set(diaKey, { diaKey, horaEntrada: null, horaSalida: null, estado: 'Falta' });
    }
    const fila = mapa.get(diaKey)!;
    if (m.tipo === 'ENTRADA') {
      if (!fila.horaEntrada || m.timestamp < fila.horaEntrada) fila.horaEntrada = m.timestamp;
      fila.estado = 'Presente';
    } else if (m.tipo === 'SALIDA') {
      if (!fila.horaSalida || m.timestamp > fila.horaSalida) fila.horaSalida = m.timestamp;
    }
  }
  return Array.from(mapa.values()).sort((a, b) => b.diaKey.localeCompare(a.diaKey));
}

export function MisAsistenciasPage() {
  const { user } = useAuth();
  const { mostrar } = useToast();

  const [filas, setFilas] = useState<FilaDia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(fechaHaceDiasLocal(30));
  const [fechaFin, setFechaFin] = useState(fechaHoyLocal());

  const cargar = useCallback(async () => {
    if (!user) return;
    setCargando(true);
    try {
      const movs = await asistenciaService.listarMovimientos({
        usuarioId: user.id,
        fechaInicio,
        fechaFin,
      });
      setFilas(agruparPorDia(movs));
    } catch {
      mostrar('Error al cargar tus asistencias', 'error');
    } finally {
      setCargando(false);
    }
  }, [user, fechaInicio, fechaFin, mostrar]);

  useEffect(() => { cargar(); }, [cargar]);

  async function exportar() {
    if (!user) return;
    setExportando(true);
    mostrar('Preparando descarga…', 'info');
    try {
      await asistenciaService.exportarAsistencias({ usuarioId: user.id, fechaInicio, fechaFin });
      mostrar('Archivo descargado', 'success');
    } catch {
      mostrar('Error al exportar', 'error');
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] space-y-5 bg-surface-bg px-6 py-8">
      {/* Encabezado */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <ClipboardDocumentListIcon className="h-6 w-6 text-brand-blue" />
          <div>
            <h1 className="text-xl font-bold text-content-primary">Mis Asistencias</h1>
            <p className="text-sm text-content-secondary">{filas.length} días con registro</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          theme="light"
          disabled={exportando}
          onClick={exportar}
        >
          <ArrowDownTrayIcon className="h-4 w-4" /> Exportar Excel
        </Button>
      </div>

      {/* Filtros de fecha */}
      <div className="flex flex-col gap-3 rounded-ds-lg border border-line-light bg-surface-card p-4 shadow-card sm:flex-row sm:flex-wrap sm:items-start">
        <FunnelIcon className="h-4 w-4 mt-1.5 text-content-tertiary shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-content-secondary">Desde</span>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="input-field w-full sm:w-auto" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-content-secondary">Hasta</span>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="input-field w-full sm:w-auto" />
        </div>
      </div>

      {/* Tabla */}
      <div className="w-full overflow-x-auto rounded-ds-lg border border-line-light shadow-card">
        <table className="w-full min-w-full text-sm">
          <thead className="bg-surface-bg text-xs font-semibold text-content-secondary uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Hora de entrada</th>
              <th className="px-4 py-3 text-left">Hora de salida</th>
              <th className="px-4 py-3 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-light bg-surface-card">
            {cargando ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
                </td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-content-tertiary">
                  Sin registros en el rango seleccionado
                </td>
              </tr>
            ) : (
              filas.map((fila) => (
                <tr key={fila.diaKey} className="hover:bg-surface-bg transition-colors">
                  <td className="px-4 py-2.5 font-medium text-content-primary whitespace-nowrap">
                    {formatFecha(fila.diaKey)}
                  </td>
                  <td className="px-4 py-2.5 text-state-success-fg whitespace-nowrap">
                    {fila.horaEntrada ? formatHora(fila.horaEntrada) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-state-error-fg whitespace-nowrap">
                    {fila.horaSalida ? formatHora(fila.horaSalida) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={fila.estado === 'Presente' ? 'badge-success' : 'badge-error'}>
                      {fila.estado}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}