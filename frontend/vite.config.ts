import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuración de Vite para el frontend del Sistema de Gestión de Personal
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Redirige todas las peticiones /api hacia el backend en desarrollo
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Redirige la conexión de Socket.IO hacia el backend
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
