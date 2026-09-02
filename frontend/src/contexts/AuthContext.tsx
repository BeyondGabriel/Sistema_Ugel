// ===========================================================
// Contexto de autenticación global
// Persiste token y usuario en localStorage para sobrevivir recargas
// ===========================================================

import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authService } from '../services/auth.service';
import { setToken, removeToken, getToken } from '../services/api';
import type { Usuario, Rol } from '../types';

const USUARIO_KEY = 'sigper_usuario';

export interface AuthUser {
  id: number;
  email: string;
  rol: Rol;
  nombres: string;
  cambioPassword: boolean;
}

export interface AuthContextValue {
  user: AuthUser | null;
  perfilCompleto: Usuario | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ requiereCambioPassword: boolean }>;
  logout: () => void;
  cambiarPassword: (actual: string, nueva: string) => Promise<void>;
  cargarPerfil: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function leerUsuarioLocalStorage(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USUARIO_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(leerUsuarioLocalStorage);
  const [perfilCompleto, setPerfilCompleto] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const data = await authService.login(email, password);
        setToken(data.token);
        setUser(data.usuario);
        localStorage.setItem(USUARIO_KEY, JSON.stringify(data.usuario));
        return { requiereCambioPassword: data.requiereCambioPassword };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(() => {
    removeToken();
    localStorage.removeItem(USUARIO_KEY);
    setUser(null);
    setPerfilCompleto(null);
  }, []);

  const cambiarPassword = useCallback(async (actual: string, nueva: string) => {
    await authService.cambiarPassword(actual, nueva);
    // Después del cambio la sesión se cierra para forzar login normal
    logout();
  }, [logout]);

  const cargarPerfil = useCallback(async () => {
    if (!getToken()) return;
    try {
      const { usuario } = await authService.miPerfil();
      setPerfilCompleto(usuario);
      // También actualiza los datos básicos del usuario en estado/localStorage
      const basico: AuthUser = {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol,
        nombres: usuario.nombres,
        cambioPassword: usuario.cambioPassword,
      };
      setUser(basico);
      localStorage.setItem(USUARIO_KEY, JSON.stringify(basico));
    } catch {
      // Si falla (token expirado, etc.) la sesión se limpia vía el interceptor de Axios
    }
  }, []);

  // Al montar, si hay un token persistido se carga el perfil para rehidratar la sesión
  useEffect(() => {
    if (getToken() && !perfilCompleto) {
      cargarPerfil();
    }
  }, [cargarPerfil, perfilCompleto]);

  return (
    <AuthContext.Provider
      value={{ user, perfilCompleto, isLoading, login, logout, cambiarPassword, cargarPerfil }}
    >
      {children}
    </AuthContext.Provider>
  );
}
