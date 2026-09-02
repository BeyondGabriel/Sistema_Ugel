import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnvelopeIcon, LockClosedIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { Rol } from '../../types';

/** Ruta por defecto según el rol del usuario */
function rutaPorRol(rol: Rol): string {
  return '/dashboard';
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const { mostrar } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!email.trim() || !password) {
      mostrar('Completa el email y la contraseña', 'warning');
      return;
    }

    try {
      const { requiereCambioPassword } = await login(email.trim(), password);

      if (requiereCambioPassword) {
        navigate('/cambiar-password', { replace: true });
      } else {
        navigate(rutaPorRol('ADMIN'), { replace: true });
      }
    } catch (err: unknown) {
      const mensaje =
        (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ??
        'No se pudo iniciar sesión. Verifica tus credenciales.';
      mostrar(mensaje, 'error');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-sm">
        {/* Marca */}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="rounded-2xl bg-emerald-600/20 p-3">
            <ShieldCheckIcon className="h-9 w-9 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-100">SIGPER</h1>
          <p className="text-sm text-gray-500">Sistema de Gestión de Personal · UGEL Talara</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Correo institucional"
            type="email"
            placeholder="usuario@ugeltalara.gob.pe"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icono={<EnvelopeIcon />}
            autoComplete="email"
            required
          />
          <Input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icono={<LockClosedIcon />}
            autoComplete="current-password"
            required
          />
          <Button
            type="submit"
            variante="primary"
            tamano="md"
            cargando={isLoading}
            fullWidth
            className="mt-2"
          >
            Ingresar
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-600">
          Acceso restringido al personal autorizado
        </p>
      </div>
    </div>
  );
}
