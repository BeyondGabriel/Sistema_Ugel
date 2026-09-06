import { api } from './api';

export const visitaService = {
  async registrarVisita(data: {
    visitanteNombre: string;
    visitanteDni: string;
    trabajadorVisitadoId: number;
    gafeteEntregado?: boolean;
  }) {
    const response = await api.post('/visitas', data);
    return response.data;
  },

  async registrarSalida(id: number) {
    const response = await api.put(`/visitas/${id}/salida`);
    return response.data.visita;  // ← devuelve la visita directamente
  },

  async marcarGafete(id: number) {
    const response = await api.put(`/visitas/${id}/gafete`);
    return response.data.visita;  // ← devuelve la visita directamente
  },

  async listarVisitas(filtros?: {
    fechaInicio?: string;
    fechaFin?: string;
    trabajadorVisitadoId?: number;
    registradorId?: number;
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
  a.download = `visitas-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Liberar memoria
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}}