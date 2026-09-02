import { api } from './api';

export const notificacionService = {
  async listar(soloNoLeidas = false) {
    const response = await api.get('/notificaciones', {
      params: soloNoLeidas ? { soloNoLeidas: true } : {},
    });
    return response.data;
  },
  async marcarLeida(id: number) {
    const response = await api.put(`/notificaciones/${id}/leer`);
    return response.data;
  },
  async marcarTodasLeidas() {
    const response = await api.put('/notificaciones/leer-todas');
    return response.data;
  },
};