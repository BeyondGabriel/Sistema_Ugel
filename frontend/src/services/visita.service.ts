import { api } from './api';
import { fechaHoyLocal } from '../utils/fechaHora';

export const visitaService = {
  async registrarVisita(data: {
    visitanteNombre: string;
    visitanteDni: string;
    trabajadorVisitadoId: number;
  }) {
    const response = await api.post('/visitas', data);
    return response.data;
  },

  async registrarSalida(id: number) {
    const response = await api.put(`/visitas/${id}/salida`);
    return response.data.visita;  // ← devuelve la visita directamente
  },

  async listarVisitas(filtros?: {
    fechaInicio?: string;
    fechaFin?: string;
    trabajadorVisitadoId?: number;
    registradorId?: number;
    /** Bloque A: solo JEFE y DIRECTORA — 'propios' o 'equipo'. */
    alcance?: 'propios' | 'equipo';
  }) {
    const response = await api.get('/visitas', { params: filtros });
    return response.data;
  },

async exportarVisitas(filtros?: {
  fechaInicio?: string;
  fechaFin?: string;
  trabajadorVisitadoId?: number;
  registradorId?: number;
}) {
  const response = await api.get('/visitas/exportar', {
    params: filtros,
    responseType: 'blob',
  });

  // Crear blob y descargar
  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `visitas-${fechaHoyLocal()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Liberar memoria
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}}