// ===========================================================
// Servicios del módulo de vacaciones
//
// Flujo de una solicitud:
//   PENDIENTE --(VoBo del Jefe/Directora)--> CON_VB
//   CON_VB    --(aprobación de RRHH/Admin)--> APROBADA
//   PENDIENTE/CON_VB --(rechazo motivado)--> RECHAZADA
// ===========================================================

import { api } from './api';
import type {
  EstadoSolicitudVacacion,
  SolicitudVacacion,
  TipoVacacion,
  VacacionSaldo,
} from '../types';

// ─── Tipos de petición ────────────────────────────────────

export interface DatosCrearSolicitudVacacion {
  tipo: TipoVacacion;
  /** Fecha del primer día en formato "YYYY-MM-DD". */
  fechaInicio: string;
  /** Fecha del último día en formato "YYYY-MM-DD" (igual a la anterior en MEDIO_DIA). */
  fechaFin: string;
  /** Solo para MEDIO_DIA: hora "HH:mm" de inicio del bloque de 4 horas. */
  horaInicio?: string | null;
  /** Solo para MEDIO_DIA: hora "HH:mm" de fin del bloque de 4 horas. */
  horaFin?: string | null;
}

export interface FiltrosSolicitudesVacacion {
  estado?: EstadoSolicitudVacacion;
  /** El backend expone el filtro como `usuarioId` (solicitante). */
  usuarioId?: number;
}

export interface DatosSaldoManual {
  usuarioId: number;
  anio: number;
  diasGanados: number;
}

// ─── Respuestas del API ───────────────────────────────────

interface RespuestaSaldo {
  saldo: VacacionSaldo;
}

interface RespuestaSolicitud {
  solicitud: SolicitudVacacion;
}

/**
 * El listado general puede responder con un array directo o envuelto en
 * `solicitudes` / `vacaciones`; el servicio normaliza los tres formatos.
 */
type RespuestaListar =
  | SolicitudVacacion[]
  | { solicitudes?: SolicitudVacacion[]; vacaciones?: SolicitudVacacion[] };

// ─── Utilidades ───────────────────────────────────────────

/**
 * Convierte una fecha "YYYY-MM-DD" al ISO 8601 **con offset** que exige el
 * backend (`z.string().datetime({ offset: true })`).
 *
 * Ej: aIsoConOffset('2026-03-16') → '2026-03-16T00:00:00-05:00' en Perú.
 *
 * No se usa `toISOString()` porque devuelve el instante en UTC: el backend
 * calcula los días descontados y el año del saldo sobre la fecha recibida,
 * así que se envía la medianoche local con su offset explícito.
 */
export function aIsoConOffset(fecha: string, hora = '00:00'): string {
  const [anio, mes, dia] = fecha.split('-');

  // getTimezoneOffset() devuelve los minutos a restar para llegar a UTC
  // (en Perú: 300). El offset ISO tiene el signo opuesto.
  const offsetMinutos = -new Date(`${fecha}T${hora}:00`).getTimezoneOffset();
  const signo = offsetMinutos >= 0 ? '+' : '-';
  const absoluto = Math.abs(offsetMinutos);
  const hh = String(Math.floor(absoluto / 60)).padStart(2, '0');
  const mm = String(absoluto % 60).padStart(2, '0');

  return `${anio}-${mes}-${dia}T${hora}:00${signo}${hh}:${mm}`;
}

// ─── Servicio ─────────────────────────────────────────────

export const vacacionService = {
  /** Saldo anual del usuario autenticado (por defecto, el año en curso). */
  async obtenerMiSaldo(anio?: number): Promise<VacacionSaldo> {
    const params: Record<string, number> = {};
    if (anio) params.anio = anio;

    const { data } = await api.get<RespuestaSaldo>('/vacaciones/mi-saldo', { params });
    return data.saldo;
  },

  /** Crea la solicitud del usuario autenticado (nace en PENDIENTE). */
  async crearSolicitud(datos: DatosCrearSolicitudVacacion): Promise<SolicitudVacacion> {
    const esMedioDia = datos.tipo === 'MEDIO_DIA';

    const payload = {
      tipo: datos.tipo,
      fechaInicio: aIsoConOffset(datos.fechaInicio),
      fechaFin: aIsoConOffset(esMedioDia ? datos.fechaInicio : datos.fechaFin),
      horaInicio: esMedioDia ? datos.horaInicio ?? null : null,
      horaFin: esMedioDia ? datos.horaFin ?? null : null,
    };

    const { data } = await api.post<RespuestaSolicitud>('/vacaciones', payload);
    return data.solicitud;
  },

  /**
   * Listado de solicitudes. El backend no publica este endpoint todavía
   * (Fase 2 solo expone mi-saldo, crear, vb, aprobar, rechazar y saldos);
   * las páginas consumen el método con degradación elegante hasta que la
   * ruta `GET /api/vacaciones` se registre.
   */
  async listarSolicitudes(filtros?: FiltrosSolicitudesVacacion): Promise<SolicitudVacacion[]> {
    const params: Record<string, string | number> = {};
    if (filtros?.estado) params.estado = filtros.estado;
    if (filtros?.usuarioId) params.usuarioId = filtros.usuarioId;

    const { data } = await api.get<RespuestaListar>('/vacaciones', { params });

    if (Array.isArray(data)) return data;
    return data.solicitudes ?? data.vacaciones ?? [];
  },

  /** VoBo del Jefe/Directora: PENDIENTE → CON_VB. */
  async darVoBo(id: number): Promise<SolicitudVacacion> {
    const { data } = await api.put<RespuestaSolicitud>(`/vacaciones/${id}/vb`);
    return data.solicitud;
  },

  /** Aprobación final de RRHH/Admin: CON_VB → APROBADA (descuenta saldo). */
  async aprobarSolicitud(id: number): Promise<SolicitudVacacion> {
    const { data } = await api.put<RespuestaSolicitud>(`/vacaciones/${id}/aprobar`);
    return data.solicitud;
  },

  /** Rechazo motivado (Jefe, Directora, RRHH o Admin). */
  async rechazarSolicitud(id: number, motivoRechazo: string): Promise<SolicitudVacacion> {
    const { data } = await api.put<RespuestaSolicitud>(`/vacaciones/${id}/rechazar`, {
      motivoRechazo,
    });
    return data.solicitud;
  },

  /** Carga/actualización manual del saldo anual de un trabajador (RRHH/Admin). */
  async crearSaldoManual(datos: DatosSaldoManual): Promise<VacacionSaldo> {
    const { data } = await api.post<RespuestaSaldo>('/vacaciones/saldos', datos);
    return data.saldo;
  },
};
