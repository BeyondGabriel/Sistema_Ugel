import { useEffect, useState, useCallback } from 'react';
import {
  MagnifyingGlassIcon,
  UserCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PencilIcon,
  ArrowRightCircleIcon,
  ArrowLeftCircleIcon,
  ClockIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/20/solid';
import { adminService } from '../../services/admin.service';
import { asistenciaService, type MovimientoConJefatura } from '../../services/asistencia.service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import type { Usuario } from '../../types';

// ─── helpers ────────────────────────────────────────────
function isoHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function ahora(): string {
  return new Date().toISOString();
}

function combinarFechaHora(fecha: string, hora: string): string {
  return new Date(`${fecha}T${hora}:00`).toISOString();
}

function formatHora(ts: string): string {
  return new Date(ts).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function diasDesde(ts: string): number {
  return (Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24);
}

/** Cuenta ciclos ENTRADA→SALIDA completos en una lista ordenada de movimientos. */
function contarCiclos(movs: MovimientoConJefatura[]): number {
  let ciclos = 0;
  let entradaAbierta = false;
  for (const m of movs) {
    if (m.tipo === 'ENTRADA') entradaAbierta = true;
    else if (m.tipo === 'SALIDA' && entradaAbierta) {
      ciclos++;
      entradaAbierta = false;
    }
  }
  return ciclos;
}

// ─── tipos ──────────────────────────────────────────────
interface GrupoJefatura {
  nombre: string;
  trabajadores: Usuario[];
}

// Tipo local para la respuesta del endpoint de presencia
interface PresenciaItem {
  usuarioId: number;
  estado: 'PRESENTE' | 'AUSENTE';
  ultimoMovimiento?: string;
}

// ─── componente principal ────────────────────────────────
export function RegistroAsistenciaPage() {
  const { user } = useAuth();
  const { mostrar } = useToast();
  const esAdmin = user?.rol === 'ADMIN';

  const [trabajadores, setTrabajadores] = useState<Usuario[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  // Presencia real de los trabajadores (desde la API)
  const [presencia, setPresencia] = useState<Record<number, boolean>>({});

  // Movimientos del día por usuario (cargados a demanda al expandir)
  const [movsDelDia, setMovsDelDia] = useState<Record<number, MovimientoConJefatura[]>>({});
  const [cargandoMovs, setCargandoMovs] = useState<Record<number, boolean>>({});
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());

  // Hora personalizada por trabajador (formato 24h: HH:mm)
  const [horaPersonalizada, setHoraPersonalizada] = useState<Record<number, string>>({});

  // Modal de edición de movimiento
  const [modalEditar, setModalEditar] = useState<{ isOpen: boolean; mov: MovimientoConJefatura | null }>({ isOpen: false, mov: null });
  const [nuevoTimestamp, setNuevoTimestamp] = useState('');
  const [editando, setEditando] = useState(false);

  // Acción en curso por trabajador (evita doble clic)
  const [registrando, setRegistrando] = useState<Record<number, boolean>>({});

  // ─── carga inicial ──────────────────────────────────────
  useEffect(() => {
    async function cargar() {
      try {
        const [usuarios, presencias] = await Promise.all([
          adminService.listarUsuarios({ activo: 'true' }),
          asistenciaService.obtenerPresencia(),
        ]);

        setTrabajadores(usuarios);

        // Construir mapa de presencia: true si está presente
        const mapa: Record<number, boolean> = {};
        (presencias as PresenciaItem[]).forEach((p) => {
          mapa[p.usuarioId] = p.estado === 'PRESENTE';
        });
        setPresencia(mapa);
      } catch {
        mostrar('No se pudieron cargar los trabajadores o la presencia', 'error');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [mostrar]);

  // ─── cargar movimientos del día para un usuario ─────────
  const cargarMovsDelDia = useCallback(async (usuarioId: number) => {
    setCargandoMovs((prev) => ({ ...prev, [usuarioId]: true }));
    try {
      const hoy = isoHoy();
      const movs = await asistenciaService.listarMovimientos({
        usuarioId,
        fechaInicio: hoy,
        fechaFin: hoy,
      });
      // Ordenar cronológicamente
      movs.sort((a: MovimientoConJefatura, b: MovimientoConJefatura) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setMovsDelDia((prev) => ({ ...prev, [usuarioId]: movs }));
    } catch {
      mostrar('Error al cargar el historial del día', 'error');
    } finally {
      setCargandoMovs((prev) => ({ ...prev, [usuarioId]: false }));
    }
  }, [mostrar]);

  function toggleExpandir(id: number) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!movsDelDia[id]) cargarMovsDelDia(id);
      }
      return next;
    });
  }

  // ─── registrar movimiento ───────────────────────────────
  async function registrar(usuario: Usuario, tipo: 'ENTRADA' | 'SALIDA') {
    setRegistrando((prev) => ({ ...prev, [usuario.id]: true }));
    try {
      const horaInput = horaPersonalizada[usuario.id];

      // Validar formato 24h si se proporciona hora personalizada
      if (horaInput && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(horaInput)) {
        mostrar('La hora debe tener formato 24h (HH:mm)', 'error');
        return;
      }

      const ts = horaInput ? combinarFechaHora(isoHoy(), horaInput) : ahora();

      await asistenciaService.registrarMovimiento({ usuarioId: usuario.id, tipo, timestamp: ts });

      // Actualizar el estado de presencia local
      setPresencia((prev) => ({ ...prev, [usuario.id]: tipo === 'ENTRADA' }));

      mostrar(
        `${tipo === 'ENTRADA' ? '✓ Entrada' : '✓ Salida'} registrada para ${usuario.nombres}`,
        'success',
      );

      // Refresca historial del día si estaba expandido
      if (expandidos.has(usuario.id)) {
        await cargarMovsDelDia(usuario.id);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? 'Error al registrar el movimiento';
      mostrar(msg, 'error');
    } finally {
      setRegistrando((prev) => ({ ...prev, [usuario.id]: false }));
    }
  }

  // ─── editar movimiento ──────────────────────────────────
  function abrirEditar(mov: MovimientoConJefatura) {
    setModalEditar({ isOpen: true, mov });
    const local = new Date(mov.timestamp);
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    setNuevoTimestamp(local.toISOString().slice(0, 16));
  }

  async function guardarEdicion() {
    if (!modalEditar.mov) return;
    setEditando(true);
    try {
      await asistenciaService.editarMovimiento(modalEditar.mov.id, {
        nuevoTimestamp: new Date(nuevoTimestamp).toISOString(),
      });
      mostrar('Movimiento actualizado', 'success');
      setModalEditar({ isOpen: false, mov: null });

      const usuarioId = modalEditar.mov.usuarioId;
      await cargarMovsDelDia(usuarioId);

      // Recalcular presencia desde la API para reflejar el cambio
      const presencias = await asistenciaService.obtenerPresencia();
      const mapa: Record<number, boolean> = {};
      (presencias as PresenciaItem[]).forEach((p) => {
        mapa[p.usuarioId] = p.estado === 'PRESENTE';
      });
      setPresencia(mapa);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? 'Error al editar el movimiento';
      mostrar(msg, 'error');
    } finally {
      setEditando(false);
    }
  }

  // ─── agrupación por jefatura ────────────────────────────
  const filtrados = trabajadores.filter((t) => {
    const texto = `${t.nombres} ${t.apellidos}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  const grupos = filtrados.reduce<GrupoJefatura[]>((acc, t) => {
    const nombreJef = t.jefatura?.nombre ?? 'Sin jefatura';
    const grupo = acc.find((g) => g.nombre === nombreJef);
    if (grupo) {
      grupo.trabajadores.push(t);
    } else {
      acc.push({ nombre: nombreJef, trabajadores: [t] });
    }
    return acc;
  }, []).sort((a, b) => a.nombre.localeCompare(b.nombre));

  if (cargando) {
    return (
      <div className="flex justify-center py-20">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Registro de asistencias</h1>
          <p className="text-sm text-gray-400">
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {/* Buscador */}
        <div className="relative w-64">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar trabajador…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-gray-600 bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Grupos por jefatura */}
      {grupos.length === 0 ? (
        <p className="py-10 text-center text-gray-500">No se encontraron trabajadores</p>
      ) : (
        grupos.map((grupo) => (
          <div key={grupo.nombre}>
            {/* Título de jefatura */}
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
              <BuildingOfficeIcon className="h-3.5 w-3.5" />
              {grupo.nombre}
            </div>

            <div className="space-y-2">
              {grupo.trabajadores.map((trabajador) => {
                const movs = movsDelDia[trabajador.id] ?? [];
                const expandido = expandidos.has(trabajador.id);
                const cargandoMov = cargandoMovs[trabajador.id];
                const ciclos = contarCiclos(movs);
                const limiteAlcanzado = ciclos >= 4;

                // Usar presencia global en lugar de depender solo del historial expandido
                const estaPresente = presencia[trabajador.id] ?? false;

                return (
                  <div
                    key={trabajador.id}
                    className="rounded-xl border border-gray-700 bg-gray-800"
                  >
                    {/* Fila principal */}
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                      {/* Toggle + info */}
                      <button
                        onClick={() => toggleExpandir(trabajador.id)}
                        className="flex items-center gap-2 text-left flex-1 min-w-0"
                      >
                        {expandido
                          ? <ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-400" />
                          : <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400" />
                        }
                        <UserCircleIcon className="h-7 w-7 shrink-0 text-gray-500" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-100 truncate">
                            {trabajador.nombres} {trabajador.apellidos}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {trabajador.email}
                          </p>
                        </div>
                      </button>

                      {/* Estado */}
                      {limiteAlcanzado ? (
                        <span className="rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-400">
                          Límite diario
                        </span>
                      ) : estaPresente ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/50 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                          <CheckCircleIcon className="h-3.5 w-3.5" /> Presente
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-400">
                          Ausente
                        </span>
                      )}

                      {/* Campo de hora personalizada (24h) */}
                      <div className="flex items-center gap-1 text-gray-400">
                        <ClockIcon className="h-4 w-4 shrink-0" />
                        <input
                          type="text"
                          value={horaPersonalizada[trabajador.id] ?? ''}
                          onChange={(e) =>
                            setHoraPersonalizada((prev) => ({
                              ...prev,
                              [trabajador.id]: e.target.value,
                            }))
                          }
                          placeholder="HH:mm"
                          pattern="[0-2][0-9]:[0-5][0-9]"
                          className="rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-20"
                          title="Hora en formato 24h (ej. 14:30)"
                        />
                      </div>

                      {/* Botones entrada / salida */}
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={limiteAlcanzado || estaPresente || registrando[trabajador.id]}
                          onClick={() => registrar(trabajador, 'ENTRADA')}
                        >
                          <ArrowRightCircleIcon className="h-4 w-4" /> Entrada
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={limiteAlcanzado || !estaPresente || registrando[trabajador.id]}
                          onClick={() => registrar(trabajador, 'SALIDA')}
                        >
                          <ArrowLeftCircleIcon className="h-4 w-4" /> Salida
                        </Button>
                      </div>
                    </div>

                    {/* Historial del día (expandible) */}
                    {expandido && (
                      <div className="border-t border-gray-700 px-4 py-3">
                        {cargandoMov ? (
                          <p className="text-xs text-gray-500">Cargando historial…</p>
                        ) : movs.length === 0 ? (
                          <p className="text-xs text-gray-500">Sin movimientos hoy</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {movs.map((mov) => {
                              const puedeEditar = esAdmin || diasDesde(mov.timestamp) <= 7;
                              return (
                                <li
                                  key={mov.id}
                                  className="flex items-center gap-3 text-xs"
                                >
                                  <span
                                    className={`font-medium w-14 ${mov.tipo === 'ENTRADA' ? 'text-emerald-400' : 'text-red-400'}`}
                                  >
                                    {mov.tipo === 'ENTRADA' ? 'Entrada' : 'Salida'}
                                  </span>
                                  <span className="text-gray-400">{formatHora(mov.timestamp)}</span>
                                  {puedeEditar && (
                                    <button
                                      onClick={() => abrirEditar(mov)}
                                      className="ml-1 text-gray-500 hover:text-gray-200 transition-colors"
                                      title="Editar hora"
                                    >
                                      <PencilIcon className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {ciclos >= 4 && (
                          <p className="mt-2 text-xs font-medium text-amber-400">
                            Límite diario alcanzado (4 ciclos)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Modal editar movimiento */}
      <Modal
        isOpen={modalEditar.isOpen}
        onClose={() => !editando && setModalEditar({ isOpen: false, mov: null })}
        title="Editar movimiento"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Modificando{' '}
            <span className={`font-semibold ${modalEditar.mov?.tipo === 'ENTRADA' ? 'text-emerald-400' : 'text-red-400'}`}>
              {modalEditar.mov?.tipo}
            </span>
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Nueva fecha y hora</label>
            <input
              type="datetime-local"
              value={nuevoTimestamp}
              onChange={(e) => setNuevoTimestamp(e.target.value)}
              className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button
              variant="ghost"
              onClick={() => setModalEditar({ isOpen: false, mov: null })}
              disabled={editando}
            >
              Cancelar
            </Button>
            <Button variant="primary" disabled={editando} onClick={guardarEdicion}>
              {editando ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}