import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardDocumentCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon,
  HandThumbUpIcon,
  CalendarDaysIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { vacacionService } from '../../services/vacacion.service';
import { adminService } from '../../services/admin.service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import type { EstadoSolicitudVacacion, SolicitudVacacion, TipoVacacion, Usuario } from '../../types';
import { extraerFechaLocal } from '../../utils/fechaHora';

// ─── Catálogos del Design System ──────────────────────────

const BADGE_ESTADO: Record<EstadoSolicitudVacacion, string> = {
  PENDIENTE: 'badge-info',
  CON_VB: 'badge-warning',
  APROBADA: 'badge-success',
  RECHAZADA: 'badge-error',
  CANCELADA: 'badge-error',
};

const ETIQUETA_ESTADO: Record<EstadoSolicitudVacacion, string> = {
  PENDIENTE: 'Pendiente',
  CON_VB: 'Con VoBo',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
};

const ETIQUETA_TIPO: Record<TipoVacacion, string> = {
  DIA_COMPLETO: 'Día completo',
  MEDIO_DIA: 'Medio día',
};

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Cabecera del grid mensual (semana que empieza en lunes). */
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// ─── Utilidades ───────────────────────────────────────────

function pad2(valor: number): string {
  return String(valor).padStart(2, '0');
}

/** ISO 8601 (UTC) → "DD/MM/YYYY" en la zona horaria del navegador. */
function formatFecha(iso: string): string {
  const clave = extraerFechaLocal(iso);
  if (!clave) return '—';
  const [anio, mes, dia] = clave.split('-');
  return `${dia}/${mes}/${anio}`;
}

/** Días con hasta 2 decimales (el backend puede devolver Decimal como texto). */
function formatearDias(valor: number | null | undefined): string {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '0';
  return numero.toLocaleString('es-PE', { maximumFractionDigits: 2 });
}

function extractMsg(err: unknown): string {
  const respuesta = (err as { response?: { data?: { mensaje?: string } } })?.response?.data;
  return respuesta?.mensaje ?? 'Error al procesar la solicitud';
}

/**
 * Mapa "YYYY-MM-DD" → cantidad de solicitudes APROBADAS que cubren ese día.
 * Se trabaja con la fecha local del navegador porque el backend guarda los
 * rangos como instantes UTC de la medianoche local.
 */
function diasAprobados(solicitudes: SolicitudVacacion[]): Map<string, number> {
  const mapa = new Map<string, number>();

  for (const s of solicitudes) {
    if (s.estado !== 'APROBADA') continue;

    const inicio = extraerFechaLocal(s.fechaInicio);
    const fin = extraerFechaLocal(s.fechaFin) || inicio;
    if (!inicio) continue;

    const [anioInicio, mesInicio, diaInicio] = inicio.split('-').map(Number);
    const [anioFin, mesFin, diaFin] = fin.split('-').map(Number);

    const cursor = new Date(anioInicio, mesInicio - 1, diaInicio);
    const limite = new Date(anioFin, mesFin - 1, diaFin);

    let guardia = 0;
    while (cursor <= limite && guardia < 366) {
      const clave = `${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}-${pad2(cursor.getDate())}`;
      mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
      cursor.setDate(cursor.getDate() + 1);
      guardia += 1;
    }
  }

  return mapa;
}

// ─── Modal de rechazo motivado ────────────────────────────

interface ModalRechazoProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmar: (motivo: string) => void;
  procesando: boolean;
}

