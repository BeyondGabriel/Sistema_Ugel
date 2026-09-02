import { useEffect, useState, useCallback } from 'react';
import { ArrowDownTrayIcon, FunnelIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { asistenciaService, type MovimientoConJefatura } from '../../services/asistencia.service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';

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
function isoHoy() { return new Date().toISOString().slice(0, 10); }
function hace30Dias() {
  const d = new Date(); d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
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
    const diaKey = m.timestamp.slice(0, 10);
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

const INPUT_CLS = 'rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500';

export function MisAsistenciasPage() {
  const { user } = useAuth();
  const { mostrar } = useToast();

  const [filas, setFilas] = useState<FilaDia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(hace30Dias());
  const [fechaFin, setFechaFin] = useState(isoHoy());

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
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ClipboardDocumentListIcon className="h-6 w-6 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-100">Mis Asistencias</h1>
            <p className="text-sm text-gray-400">{filas.length} días con registro</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={exportando}
          onClick={exportar}
        >
          <ArrowDownTrayIcon className="h-4 w-4" /> Exportar Excel
        </Button>
      </div>

      {/* Filtros de fecha */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-700 bg-gray-800 p-4">
        <FunnelIcon className="h-4 w-4 mt-1.5 text-gray-500 shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Desde</span>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={INPUT_CLS} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Hasta</span>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className={INPUT_CLS} />
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Hora de entrada</th>
              <th className="px-4 py-3 text-left">Hora de salida</th>
              <th className="px-4 py-3 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 bg-gray-900">
            {cargando ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                </td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                  Sin registros en el rango seleccionado
                </td>
              </tr>
            ) : (
              filas.map((fila) => (
                <tr key={fila.diaKey} className="hover:bg-gray-800/60 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-gray-100 whitespace-nowrap">
                    {formatFecha(fila.diaKey)}
                  </td>
                  <td className="px-4 py-2.5 text-emerald-400">
                    {fila.horaEntrada ? formatHora(fila.horaEntrada) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-red-400">
                    {fila.horaSalida ? formatHora(fila.horaSalida) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        fila.estado === 'Presente'
                          ? 'bg-emerald-900/50 text-emerald-400'
                          : 'bg-gray-700 text-gray-500'
                      }`}
                    >
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