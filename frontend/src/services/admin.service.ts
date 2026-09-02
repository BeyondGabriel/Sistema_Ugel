// ===========================================================
// Servicios del panel de administración (usuarios y jefaturas)
// ===========================================================

import { api } from './api';
import type { Usuario, Jefatura, Rol } from '../types';

// ─── Tipos de petición ────────────────────────────────────

export interface FiltrosUsuarios {
  rol?: Rol;
  jefaturaId?: number;
  activo?: boolean;
}

export interface DatosCrearUsuario {
  email: string;
  password?: string;
  rol: Rol;
  nombres: string;
  apellidos: string;
  jefaturaId?: number | null;
  jefeId?: number | null;
}

export interface DatosEditarUsuario {
  email?: string;
  rol?: Rol;
  nombres?: string;
  apellidos?: string;
  jefaturaId?: number | null;
  jefeId?: number | null;
  activo?: boolean;
}

export interface DatosJefatura {
  nombre: string;
  descripcion?: string;
}

// ─── Respuestas del API ───────────────────────────────────

interface RespuestaListarUsuarios {
  usuarios: Usuario[];
}

interface RespuestaUsuario {
  usuario: Usuario;
  passwordGenerada?: string;
  advertencia?: string;
}

interface JefaturaConConteo extends Jefatura {
  _count: { usuarios: number };
}

interface RespuestaListarJefaturas {
  jefaturas: JefaturaConConteo[];
}

interface RespuestaJefatura {
  jefatura: Jefatura;
}

// ─── Usuarios ─────────────────────────────────────────────

export const adminService = {
  async listarUsuarios(filtros?: FiltrosUsuarios): Promise<Usuario[]> {
    const params: Record<string, string | boolean | number> = {};
    if (filtros?.rol) params.rol = filtros.rol;
    if (filtros?.jefaturaId !== undefined) params.jefaturaId = filtros.jefaturaId;
    if (filtros?.activo !== undefined) params.activo = filtros.activo;

    const { data } = await api.get<RespuestaListarUsuarios>('/usuarios', { params });
    return data.usuarios;
  },

  async obtenerUsuario(id: number): Promise<Usuario> {
    const { data } = await api.get<RespuestaUsuario>(`/usuarios/${id}`);
    return data.usuario;
  },

  async crearUsuario(datos: DatosCrearUsuario): Promise<{ usuario: Usuario; passwordGenerada?: string; advertencia?: string }> {
    const { data } = await api.post<RespuestaUsuario>('/usuarios', datos);
    return { usuario: data.usuario, passwordGenerada: data.passwordGenerada, advertencia: data.advertencia };
  },

  async editarUsuario(id: number, datos: DatosEditarUsuario): Promise<Usuario> {
    const { data } = await api.put<RespuestaUsuario>(`/usuarios/${id}`, datos);
    return data.usuario;
  },

  async desactivarUsuario(id: number): Promise<{ usuario: Usuario; adminActivadoAutomaticamente: Usuario | null }> {
    const { data } = await api.put<{ usuario: Usuario; adminActivadoAutomaticamente: Usuario | null }>(`/usuarios/${id}/desactivar`);
    return data;
  },

  // ─── Jefaturas ──────────────────────────────────────────

  async listarJefaturas(): Promise<JefaturaConConteo[]> {
    const { data } = await api.get<RespuestaListarJefaturas>('/jefaturas');
    return data.jefaturas;
  },

  async crearJefatura(datos: DatosJefatura): Promise<Jefatura> {
    const { data } = await api.post<RespuestaJefatura>('/jefaturas', datos);
    return data.jefatura;
  },

  async editarJefatura(id: number, datos: Partial<DatosJefatura>): Promise<Jefatura> {
    const { data } = await api.put<RespuestaJefatura>(`/jefaturas/${id}`, datos);
    return data.jefatura;
  },

  async eliminarJefatura(id: number) {
    const response = await api.delete(`/jefaturas/${id}`);
    return response.data;
  },
};
