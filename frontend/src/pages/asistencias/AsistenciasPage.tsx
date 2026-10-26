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
import { extraerFechaLocal, fechaHaceDiasLocal, fechaHoyLocal } from '../../utils/fechaHora';

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
    // El día se calcula en la zona horaria local del navegador, no en UTC
    const diaKey = extraerFechaLocal(m.timestamp);
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

export function AsistenciasPage() {
  const { user } = useAuth();
  const { mostrar } = useToast();
  const navigate = useNavigate();

  // Redirige a /mis-asistencias si no tiene permiso para ver todos
  useEffect(() => {
    const rolesConAcceso = ['VIGILANTE', 'ADMIN', 'RRHH', 'JEFE', 'DIRECTORA'];
    if (user && !rolesConAcceso.includes(user.rol)) {
      navigate('/mis-asistencias', { replace: true });
    }
  }, [user, navigate]);

  // Bloque A: el JEFE y la DIRECTORA alternan entre su equipo y sus propios
  // registros mediante el parámetro `alcance`.
  const esJefeODirectora = user?.rol === 'JEFE' || user?.rol === 'DIRECTORA';
  // GET /usuarios solo está disponible para ADMIN, RRHH y VIGILANTE.
  const puedeListarUsuarios = ['ADMIN', 'RRHH', 'VIGILANTE'].includes(user?.rol ?? '');

  const [filas, setFilas] = useState<FilaDia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState(false);

  // Filtros
  const [fechaInicio, setFechaInicio] = useState(fechaHaceDiasLocal(30));
  const [fechaFin, setFechaFin] = useState(fechaHoyLocal());
  const [usuarioFiltro, setUsuarioFiltro] = useState<number | ''>('');
  const [jefaturaFiltro, setJefaturaFiltro] = useState<number | ''>('');
  const [alcance, setAlcance] = useState<'propios' | 'equipo'>('equipo');

  // Datos auxiliares para los selects
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [jefaturas, setJefaturas] = useState<Jefatura[]>([]);

  useEffect(() => {
    adminService
      .listarJefaturas()
      .then(setJefaturas)
      .catch(() => setJefaturas([]));

    if (puedeListarUsuarios) {
      adminService
        .listarUsuarios({ activo: true })
        .then(setUsuarios)
        .catch(() => setUsuarios([]));
    }
  }, [puedeListarUsuarios]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const movs = await asistenciaService.listarMovimientos({
        fechaInicio,
        fechaFin,
        usuarioId: usuarioFiltro || undefined,
        jefaturaId: jefaturaFiltro || undefined,
        ...(esJefeODirectora ? { alcance } : {}),
      });
      setFilas(agruparPorDia(movs));
    } catch {
      mostrar('Error al cargar las asistencias', 'error');
    } finally {
      setCargando(false);
    }
  }, [
    fechaInicio,
    fechaFin,
    usuarioFiltro,
    jefaturaFiltro,
    esJefeODirectora,
    alcance,
    mostrar,
  ]);

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
    <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] space-y-5 bg-surface-bg px-6 py-8">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ClipboardDocumentListIcon className="h-6 w-6 text-brand-blue" />
          <div>
            <h1 className="text-xl font-bold text-content-primary">Asistencias</h1>
            <p className="text-sm text-content-secondary">{filas.length} registros</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(user?.rol === 'VIGILANTE' || user?.rol === 'ADMIN') && (
            <Link to="/asistencias/registro">
              <Button variant="secondary" size="sm" theme="light">Registrar asistencia</Button>
            </Link>
          )}
          {puedeListarUsuarios && (
            <Button
              variant="ghost"
              size="sm"
              theme="light"
              disabled={exportando}
              onClick={exportar}
            >
              <ArrowDownTrayIcon className="h-4 w-4" /> Exportar Excel
            </Button>
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
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="input-field sm:w-auto"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-content-secondary">Hasta</span>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="input-field sm:w-auto"
          />
        </div>
        {puedeListarUsuarios && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-content-secondary">Trabajador</span>
            <select
              value={usuarioFiltro}
              onChange={(e) =>
                setUsuarioFiltro(e.target.value ? Number(e.target.value) : '')
              }
              className="input-field sm:w-auto"
            >
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombres} {u.apellidos}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-content-secondary">Jefatura</span>
          <select
            value={jefaturaFiltro}
            onChange={(e) =>
              setJefaturaFiltro(e.target.value ? Number(e.target.value) : '')
            }
            className="input-field sm:w-auto"
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
      <div className="overflow-x-auto rounded-ds-lg border border-line-light shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-bg text-xs font-semibold text-content-secondary uppercase tracking-wide">
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
          <tbody className="bg-surface-card divide-y divide-line-light">
            {cargando ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
                </td>
              </tr>
            ) : filas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-content-tertiary">
                  Sin registros en el rango seleccionado
                </td>
              </tr>
            ) : (
              filas.map((fila) => (
                <tr
                  key={`${fila.usuarioId}-${fila.diaKey}`}
                  className="hover:bg-surface-bg transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium text-content-primary whitespace-nowrap">
                    {fila.nombres}
                  </td>
                  <td className="px-4 py-2.5 text-content-secondary whitespace-nowrap">
                    {fila.apellidos}
                  </td>
                  <td className="px-4 py-2.5 text-content-secondary">{fila.jefatura}</td>
                  <td className="px-4 py-2.5 text-content-secondary whitespace-nowrap">
                    {formatFecha(fila.diaKey)}
                  </td>
                  <td className="px-4 py-2.5 text-state-success-fg">
                    {fila.horaEntrada ? formatHora(fila.horaEntrada) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-state-error-fg">
                    {fila.horaSalida ? formatHora(fila.horaSalida) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={
                        fila.estado === 'Presente' ? 'badge-success' : 'badge-error'
                      }
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