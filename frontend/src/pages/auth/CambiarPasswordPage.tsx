import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockClosedIcon, KeyIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

/** Misma validación que el backend */
function validarPassword(pwd: string): string | null {
  if (pwd.length < 8) return 'Mínimo 8 caracteres';
  if (!/[0-9]/.test(pwd)) return 'Debe incluir al menos un número';
  if (!/[^A-Za-z0-9]/.test(pwd)) return 'Debe incluir al menos un símbolo';
  return null;
}

export function CambiarPasswordPage() {
  const navigate = useNavigate();
  const { cambiarPassword, isLoading } = useAuth();
  const { mostrar } = useToast();

  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [errores, setErrores] = useState({ nueva: '', confirmar: '' });

  function validarFormulario(): boolean {
    const e = { nueva: '', confirmar: '' };
    const errorPwd = validarPassword(nueva);
    if (errorPwd) e.nueva = errorPwd;
    if (nueva !== confirmar) e.confirmar = 'Las contraseñas no coinciden';
    setErrores(e);
    return !e.nueva && !e.confirmar;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validarFormulario()) return;

    try {
      await cambiarPassword(actual, nueva);
      mostrar('Contraseña actualizada. Por favor ingresa de nuevo.', 'success');
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      const mensaje =
        (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ??
        'No se pudo cambiar la contraseña. Verifica la contraseña actual.';
      mostrar(mensaje, 'error');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-sm">
        {/* Encabezado */}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="rounded-2xl bg-amber-600/20 p-3">
            <KeyIcon className="h-9 w-9 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-100">Cambio de contraseña requerido</h1>
          <p className="text-sm text-gray-500">
            Tu cuenta requiere que establezcas una contraseña personal antes de continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Contraseña actual"
            type="password"
            placeholder="••••••••"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            icono={<LockClosedIcon />}
            required
          />
          <Input
            label="Nueva contraseña"
            type="password"
            placeholder="Mínimo 8 car., un número y un símbolo"
            value={nueva}
            onChange={(e) => {
              setNueva(e.target.value);
              setErrores((err) => ({ ...err, nueva: '' }));
            }}
            icono={<LockClosedIcon />}
            error={errores.nueva}
            required
          />
          <Input
            label="Confirmar nueva contraseña"
            type="password"
            placeholder="••••••••"
            value={confirmar}
            onChange={(e) => {
              setConfirmar(e.target.value);
              setErrores((err) => ({ ...err, confirmar: '' }));
            }}
            icono={<LockClosedIcon />}
            error={errores.confirmar}
            required
          />

          <ul className="rounded-lg bg-gray-800 px-4 py-3 text-xs text-gray-400 space-y-1">
            <li className={nueva.length >= 8 ? 'text-emerald-400' : ''}>✓ Mínimo 8 caracteres</li>
            <li className={/[0-9]/.test(nueva) ? 'text-emerald-400' : ''}>✓ Al menos un número</li>
            <li className={/[^A-Za-z0-9]/.test(nueva) ? 'text-emerald-400' : ''}>✓ Al menos un símbolo (!@#$…)</li>
          </ul>

          <Button type="submit" variante="primary" cargando={isLoading} fullWidth>
            Guardar contraseña
          </Button>
        </form>
      </div>
    </div>
  );
}