function ModalRechazo({ isOpen, onClose, onConfirmar, procesando }: ModalRechazoProps) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');

  function cerrar() {
    if (procesando) return;
    setMotivo('');
    setError('');
    onClose();
  }

  function confirmar() {
    if (!motivo.trim()) {
      setError('El motivo del rechazo es obligatorio');
      return;
    }
    onConfirmar(motivo.trim());
  }

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="Rechazar solicitud">
      <div className="space-y-3">
        <p className="text-sm text-content-secondary">
          Indica el motivo del rechazo. El trabajador recibirá una notificación con este detalle.
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-content-primary" htmlFor="motivo-rechazo">
            Motivo del rechazo
          </label>
          <textarea
            id="motivo-rechazo"
            className="input-field"
            rows={4}
            maxLength={255}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              setError('');
            }}
            placeholder="Ej. Saldo insuficiente o coincidencia con periodo de cierre"
            disabled={procesando}
          />
        </div>
        {error && <p className="text-sm text-state-error-fg">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-line-light pt-4">
          <Button theme="light" variant="ghost" onClick={cerrar} disabled={procesando}>
            Cancelar
          </Button>
          <Button theme="light" variant="danger" onClick={confirmar} disabled={procesando}>
            <XMarkIcon className="h-4 w-4" />
            {procesando ? 'Procesando…' : 'Confirmar rechazo'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Tab 1: bandeja de solicitudes ────────────────────────

interface TabBandejaProps {
  solicitudes: SolicitudVacacion[];
  cargando: boolean;
  esJefe: boolean;
  esRrhh: boolean;
  onRecargar: () => void | Promise<void>;
}

function TabBandeja({ solicitudes, cargando, esJefe, esRrhh, onRecargar }: TabBandejaProps) {
  const { mostrar } = useToast();

  const [accionId, setAccionId] = useState<number | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<EstadoSolicitudVacacion | ''>('');
  const [modalRechazo, setModalRechazo] = useState<{ abierto: boolean; id: number | null }>({
    abierto: false,
    id: null,
  });
  const [procesandoRechazo, setProcesandoRechazo] = useState(false);

  const visibles = useMemo(() => {
    const lista = filtroEstado ? solicitudes.filter((s) => s.estado === filtroEstado) : solicitudes;
    return [...lista].sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
  }, [solicitudes, filtroEstado]);

  const pendientes = solicitudes.filter((s) => s.estado === 'PENDIENTE').length;
  const conVb = solicitudes.filter((s) => s.estado === 'CON_VB').length;
  const aprobadas = solicitudes.filter((s) => s.estado === 'APROBADA').length;

  async function ejecutar(id: number, fn: () => Promise<SolicitudVacacion>, mensajeOk: string) {
    setAccionId(id);
    try {
      await fn();
      mostrar(mensajeOk, 'success');
      await onRecargar();
    } catch (err) {
      mostrar(extractMsg(err), 'error');
    } finally {
      setAccionId(null);
    }
  }

  async function confirmarRechazo(motivo: string) {
    if (!modalRechazo.id) return;
    setProcesandoRechazo(true);
    try {
      await vacacionService.rechazarSolicitud(modalRechazo.id, motivo);
      mostrar('Solicitud rechazada', 'success');
      setModalRechazo({ abierto: false, id: null });
      await onRecargar();
    } catch (err) {
      mostrar(extractMsg(err), 'error');
    } finally {
      setProcesandoRechazo(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Resumen y filtro por estado */}
      <div className="flex flex-col gap-3 rounded-ds-lg border border-line-light bg-surface-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge-info">{pendientes} pendiente(s)</span>
          <span className="badge-warning">{conVb} con VoBo</span>
          <span className="badge-success">{aprobadas} aprobada(s)</span>
        </div>
        <select
          className="input-field w-full sm:w-auto"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as EstadoSolicitudVacacion | '')}
        >
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="CON_VB">Con VoBo</option>
          <option value="APROBADA">Aprobada</option>
          <option value="RECHAZADA">Rechazada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
      </div>

      {/* Tabla de solicitudes */}
      <div className="w-full overflow-x-auto rounded-ds-lg border border-line-light shadow-card">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-surface-bg text-xs font-semibold uppercase tracking-wide text-content-secondary">
            <tr>
              <th className="px-4 py-3 text-left">Trabajador</th>
              <th className="px-4 py-3 text-left">Fechas</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-center">Días</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-light bg-surface-card">
            {cargando ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-content-tertiary">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
                </td>
              </tr>
            ) : visibles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-content-tertiary">
                  No hay solicitudes para mostrar
                </td>
              </tr>
            ) : (
              visibles.map((s) => (
                <FilaSolicitud
                  key={s.id}
                  solicitud={s}
                  esJefe={esJefe}
                  esRrhh={esRrhh}
                  enAccion={accionId === s.id}
                  onDarVoBo={() =>
                    void ejecutar(
                      s.id,
                      () => vacacionService.darVoBo(s.id),
                      'VoBo registrado correctamente',
                    )
                  }
                  onAprobar={() =>
                    void ejecutar(
                      s.id,
                      () => vacacionService.aprobarSolicitud(s.id),
                      'Solicitud aprobada',
                    )
                  }
                  onRechazar={() => setModalRechazo({ abierto: true, id: s.id })}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <ModalRechazo
        isOpen={modalRechazo.abierto}
        onClose={() => setModalRechazo({ abierto: false, id: null })}
        onConfirmar={confirmarRechazo}
        procesando={procesandoRechazo}
      />
    </div>
  );
}

interface FilaSolicitudProps {
  solicitud: SolicitudVacacion;
  esJefe: boolean;
  esRrhh: boolean;
  enAccion: boolean;
  onDarVoBo: () => void;
  onAprobar: () => void;
  onRechazar: () => void;
}

function FilaSolicitud({
  solicitud: s,
  esJefe,
  esRrhh,
  enAccion,
  onDarVoBo,
  onAprobar,
  onRechazar,
}: FilaSolicitudProps) {
  const puedeVb = esJefe && s.estado === 'PENDIENTE';
  const puedeAprobar = esRrhh && s.estado === 'CON_VB';
  const trabajador = s.solicitante
    ? `${s.solicitante.nombres} ${s.solicitante.apellidos}`
    : `Usuario #${s.solicitanteId}`;

  return (
    <tr className="transition-colors hover:bg-surface-bg">
      <td className="whitespace-nowrap px-4 py-3">
        <p className="font-medium text-content-primary">{trabajador}</p>
        {s.motivoRechazo && (
          <p className="text-xs text-state-error-fg">Motivo: {s.motivoRechazo}</p>
        )}
      </td>
      <td className="px-4 py-3 text-content-secondary">
        {s.tipo === 'MEDIO_DIA'
          ? `${formatFecha(s.fechaInicio)} · ${s.horaInicio ?? '—'} → ${s.horaFin ?? '—'}`
          : `${formatFecha(s.fechaInicio)} al ${formatFecha(s.fechaFin)}`}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-content-secondary">{ETIQUETA_TIPO[s.tipo]}</td>
      <td className="px-4 py-3 text-center text-content-primary">
        {formatearDias(s.diasDescontados)}
      </td>
      <td className="px-4 py-3 text-center">
        <span className={BADGE_ESTADO[s.estado]}>{ETIQUETA_ESTADO[s.estado]}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          {puedeVb && (
            <Button
              theme="light"
              variant="primary"
              size="sm"
              disabled={enAccion}
              onClick={onDarVoBo}
            >
              <HandThumbUpIcon className="h-4 w-4" /> Dar VoBo
            </Button>
          )}

          {puedeAprobar && (
            <>
              <Button
                theme="light"
                variant="primary"
                size="sm"
                disabled={enAccion}
                onClick={onAprobar}
              >
                <CheckIcon className="h-4 w-4" /> Aprobar
              </Button>
              <Button
                theme="light"
                variant="danger"
                size="sm"
                disabled={enAccion}
                onClick={onRechazar}
              >
                <XMarkIcon className="h-4 w-4" /> Rechazar
              </Button>
            </>
          )}

          {!puedeVb && !puedeAprobar && <span className="text-xs text-content-tertiary">—</span>}
        </div>
      </td>
    </tr>
  );
}

// ─── Tab 2: carga de saldos anuales ───────────────────────

function TabSaldos() {
  const { mostrar } = useToast();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true);
  const [usuarioId, setUsuarioId] = useState('');
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [diasGanados, setDiasGanados] = useState('30');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;

    void (async () => {
      try {
        const lista = await adminService.listarUsuarios({ activo: true });
        if (!activo) return;
        setUsuarios(
          [...lista].sort((a, b) =>
            `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`),
          ),
        );
      } catch {
        if (activo) mostrar('No se pudo cargar la lista de trabajadores', 'error');
      } finally {
        if (activo) setCargandoUsuarios(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [mostrar]);

  async function guardar() {
    setError('');

    const idUsuario = Number(usuarioId);
    const anioNumero = Number(anio);
    const diasNumero = Number(diasGanados);

    if (!idUsuario) {
      setError('Selecciona un trabajador');
      return;
    }
    if (!Number.isInteger(anioNumero) || anioNumero < 2000 || anioNumero > 2100) {
      setError('Ingresa un año válido (2000 - 2100)');
      return;
    }
    if (!Number.isFinite(diasNumero) || diasNumero <= 0 || diasNumero > 365) {
      setError('Los días ganados deben ser mayores a 0 y como máximo 365');
      return;
    }

    setGuardando(true);
    try {
      const saldo = await vacacionService.crearSaldoManual({
        usuarioId: idUsuario,
        anio: anioNumero,
        diasGanados: diasNumero,
      });
      mostrar(`Saldo de ${formatearDias(saldo?.diasGanados)} días registrado`, 'success');
    } catch (err) {
      setError(extractMsg(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-2xl rounded-ds-lg border border-line-light bg-surface-card p-6 shadow-card">
      <div className="mb-5 flex items-start gap-3">
        <UsersIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" />
        <div>
          <h2 className="text-base font-semibold text-content-primary">Saldo anual de vacaciones</h2>
          <p className="text-sm text-content-secondary">
            Registra o actualiza los días ganados de un trabajador. Si el saldo del año ya existe, se
            actualizarán los días ganados.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-sm font-medium text-content-primary" htmlFor="saldo-usuario">
            Trabajador
          </label>
          <select
            id="saldo-usuario"
            className="input-field"
            value={usuarioId}
            onChange={(e) => {
              setUsuarioId(e.target.value);
              setError('');
            }}
            disabled={cargandoUsuarios || guardando}
          >
            <option value="">
              {cargandoUsuarios ? 'Cargando trabajadores…' : 'Selecciona un trabajador'}
            </option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.apellidos}, {u.nombres} — {u.rol}
              </option>
            ))}
          </select>
        </div>

        <Input
          theme="light"
          label="Año"
          id="saldo-anio"
          type="number"
          min={2000}
          max={2100}
          value={anio}
          onChange={(e) => {
            setAnio(e.target.value);
            setError('');
          }}
          disabled={guardando}
        />

        <Input
          theme="light"
          label="Días ganados"
          id="saldo-dias"
          type="number"
          min={0.5}
          max={365}
          step={0.5}
          value={diasGanados}
          onChange={(e) => {
            setDiasGanados(e.target.value);
            setError('');
          }}
          disabled={guardando}
        />
      </div>

      {error && <p className="mt-4 text-sm text-state-error-fg">{error}</p>}

      <div className="mt-5 flex justify-end border-t border-line-light pt-4">
        <Button
          theme="light"
          variant="primary"
          onClick={() => void guardar()}
          disabled={guardando || cargandoUsuarios}
        >
          <CheckIcon className="h-4 w-4" />
          {guardando ? 'Guardando…' : 'Registrar saldo'}
        </Button>
      </div>
    </div>
  );
}

// ─── Tab 3: calendario anual de vacaciones aprobadas ──────

interface TabCalendarioProps {
  solicitudes: SolicitudVacacion[];
  cargando: boolean;
}

function TabCalendario({ solicitudes, cargando }: TabCalendarioProps) {
  const [anio, setAnio] = useState(new Date().getFullYear());

  const dias = useMemo(() => diasAprobados(solicitudes), [solicitudes]);

  const hoy = useMemo(() => {
    const fecha = new Date();
    return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}-${pad2(fecha.getDate())}`;
  }, []);

  const diasDelAnio = useMemo(() => {
    let total = 0;
    for (const clave of dias.keys()) {
      if (clave.startsWith(`${anio}-`)) total += 1;
    }
    return total;
  }, [dias, anio]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-ds-lg border border-line-light bg-surface-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-content-secondary">
          <CalendarDaysIcon className="h-5 w-5 shrink-0 text-brand-blue" />
          <span>
            <strong className="text-content-primary">{diasDelAnio}</strong> día(s) con vacaciones
            aprobadas en {anio}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            theme="light"
            variant="ghost"
            size="sm"
            aria-label="Año anterior"
            onClick={() => setAnio((valor) => valor - 1)}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <span className="min-w-[64px] text-center text-sm font-semibold text-content-primary">
            {anio}
          </span>
          <Button
            theme="light"
            variant="ghost"
            size="sm"
            aria-label="Año siguiente"
            onClick={() => setAnio((valor) => valor + 1)}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-ds-lg border border-line-light bg-surface-card p-4 shadow-card">
        {cargando ? (
          <div className="py-10 text-center">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {MESES.map((nombreMes, indiceMes) => {
              const primerDia = new Date(anio, indiceMes, 1);
              const desplazamiento = (primerDia.getDay() + 6) % 7;
              const totalDias = new Date(anio, indiceMes + 1, 0).getDate();

              return (
                <div key={nombreMes} className="rounded-ds-md border border-line-light p-3">
                  <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-content-secondary">
                    {nombreMes}
                  </p>
                  <div className="grid grid-cols-7 gap-1">
                    {DIAS_SEMANA.map((dia) => (
                      <span
                        key={dia}
                        className="flex h-5 items-center justify-center text-[10px] font-semibold text-content-tertiary"
                      >
                        {dia}
                      </span>
                    ))}
                    {Array.from({ length: desplazamiento }).map((_, i) => (
                      <span key={`vacio-${indiceMes}-${i}`} />
                    ))}
                    {Array.from({ length: totalDias }).map((_, i) => {
                      const dia = i + 1;
                      const clave = `${anio}-${pad2(indiceMes + 1)}-${pad2(dia)}`;
                      const tieneVacaciones = dias.has(clave);

                      return (
                        <span
                          key={clave}
                          title={
                            tieneVacaciones
                              ? `${dias.get(clave)} trabajador(es) de vacaciones`
                              : undefined
                          }
                          className={[
                            'flex h-7 items-center justify-center rounded-ds-sm text-[11px]',
                            tieneVacaciones
                              ? 'bg-brand-blue/20 font-semibold text-brand-blue'
                              : 'text-content-secondary',
                            clave === hoy ? 'ring-1 ring-brand-blue' : '',
                          ].join(' ')}
                        >
                          {dia}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line-light pt-3 text-xs text-content-secondary">
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-ds-sm bg-brand-blue/20" />
            Vacaciones aprobadas
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-ds-sm ring-1 ring-brand-blue" />
            Día actual
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Página de gestión ────────────────────────────────────

type TabId = 'bandeja' | 'saldos' | 'calendario';

const TABS: Array<{ id: TabId; label: string; soloRrhh: boolean }> = [
  { id: 'bandeja', label: 'Bandeja de Solicitudes', soloRrhh: false },
  { id: 'saldos', label: 'Saldos Iniciales', soloRrhh: true },
  { id: 'calendario', label: 'Calendario', soloRrhh: false },
];

export function GestionVacacionesPage() {
  const { user } = useAuth();

  const esJefe = user?.rol === 'JEFE' || user?.rol === 'DIRECTORA';
  const esRrhh = user?.rol === 'RRHH' || user?.rol === 'ADMIN';

  const [tabActiva, setTabActiva] = useState<TabId>('bandeja');
  const [solicitudes, setSolicitudes] = useState<SolicitudVacacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const lista = await vacacionService.listarSolicitudes();
      setSolicitudes(lista);
      setAviso('');
    } catch {
      setSolicitudes([]);
      setAviso(
        'El listado general de solicitudes todavía no está publicado en el servidor (GET /api/vacaciones). Las acciones de VoBo, aprobación y rechazo se habilitarán automáticamente cuando la ruta esté disponible.',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const tabsVisibles = useMemo(() => TABS.filter((t) => !t.soloRrhh || esRrhh), [esRrhh]);

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] bg-surface-bg px-6 py-8 space-y-5">
      {/* Encabezado */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <ClipboardDocumentCheckIcon className="h-6 w-6 text-brand-blue" />
          <div>
            <h1 className="text-xl font-bold text-content-primary">Gestión de Vacaciones</h1>
            <p className="text-sm text-content-secondary">
              Solicitudes, saldos anuales y calendario del personal
            </p>
          </div>
        </div>
        <Button
          theme="light"
          variant="ghost"
          size="sm"
          disabled={cargando}
          onClick={() => void cargar()}
        >
          <ArrowPathIcon className="h-4 w-4" /> Actualizar
        </Button>
      </div>

      {/* Pestañas */}
      <div className="flex flex-wrap gap-1 rounded-ds-lg border border-line-light bg-surface-card p-1 shadow-card">
        {tabsVisibles.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTabActiva(t.id)}
            className={[
              'rounded-ds-md px-4 py-2 text-sm font-medium transition-colors',
              tabActiva === t.id
                ? 'bg-surface-bg text-brand-blue shadow-sm'
                : 'text-content-secondary hover:bg-surface-bg hover:text-content-primary',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {aviso && (
        <p className="rounded-ds-md border border-line-light bg-surface-card px-4 py-2 text-xs text-content-secondary">
          {aviso}
        </p>
      )}

      {/* Contenido */}
      {tabActiva === 'bandeja' && (
        <TabBandeja
          solicitudes={solicitudes}
          cargando={cargando}
          esJefe={esJefe}
          esRrhh={esRrhh}
          onRecargar={cargar}
        />
      )}

      {tabActiva === 'saldos' &&
        (esRrhh ? (
          <TabSaldos />
        ) : (
          <p className="rounded-ds-lg border border-line-light bg-surface-card p-6 text-sm text-content-secondary shadow-card">
            Solo RRHH y Administración pueden registrar saldos anuales.
          </p>
        ))}

      {tabActiva === 'calendario' && (
        <TabCalendario solicitudes={solicitudes} cargando={cargando} />
      )}
    </div>
  );
}
