import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { adminService, type DatosCrearUsuario, type DatosEditarUsuario } from '../../services/admin.service';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import type { Rol, Jefatura, Usuario } from '../../types';

const ROLES: { valor: Rol; label: string }[] = [
  { valor: 'ESPECIALISTA', label: 'Especialista' },
  { valor: 'JEFE', label: 'Jefe' },
  { valor: 'VIGILANTE', label: 'Vigilante' },
  { valor: 'RRHH', label: 'RRHH' },
  { valor: 'DIRECTORA', label: 'Directora' },
  { valor: 'ADMIN', label: 'Administrador' },
];

const ROLES_UNICOS: Rol[] = ['DIRECTORA', 'RRHH', 'ADMIN'];

function validarPassword(pwd: string): string | null {
  if (pwd.length < 8) return 'Mínimo 8 caracteres';
  if (!/[0-9]/.test(pwd)) return 'Debe incluir un número';
  if (!/[^A-Za-z0-9]/.test(pwd)) return 'Debe incluir un símbolo';
  return null;
}

export function UsuarioFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { mostrar } = useToast();
  const esEdicion = Boolean(id);

  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<Rol>('ESPECIALISTA');
  const [jefaturaId, setJefaturaId] = useState<number | ''>('');
  const [jefeId, setJefeId] = useState<number | ''>('');
  const [password, setPassword] = useState('');
  const [activo, setActivo] = useState(true);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const [jefaturas, setJefaturas] = useState<Jefatura[]>([]);
  const [jefes, setJefes] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(esEdicion);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const [jefaturasData, jefesData] = await Promise.all([
          adminService.listarJefaturas(),
          adminService.listarUsuarios({ rol: 'JEFE' }),
        ]);
        setJefaturas(jefaturasData);
        const directorasData = await adminService.listarUsuarios({ rol: 'DIRECTORA' });
        setJefes([...jefesData, ...directorasData]);
      } catch {
        mostrar('No se pudieron cargar los datos auxiliares', 'error');
      }
    }
    init();
  }, [mostrar]);

  useEffect(() => {
    if (!esEdicion || !id) return;
    async function cargar() {
      try {
        const usuario = await adminService.obtenerUsuario(Number(id));
        setNombres(usuario.nombres);
        setApellidos(usuario.apellidos);
        setEmail(usuario.email);
        setRol(usuario.rol);
        setJefaturaId(usuario.jefaturaId ?? '');
        setJefeId(usuario.jefeId ?? '');
        setActivo(usuario.activo);
      } catch {
        mostrar('No se pudo cargar el usuario', 'error');
        navigate('/usuarios');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [id, esEdicion, navigate, mostrar]);

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!nombres.trim()) e.nombres = 'Los nombres son obligatorios';
    if (!apellidos.trim()) e.apellidos = 'Los apellidos son obligatorios';
    if (!email.trim()) e.email = 'El email es obligatorio';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'El email no tiene un formato válido';
    if (!esEdicion && password) {
      const err = validarPassword(password);
      if (err) e.password = err;
    }
    if (esEdicion && password) {
      const err = validarPassword(password);
      if (err) e.password = err;
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validar()) return;
    setGuardando(true);

    try {
      if (esEdicion) {
        const datos: DatosEditarUsuario = {
          nombres,
          apellidos,
          email,
          rol,
          jefaturaId: jefaturaId || null,
          jefeId: jefeId || null,
          activo,
        };
        await adminService.editarUsuario(Number(id), datos);
        mostrar('Usuario actualizado correctamente', 'success');
      } else {
        const datos: DatosCrearUsuario = {
          email,
          nombres,
          apellidos,
          rol,
          jefaturaId: jefaturaId || null,
          jefeId: jefeId || null,
          ...(password ? { password } : {}),
        };
        const { passwordGenerada, advertencia } = await adminService.crearUsuario(datos);
        if (passwordGenerada) {
          mostrar(`Usuario creado. Contraseña generada: ${passwordGenerada}`, 'info');
        } else {
          mostrar('Usuario creado correctamente', 'success');
        }
        if (advertencia) {
          mostrar(advertencia, 'warning');
        }
      }
      navigate('/usuarios');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error al guardar';
      mostrar(msg, 'error');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-20">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/usuarios')}>
          <ArrowLeftIcon className="h-4 w-4" /> Volver
        </Button>
        <h1 className="text-xl font-bold text-gray-100">
          {esEdicion ? 'Editar usuario' : 'Nuevo usuario'}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombres *"
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              error={errores.nombres}
              placeholder="Juan Carlos"
            />
            <Input
              label="Apellidos *"
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
              error={errores.apellidos}
              placeholder="García López"
            />
          </div>

          <div className="mt-4">
            <Input
              label="Correo institucional *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errores.email}
              placeholder="jgarcia@ugeltalara.gob.pe"
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Rol */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Rol *</label>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as Rol)}
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.label}</option>)}
              </select>
              {ROLES_UNICOS.includes(rol) && (
                <p className="text-xs text-amber-400">
                  Rol único: si ya existe uno activo, el nuevo usuario se creará inactivo.
                </p>
              )}
            </div>

            {/* Jefatura */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Jefatura</label>
              <select
                value={jefaturaId}
                onChange={(e) => setJefaturaId(e.target.value ? Number(e.target.value) : '')}
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Sin asignar</option>
                {jefaturas.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Jefe inmediato */}
          <div className="mt-4 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Jefe inmediato</label>
            <select
              value={jefeId}
              onChange={(e) => setJefeId(e.target.value ? Number(e.target.value) : '')}
              className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Sin asignar</option>
              {jefes.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nombres} {j.apellidos} ({j.rol})
                </option>
              ))}
            </select>
          </div>

          {/* Contraseña */}
          <div className="mt-4">
            <Input
              label={esEdicion ? 'Nueva contraseña (dejar vacío para no cambiarla)' : 'Contraseña (opcional — se genera automáticamente si se deja vacío)'}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errores.password}
              placeholder="Mín. 8 car., un número y un símbolo"
              autoComplete="new-password"
            />
          </div>

          {/* Activo (solo edición) */}
          {esEdicion && (
            <div className="mt-4 flex items-center gap-3">
              <input
                id="activo"
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
              />
              <label htmlFor="activo" className="text-sm font-medium text-gray-300">
                Usuario activo
              </label>
            </div>
          )}

          {/* Botones */}
          <div className="mt-6 flex gap-3 justify-end">
            <Button variant="ghost" type="button" onClick={() => navigate('/usuarios')} disabled={guardando}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={guardando}>
              {guardando ? (esEdicion ? 'Guardando...' : 'Creando...') : (esEdicion ? 'Guardar cambios' : 'Crear usuario')}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
