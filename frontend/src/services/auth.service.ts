import { api } from './api';

export const authService = {
  async login(email: string, password: string) {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  async cambiarPassword(passwordActual: string, nuevaPassword: string) {
    const response = await api.post('/auth/cambiar-password', {
      passwordActual,
      nuevaPassword,
    });
    return response.data;
  },

  async miPerfil() {
    const response = await api.get('/auth/mi-perfil');
    return response.data;
  },
};