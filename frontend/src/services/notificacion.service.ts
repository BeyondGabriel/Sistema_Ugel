import { api } from './api';

export const notificacionService = {
  async listarNotificaciones(soloNoLeidas = false) {
    const response = await api.get('/notificaciones', {
      params: soloNoLeidas ? { soloNoLeidas: true } : {},
    });
    return response.data;
  },
  // Mantenemos un alias por si algún otro archivo usa listar()
  async listar(soloNoLeidas = false) {
    return this.listarNotificaciones(soloNoLeidas);
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