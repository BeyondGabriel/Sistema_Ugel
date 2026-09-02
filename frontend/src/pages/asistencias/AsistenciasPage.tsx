import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowDownTrayIcon,
  FunnelIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { asistenciaService, type MovimientoConJefatura } from '../../services/asistencia.service';
import { adminService } from '../../services/admin.service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import type { Usuario, Jefatura } from '../../types';

// ─── helpers ────────────────────────────────────────────
function formatFecha(ts: string): string {
  // Sumar T00:00:00 para evitar desplazamiento de zona horaria con fechas YYYY-MM-DD
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
function isoHoy() {
  return new Date().toISOString().slice(0, 10);
}
function hace30Dias() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

interface FilaDia {
  usuarioId: number;
  nombres: string;
  apellidos: string;
  jefatura: string;
  diaKey: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  estado: 'Presente' | 'Falta';
}

/** Agrupa movimientos por usuario+día: primera ENTRADA y última SALIDA. */
function agruparPorDia(movimientos: MovimientoConJefatura[]): FilaDia[] {
  const mapa = new Map<string, FilaDia>();

  for (const m of movimientos) {
    if (!m.usuario) continue;
    const diaKey = m.timestamp.slice(0, 10);
    const clave = `${m.usuarioId}-${diaKey}`;
    const jefatura = m.usuario.jefatura?.nombre ?? '—';

    if (!mapa.has(clave)) {
      mapa.set(clave, {
        usuarioId: m.usuarioId,
        nombres: m.usuario.nombres,
        apellidos: m.usuario.apellidos,
        jefatura,
        diaKey,
        horaEntrada: null,
        horaSalida: null,
        estado: 'Falta',
      });
    }
    const fila = mapa.get(clave)!;

    if (m.tipo === 'ENTRADA') {
      if (!fila.horaEntrada || m.timestamp < fila.horaEntrada) {
        fila.horaEntrada = m.timestamp;
      }
      fila.estado = 'Presente';
    } else if (m.tipo === 'SALIDA') {
      if (!fila.horaSalida || m.timestamp > fila.horaSalida) {
        fila.horaSalida = m.timestamp;
      }
    }
  }

  return Array.from(mapa.values()).sort((a, b) => {
    if (b.diaKey !== a.diaKey) return b.diaKey.localeCompare(a.diaKey);
    return `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`);
  });
}

const SELECT_CLS =
  'rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500';

export function AsistenciasPage() {
  const { user } = useAuth();
  const { mostrar } = useToast();
  const navigate = useNavigate();

  // Redirige a /mis-asistencias si no tiene permiso para ver todos
  useEffect(() => {
    const rolesConAcceso = ['VIGILANTE', 'ADMIN', 'RRHH'];
    if (user && !rolesConAcceso.includes(user.rol)) {
      navigate('/mis-asistencias', { replace: true });
    }
  }, [user, navigate]);

  const [filas, setFilas] = useState<FilaDia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState(false);

  // Filtros
  const [fechaInicio, setFechaInicio] = useState(hace30Dias());
  const [fechaFin, setFechaFin] = useState(isoHoy());
  const [usuarioFiltro, setUsuarioFiltro] = useState<number | ''>('');
  const [jefaturaFiltro, setJefaturaFiltro] = useState<number | ''>('');

  // Datos auxiliares para los selects
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [jefaturas, setJefaturas] = useState<Jefatura[]>([]);

  useEffect(() => {
    Promise.all([
      adminService.listarUsuarios({ activo: 'true' }), // Corregido: string 'true'
      adminService.listarJefaturas(),
    ]).then(([u, j]) => {
      setUsuarios(u);
      setJefaturas(j);
    });
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const movs = await asistenciaService.listarMovimientos({
        fechaInicio,
        fechaFin,
        usuarioId: usuarioFiltro || undefined,
        jefaturaId: jefaturaFiltro || undefined,
      });
      setFilas(agruparPorDia(movs));
    } catch {
      mostrar('Error al cargar las asistencias', 'error');
    } finally {
      setCargando(false);
    }
  }, [fechaInicio, fechaFin, usuarioFiltro, jefaturaFiltro, mostrar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function exportar() {
    setExportando(true);
    mostrar('Preparando descarga…', 'info');
    try {
      await asistenciaService.exportarAsistencias({
        fechaInicio,
        fechaFin,
        usuarioId: usuarioFiltro || undefined,
        jefaturaId: jefaturaFiltro || undefined,
      });
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
          <ClipboardDocumentListIcon className="h-6 w-6 text-emerald-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-100">Asistencias</h1>
            <p className="text-sm text-gray-400">{filas.length} registros</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(user?.rol === 'VIGILANTE' || user?.rol === 'ADMIN') && (
            <Link to="/asistencias/registro">
              <Button variant="secondary" size="sm">Registrar asistencia</Button>
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={exportando}
            onClick={exportar}
          >
            <ArrowDownTrayIcon className="h-4 w-4" /> Exportar Excel
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-700 bg-gray-800 p-4">
        <FunnelIcon className="h-4 w-4 mt-1.5 text-gray-500 shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Desde</span>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className={SELECT_CLS}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Hasta</span>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className={SELECT_CLS}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Trabajador</span>
          <select
            value={usuarioFiltro}
            onChange={(e) =>
              setUsuarioFiltro(e.target.value ? Number(e.target.value) : '')
            }
            className={SELECT_CLS}
          >
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombres} {u.apellidos}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Jefatura</span>
          <select
            value={jefaturaFiltro}
            onChange={(e) =>
              setJefaturaFiltro(e.target.value ? Number(e.target.value) : '')
            }
            className={SELECT_CLS}
          >
            <option value="">Todas</option>
            {jefaturas.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Apellidos</th>
              <th className="px-4 py-3 text-left">Jefatura</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">H. Entrada</th>
              <th className="px-4 py-3 text-left">H. Salida</th>
              <th className="px-4 py-3 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 bg-gray-900">
            {cargando ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                </td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                  Sin registros en el rango seleccionado
                </td>
              </tr>
            ) : (
              filas.map((fila) => (
                <tr
                  key={`${fila.usuarioId}-${fila.diaKey}`}
                  className="hover:bg-gray-800/60 transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium text-gray-100 whitespace-nowrap">
                    {fila.nombres}
                  </td>
                  <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">
                    {fila.apellidos}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">{fila.jefatura}</td>
                  <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">
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
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
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