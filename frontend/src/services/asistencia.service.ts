// ===========================================================
// Servicios del módulo de asistencias
// ===========================================================

import { api } from './api';
import type { Movimiento } from '../types';

export type TipoMovimiento = 'ENTRADA' | 'SALIDA';

export interface FiltrosAsistencias {
  usuarioId?: number;
  fechaInicio?: string; // ISO date "YYYY-MM-DD"
  fechaFin?: string;
  jefaturaId?: number;
}

export interface DatosRegistrarMovimiento {
  usuarioId: number;
  tipo: TipoMovimiento;
  timestamp: string; // ISO datetime
}

export interface DatosEditarMovimiento {
  nuevoTimestamp?: string;
  nuevoTipo?: TipoMovimiento;
}

interface RespuestaMovimiento {
  movimiento: Movimiento;
}

interface RespuestaListar {
  movimientos: MovimientoConJefatura[];
}

interface RespuestaPresencia {
  presencia?: PresenciaItem[];
}

export interface MovimientoConJefatura extends Movimiento {
  jefatura?: { id: number; nombre: string } | null;
}

/**
 * Tipo local para la respuesta del endpoint de presencia.
 * Incluye los campos que el frontend necesita para habilitar/deshabilitar
 * los botones de entrada y salida, sin depender estrictamente del tipo global.
 */
export interface PresenciaItem {
  usuarioId: number;
  estado: 'PRESENTE' | 'AUSENTE';
  ultimoMovimiento?: string;
}

export const asistenciaService = {
  async registrarMovimiento(data: DatosRegistrarMovimiento): Promise<Movimiento> {
    const { data: res } = await api.post<RespuestaMovimiento>('/asistencias', data);
    return res.movimiento;
  },

  async editarMovimiento(id: number, data: DatosEditarMovimiento): Promise<Movimiento> {
    const { data: res } = await api.put<RespuestaMovimiento>(`/asistencias/${id}`, data);
    return res.movimiento;
  },

  async listarMovimientos(filtros?: FiltrosAsistencias): Promise<MovimientoConJefatura[]> {
    const params: Record<string, string | number> = {};
    if (filtros?.usuarioId) params.usuarioId = filtros.usuarioId;
    if (filtros?.fechaInicio) params.fechaInicio = filtros.fechaInicio;
    if (filtros?.fechaFin) params.fechaFin = filtros.fechaFin;
    if (filtros?.jefaturaId) params.jefaturaId = filtros.jefaturaId;
    const { data: res } = await api.get<RespuestaListar>('/asistencias', { params });
    return res.movimientos ?? [];
  },

  async obtenerPresencia(): Promise<PresenciaItem[]> {
    const { data: res } = await api.get<RespuestaPresencia>('/asistencias/presencia');
    // Si la respuesta no contiene la propiedad "presencia", devolvemos un array vacío.
    return res.presencia ?? [];
  },

  /**
   * Descarga el Excel de asistencias y dispara la descarga en el navegador.
   * Devuelve true si tuvo éxito.
   */
  async exportarAsistencias(filtros?: FiltrosAsistencias): Promise<void> {
    const params: Record<string, string | number> = {};
    if (filtros?.usuarioId) params.usuarioId = filtros.usuarioId;
    if (filtros?.fechaInicio) params.fechaInicio = filtros.fechaInicio;
    if (filtros?.fechaFin) params.fechaFin = filtros.fechaFin;
    if (filtros?.jefaturaId) params.jefaturaId = filtros.jefaturaId;

    const resp = await api.get('/asistencias/exportar', {
      params,
      responseType: 'blob',
    });

    const url = URL.createObjectURL(resp.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asistencias-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },
};