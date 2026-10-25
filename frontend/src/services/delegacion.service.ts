// ===========================================================
// Servicio del módulo de delegaciones de aprobación (Bloque A)
// Solo el rol ADMIN puede consumir estos endpoints.
// ===========================================================

import { api } from './api';
import type { Delegacion } from '../types';

export interface FiltrosDelegaciones {
  titularId?: number;
  encargadoId?: number;
  soloVigentes?: boolean;
}

export interface DatosCrearDelegacion {
  titularId: number;
  encargadoId: number;
  /** ISO 8601 */
  fechaInicio: string;
  /** ISO 8601 */
  fechaFin: string;
  motivo?: string;
  documentoRef?: string;
}

interface RespuestaListar {
  delegaciones: Delegacion[];
}

interface RespuestaDelegacion {
  delegacion: Delegacion;
}

export const delegacionService = {
  async listar(filtros?: FiltrosDelegaciones): Promise<Delegacion[]> {
    const params: Record<string, string | number> = {};
    if (filtros?.titularId !== undefined) params.titularId = filtros.titularId;
    if (filtros?.encargadoId !== undefined) params.encargadoId = filtros.encargadoId;
    if (filtros?.soloVigentes) params.soloVigentes = 'true';

    const { data } = await api.get<RespuestaListar>('/delegaciones', { params });
    return data.delegaciones ?? [];
  },

  async crear(datos: DatosCrearDelegacion): Promise<Delegacion> {
    const { data } = await api.post<RespuestaDelegacion>('/delegaciones', datos);
    return data.delegacion;
  },

  async anular(id: number, motivo?: string): Promise<Delegacion> {
    const { data } = await api.put<RespuestaDelegacion>(`/delegaciones/${id}/anular`, {
      ...(motivo ? { motivo } : {}),
    });
    return data.delegacion;
  },
};
