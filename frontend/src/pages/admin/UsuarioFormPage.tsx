import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { adminService, type DatosCrearUsuario, type DatosEditarUsuario } from '../../services/admin.service';
import { useAuth } from '../../hooks/useAuth';
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
  const { user } = useAuth();
  const { mostrar } = useToast();
  const esEdicion = Boolean(id);
  // Bloque A: título formal y marca P1C solo los gestiona el Administrador.
  const esAdmin = user?.rol === 'ADMIN';

  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<Rol>('ESPECIALISTA');
  const [jefaturaId, setJefaturaId] = useState<number | ''>('');
  const [jefeId, setJefeId] = useState<number | ''>('');
  const [password, setPassword] = useState('');
  const [activo, setActivo] = useState(true);
  const [tituloFormal, setTituloFormal] = useState('');
  const [noDisponible, setNoDisponible] = useState(false);
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
        setTituloFormal(usuario.tituloFormal ?? '');
        setNoDisponible(usuario.noDisponible ?? false);
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
          ...(esAdmin
            ? { tituloFormal: tituloFormal.trim() || null, noDisponible }
            : {}),
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
          ...(esAdmin
            ? { tituloFormal: tituloFormal.trim() || null, noDisponible }
            : {}),
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
      <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] bg-surface-bg px-6 py-8">
        <div className="flex justify-center py-20">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] max-w-2xl space-y-5 bg-surface-bg px-6 py-8 text-content-primary">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" theme="light" onClick={() => navigate('/usuarios')}>
          <ArrowLeftIcon className="h-4 w-4" /> Volver
        </Button>
        <h1 className="text-xl font-bold text-content-primary">
          {esEdicion ? 'Editar usuario' : 'Nuevo usuario'}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card theme="light">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombres *"
              theme="light"
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              error={errores.nombres}
              placeholder="Juan Carlos"
            />
            <Input
              label="Apellidos *"
              theme="light"
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
              error={errores.apellidos}
              placeholder="García López"
            />
          </div>

          <div className="mt-4">
            <Input
              label="Correo institucional *"
              theme="light"
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
              <label className="text-sm font-medium text-content-primary">Rol *</label>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as Rol)}
                className="input-field"
              >
                {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.label}</option>)}
              </select>
              {ROLES_UNICOS.includes(rol) && (
                <p className="text-xs text-state-warning-fg">
                  Rol único: si ya existe uno activo, el nuevo usuario se creará inactivo.
                </p>
              )}
            </div>

            {/* Jefatura */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-content-primary">Jefatura</label>
              <select
                value={jefaturaId}
                onChange={(e) => setJefaturaId(e.target.value ? Number(e.target.value) : '')}
                className="input-field"
              >
                <option value="">Sin asignar</option>
                {jefaturas.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Jefe inmediato */}
          <div className="mt-4 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-content-primary">Jefe inmediato</label>
            <select
              value={jefeId}
              onChange={(e) => setJefeId(e.target.value ? Number(e.target.value) : '')}
              className="input-field"
            >
              <option value="">Sin asignar</option>
              {jefes.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nombres} {j.apellidos} ({j.rol})
                </option>
              ))}
            </select>
          </div>

          {/* Bloque A: datos de autorización (solo Administrador) */}
          {esAdmin && (
            <div className="mt-4 rounded-ds-md border border-line-light bg-surface-bg p-4">
              <p className="text-sm font-semibold text-content-primary">Autorización</p>
              <p className="mb-3 text-xs text-content-secondary">
                Define el tratamiento formal del usuario en los documentos oficiales y si
                puede recibir papeletas para aprobar.
              </p>
              <Input
                label="Título formal (documentos oficiales)"
                theme="light"
                value={tituloFormal}
                onChange={(e) => setTituloFormal(e.target.value)}
                error={errores.tituloFormal}
                placeholder="Ej. Director(a) de la UGEL Talara"
                maxLength={150}
              />
              <div className="mt-3 flex items-start gap-3">
                <input
                  id="noDisponible"
                  type="checkbox"
                  checked={noDisponible}
                  onChange={(e) => setNoDisponible(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-line-strong bg-surface-card text-brand-blue focus:ring-brand-blue"
                />
                <div>
                  <label htmlFor="noDisponible" className="text-sm font-medium text-content-primary">
                    No disponible para aprobar (P1C)
                  </label>
                  <p className="text-xs text-content-secondary">
                    Las papeletas que le corresponderían se derivan a su jefe o quedan
                    bloqueadas para el Administrador si no hay delegación vigente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Contraseña */}
          <div className="mt-4">
            <Input
              label={esEdicion ? 'Nueva contraseña (dejar vacío para no cambiarla)' : 'Contraseña (opcional — se genera automáticamente si se deja vacío)'}
              theme="light"
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
                className="h-4 w-4 rounded border-line-strong bg-surface-card text-brand-blue focus:ring-brand-blue"
              />
              <label htmlFor="activo" className="text-sm font-medium text-content-primary">
                Usuario activo
              </label>
            </div>
          )}

          {/* Botones */}
          <div className="mt-6 flex gap-3 justify-end">
            <Button variant="ghost" type="button" theme="light" onClick={() => navigate('/usuarios')} disabled={guardando}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" theme="light" disabled={guardando}>
              {guardando ? (esEdicion ? 'Guardando...' : 'Creando...') : (esEdicion ? 'Guardar cambios' : 'Crear usuario')}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
