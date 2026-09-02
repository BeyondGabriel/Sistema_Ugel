// ===========================================================
// Servicios del módulo de papeletas
// ===========================================================

import { api } from './api';
import type { Papeleta, EstadoPapeleta } from '../types';

export interface DatosCrearPapeleta {
  tipoTiempo: 'DIAS' | 'HORAS';
  fechaInicio: string;
  fechaFin: string;
  horaSalida?: string | null;
  horaRetorno?: string | null;
  motivo: string;
  motivoOtros?: string | null;
}

export interface FiltrosPapeletas {
  estado?: EstadoPapeleta;
  solicitanteId?: number;
  fechaInicio?: string;
  fechaFin?: string;
}

export interface ResultadoVerificarToken {
  valido: boolean;
  mensaje?: string;
  papeleta?: {
    id: number;
    numero: string;
    solicitante: { nombres: string; apellidos: string };
    tipoTiempo: string;
    fechaInicio: string;
    fechaFin: string;
    horaSalida: string | null;
    horaRetorno: string | null;
    estado: EstadoPapeleta;
    token: string | null;
  };
}

interface RespuestaPapeleta { papeleta: Papeleta }
interface RespuestaListar { papeletas: Papeleta[] }

export const papeletaService = {
  async crearPapeleta(data: DatosCrearPapeleta): Promise<Papeleta> {
    const { data: res } = await api.post<RespuestaPapeleta>('/papeletas', data);
    return res.papeleta;
  },

  async listarPapeletas(filtros?: FiltrosPapeletas): Promise<Papeleta[]> {
    const params: Record<string, string | number> = {};
    if (filtros?.estado) params.estado = filtros.estado;
    if (filtros?.solicitanteId) params.solicitanteId = filtros.solicitanteId;
    if (filtros?.fechaInicio) params.fechaInicio = filtros.fechaInicio;
    if (filtros?.fechaFin) params.fechaFin = filtros.fechaFin;
    const { data: res } = await api.get<RespuestaListar>('/papeletas', { params });
    return res.papeletas;
  },

  async obtenerPapeleta(id: number): Promise<Papeleta> {
    const { data: res } = await api.get<RespuestaPapeleta>(`/papeletas/${id}`);
    return res.papeleta;
  },

  async iniciarRevision(id: number): Promise<Papeleta> {
    const { data: res } = await api.put<RespuestaPapeleta>(`/papeletas/${id}/revisar`);
    return res.papeleta;
  },

  async aprobar(id: number): Promise<Papeleta> {
    const { data: res } = await api.put<RespuestaPapeleta>(`/papeletas/${id}/aprobar`);
    return res.papeleta;
  },

  async rechazar(id: number, motivoRechazo: string): Promise<Papeleta> {
    const { data: res } = await api.put<RespuestaPapeleta>(`/papeletas/${id}/rechazar`, { motivoRechazo });
    return res.papeleta;
  },

  async observar(id: number, comentario: string): Promise<Papeleta> {
    const { data: res } = await api.put<RespuestaPapeleta>(`/papeletas/${id}/observar`, { comentario });
    return res.papeleta;
  },

  async cancelar(id: number): Promise<Papeleta> {
    const { data: res } = await api.put<RespuestaPapeleta>(`/papeletas/${id}/cancelar`);
    return res.papeleta;
  },

  async reenviar(id: number, data: DatosCrearPapeleta): Promise<Papeleta> {
    const { data: res } = await api.put<RespuestaPapeleta>(`/papeletas/${id}/reenviar`, data);
    return res.papeleta;
  },

  async anular(id: number, motivoAnulacion: string): Promise<Papeleta> {
    const { data: res } = await api.put<RespuestaPapeleta>(`/papeletas/${id}/anular`, { motivoAnulacion });
    return res.papeleta;
  },

  async solicitarAnulacion(id: number): Promise<Papeleta> {
    const { data: res } = await api.post<RespuestaPapeleta>(`/papeletas/${id}/solicitar-anulacion`);
    return res.papeleta;
  },

  async cancelarSolicitudAnulacion(id: number): Promise<Papeleta> {
    const { data: res } = await api.post<RespuestaPapeleta>(`/papeletas/${id}/cancelar-solicitud-anulacion`);
    return res.papeleta;
  },

  async verificarToken(token: string): Promise<ResultadoVerificarToken> {
    const { data } = await api.post<ResultadoVerificarToken>('/papeletas/verificar-token', { token });
    return data;
  },

  async exportarPapeletas(filtros?: FiltrosPapeletas): Promise<void> {
    const params: Record<string, string | number> = {};
    if (filtros?.estado) params.estado = filtros.estado;
    if (filtros?.solicitanteId) params.solicitanteId = filtros.solicitanteId;
    if (filtros?.fechaInicio) params.fechaInicio = filtros.fechaInicio;
    if (filtros?.fechaFin) params.fechaFin = filtros.fechaFin;

    const resp = await api.get('/papeletas/exportar', { params, responseType: 'blob' });
    const url = URL.createObjectURL(resp.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `papeletas-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** Obtiene el PDF autenticado y lo abre en una nueva pestaña. */
  async abrirPDF(id: number): Promise<void> {
    try {
      const resp = await api.get(`/papeletas/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Limpiar la URL después de un tiempo prudencial
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // El interceptor de Axios ya mostrará un toast con el error
    }
  },
};