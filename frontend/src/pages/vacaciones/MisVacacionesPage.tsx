import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDaysIcon, PlusIcon, ArrowPathIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { vacacionService } from '../../services/vacacion.service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import type { EstadoSolicitudVacacion, SolicitudVacacion, TipoVacacion, VacacionSaldo } from '../../types';
import { extraerFechaLocal, fechaHoyLocal } from '../../utils/fechaHora';

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

// ─── Utilidades ───────────────────────────────────────────

/** ISO 8601 (UTC) → "DD/MM/YYYY" en la zona horaria del navegador. */
function formatFecha(iso: string): string {
  const clave = extraerFechaLocal(iso);
  if (!clave) return '—';
  const [anio, mes, dia] = clave.split('-');
  return `${dia}/${mes}/${anio}`;
}

/** Días calendario del rango [inicio, fin] (ambas fechas inclusive). */
function diasDelRango(inicio: string, fin: string): number {
  const a = new Date(`${inicio}T00:00:00`);
  const b = new Date(`${fin}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

/** Minutos transcurridos desde la medianoche para una hora "HH:mm". */
function minutosDe(hora: string): number {
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
}

/** Días con hasta 2 decimales (el backend puede devolver Decimal como texto). */
function formatearDias(valor: number | null | undefined): string {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '0';
  return numero.toLocaleString('es-PE', { maximumFractionDigits: 2 });
}

/** Mensaje de error devuelto por el API. */
function extractMsg(err: unknown): string {
  const respuesta = (err as { response?: { data?: { mensaje?: string } } })?.response?.data;
  return respuesta?.mensaje ?? 'Error al procesar la solicitud';
}

/** El backend responde 404 cuando el trabajador aún no tiene saldo del año. */
function esSinSaldo(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 404;
}

// ─── Modal de solicitud ───────────────────────────────────

interface ModalSolicitudProps {
  isOpen: boolean;
  onClose: () => void;
  /** Se invoca tras crear la solicitud para recargar saldo y listado. */
  onCreado: () => void;
}

function ModalSolicitud({ isOpen, onClose, onCreado }: ModalSolicitudProps) {
  const { mostrar } = useToast();

  const [tipo, setTipo] = useState<TipoVacacion>('DIA_COMPLETO');
  const [fechaInicio, setFechaInicio] = useState(fechaHoyLocal());
  const [fechaFin, setFechaFin] = useState(fechaHoyLocal());
  const [fechaUnica, setFechaUnica] = useState(fechaHoyLocal());
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('13:00');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const diasEstimados = tipo === 'MEDIO_DIA' ? 0.5 : diasDelRango(fechaInicio, fechaFin);

  async function enviar() {
    setError('');

    if (tipo === 'DIA_COMPLETO') {
      if (!fechaInicio || !fechaFin) {
        setError('Indica la fecha de inicio y la fecha de fin');
        return;
      }
      if (fechaFin < fechaInicio) {
        setError('La fecha de fin no puede ser anterior a la de inicio');
        return;
      }
    } else {
      if (!fechaUnica) {
        setError('Indica la fecha del medio día');
        return;
      }
      if (!horaInicio || !horaFin) {
        setError('Indica la hora de inicio y la hora de fin');
        return;
      }
      if (minutosDe(horaFin) - minutosDe(horaInicio) !== 240) {
        setError('El bloque de medio día debe durar exactamente 4 horas (ej. 09:00 a 13:00)');
        return;
      }
    }

    setEnviando(true);
    try {
      await vacacionService.crearSolicitud(
        tipo === 'DIA_COMPLETO'
          ? { tipo, fechaInicio, fechaFin }
          : { tipo, fechaInicio: fechaUnica, fechaFin: fechaUnica, horaInicio, horaFin },
      );
      mostrar('Solicitud registrada. Queda pendiente del VoBo de tu jefe.', 'success');
      onCreado();
    } catch (err) {
      mostrar(extractMsg(err), 'error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!enviando) onClose();
      }}
      title="Solicitar vacaciones"
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-content-primary" htmlFor="vac-tipo">
            Tipo de vacaciones
          </label>
          <select
            id="vac-tipo"
            className="input-field"
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as TipoVacacion);
              setError('');
            }}
            disabled={enviando}
          >
            <option value="DIA_COMPLETO">Día completo</option>
            <option value="MEDIO_DIA">Medio día (4 horas)</option>
          </select>
        </div>

        {tipo === 'DIA_COMPLETO' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              theme="light"
              label="Fecha inicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => {
                setFechaInicio(e.target.value);
                setError('');
              }}
              disabled={enviando}
            />
            <Input
              theme="light"
              label="Fecha fin"
              type="date"
              value={fechaFin}
              min={fechaInicio}
              onChange={(e) => {
                setFechaFin(e.target.value);
                setError('');
              }}
              disabled={enviando}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              theme="light"
              label="Fecha"
              type="date"
              value={fechaUnica}
              onChange={(e) => {
                setFechaUnica(e.target.value);
                setError('');
              }}
              disabled={enviando}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                theme="light"
                label="Hora inicio"
                type="time"
                value={horaInicio}
                onChange={(e) => {
                  setHoraInicio(e.target.value);
                  setError('');
                }}
                disabled={enviando}
              />
              <Input
                theme="light"
                label="Hora fin"
                type="time"
                value={horaFin}
                onChange={(e) => {
                  setHoraFin(e.target.value);
                  setError('');
                }}
                disabled={enviando}
              />
            </div>
          </div>
        )}

        <p className="text-xs text-content-tertiary">
          Días a descontar:{' '}
          <span className="font-semibold text-content-secondary">{formatearDias(diasEstimados)}</span>
        </p>

        {error && <p className="text-sm text-state-error-fg">{error}</p>}

        <div className="flex justify-end gap-3 border-t border-line-light pt-4">
          <Button theme="light" variant="ghost" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button theme="light" variant="primary" onClick={enviar} disabled={enviando}>
            <PaperAirplaneIcon className="h-4 w-4" />
            {enviando ? 'Enviando…' : 'Enviar solicitud'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Página ───────────────────────────────────────────────

export function MisVacacionesPage() {
  const { user } = useAuth();
  const { mostrar } = useToast();

  const [saldo, setSaldo] = useState<VacacionSaldo | null>(null);
  const [sinSaldo, setSinSaldo] = useState(false);
  const [solicitudes, setSolicitudes] = useState<SolicitudVacacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [avisoListado, setAvisoListado] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);

  const anioActual = new Date().getFullYear();

  const cargar = useCallback(
    async (silencioso = false) => {
      if (silencioso) setActualizando(true);
      else setCargando(true);

      try {
        const saldoData = await vacacionService.obtenerMiSaldo();
        setSaldo(saldoData);
        setSinSaldo(false);
      } catch (err) {
        if (esSinSaldo(err)) {
          setSaldo(null);
          setSinSaldo(true);
        } else {
          mostrar('No se pudo cargar tu saldo de vacaciones', 'error');
        }
      }

      try {
        const lista = await vacacionService.listarSolicitudes();
        setSolicitudes(lista);
        setAvisoListado('');
      } catch {
        setSolicitudes([]);
        setAvisoListado('El listado de solicitudes aún no está disponible en el servidor.');
      } finally {
        setCargando(false);
        setActualizando(false);
      }
    },
    [mostrar],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Solo las solicitudes propias, de la más reciente a la más antigua.
  const misSolicitudes = useMemo(() => {
    const lista = [...solicitudes].sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
    if (!user) return lista;
    return lista.filter((s) => s.solicitanteId === user.id);
  }, [solicitudes, user]);

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] bg-surface-bg px-6 py-8 space-y-5">
      {/* Encabezado */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <CalendarDaysIcon className="h-6 w-6 text-brand-blue" />
          <div>
            <h1 className="text-xl font-bold text-content-primary">Mis Vacaciones</h1>
            <p className="text-sm text-content-secondary">Saldo anual y solicitudes registradas</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            theme="light"
            variant="ghost"
            size="sm"
            disabled={actualizando || cargando}
            onClick={() => void cargar(true)}
          >
            <ArrowPathIcon className="h-4 w-4" /> Actualizar
          </Button>
          <Button theme="light" variant="primary" size="sm" onClick={() => setModalAbierto(true)}>
            <PlusIcon className="h-4 w-4" /> Solicitar Vacaciones
          </Button>
        </div>
      </div>

      {/* KPI principal: días pendientes */}
      <div className="rounded-ds-lg border border-line-light bg-surface-card p-6 shadow-card">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
              Días pendientes · {anioActual}
            </p>
            {cargando ? (
              <span className="mt-3 inline-block h-9 w-9 animate-spin rounded-full border-4 border-brand-blue border-t-transparent" />
            ) : (
              <p className="mt-1 text-4xl font-bold text-brand-blue">
                {sinSaldo ? '—' : formatearDias(saldo?.diasPendientes)}
              </p>
            )}
            <p className="mt-1 text-sm text-content-secondary">
              {sinSaldo
                ? `Aún no hay saldo registrado para el año ${anioActual}. Contacta a RRHH.`
                : 'Saldo disponible para solicitar vacaciones'}
            </p>
          </div>

          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-content-tertiary">Ganados</p>
              <p className="text-lg font-semibold text-content-primary">
                {sinSaldo ? '—' : formatearDias(saldo?.diasGanados)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-content-tertiary">Usados</p>
              <p className="text-lg font-semibold text-content-primary">
                {sinSaldo ? '—' : formatearDias(saldo?.diasUsados)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-content-tertiary">Solicitudes</p>
              <p className="text-lg font-semibold text-content-primary">{misSolicitudes.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Historial de solicitudes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-content-primary">Mis solicitudes</h2>
          <span className="text-xs text-content-tertiary">{misSolicitudes.length} registro(s)</span>
        </div>

        {avisoListado && <p className="text-xs text-content-tertiary">{avisoListado}</p>}

        <div className="w-full overflow-x-auto rounded-ds-lg border border-line-light shadow-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-bg text-xs font-semibold uppercase tracking-wide text-content-secondary">
              <tr>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Fechas</th>
                <th className="px-4 py-3 text-center">Días</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-left">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light bg-surface-card">
              {cargando ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-content-tertiary">
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
                  </td>
                </tr>
              ) : misSolicitudes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-content-tertiary">
                    Todavía no has registrado solicitudes de vacaciones
                  </td>
                </tr>
              ) : (
                misSolicitudes.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-surface-bg">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-content-primary">
                      {ETIQUETA_TIPO[s.tipo]}
                    </td>
                    <td className="px-4 py-3 text-content-secondary">
                      {s.tipo === 'MEDIO_DIA'
                        ? `${formatFecha(s.fechaInicio)} · ${s.horaInicio ?? '—'} → ${s.horaFin ?? '—'}`
                        : `${formatFecha(s.fechaInicio)} al ${formatFecha(s.fechaFin)}`}
                    </td>
                    <td className="px-4 py-3 text-center text-content-primary">
                      {formatearDias(s.diasDescontados)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={BADGE_ESTADO[s.estado]}>{ETIQUETA_ESTADO[s.estado]}</span>
                    </td>
                    <td className="px-4 py-3">
                      {s.motivoRechazo ? (
                        <span className="text-state-error-fg">{s.motivoRechazo}</span>
                      ) : (
                        <span className="text-content-tertiary">
                          Registrada el {formatFecha(s.fechaCreacion)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ModalSolicitud
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        onCreado={() => {
          setModalAbierto(false);
          void cargar(true);
        }}
      />
    </div>
  );
}

