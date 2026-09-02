// ===========================================================
// Instancia central de Axios con interceptores de autenticación
// ===========================================================

import axios from 'axios';

const TOKEN_KEY = 'sigper_token';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// ── Interceptor de petición: adjunta el token JWT ─────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Interceptor de respuesta: redirige al login en 401 ────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('sigper_usuario');
      // Redirige sin usar useNavigate (fuera del árbol de React)
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const removeToken = (): void => localStorage.removeItem(TOKEN_KEY);
