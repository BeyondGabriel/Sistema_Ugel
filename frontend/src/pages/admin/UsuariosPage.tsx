import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusIcon,
  PencilIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { adminService } from '../../services/admin.service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import type { Usuario, Rol, Jefatura } from '../../types';

const ETIQUETAS_ROL: Record<Rol, string> = {
  ADMIN: 'Admin', RRHH: 'RRHH', DIRECTORA: 'Directora',
  JEFE: 'Jefe', ESPECIALISTA: 'Especialista', VIGILANTE: 'Vigilante',
};

const COLORES_ROL: Record<Rol, string> = {
  ADMIN: 'bg-red-900/50 text-red-300',
  RRHH: 'bg-violet-900/50 text-violet-300',
  DIRECTORA: 'bg-amber-900/50 text-amber-300',
  JEFE: 'bg-blue-900/50 text-blue-300',
  ESPECIALISTA: 'bg-cyan-900/50 text-cyan-300',
  VIGILANTE: 'bg-emerald-900/50 text-emerald-300',
};

export function UsuariosPage() {
  const { user } = useAuth();
  const { mostrar } = useToast();
  const esAdmin = user?.rol === 'ADMIN';

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [jefaturas, setJefaturas] = useState<Jefatura[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [filtroRol, setFiltroRol] = useState<Rol | ''>('');
  const [filtroJefatura, setFiltroJefatura] = useState<number | ''>('');
  const [filtroActivo, setFiltroActivo] = useState<'true' | 'false' | ''>('true');

  // Modal confirmación de desactivar
  const [modalDesactivar, setModalDesactivar] = useState<{ abierto: boolean; usuario: Usuario | null }>({ abierto: false, usuario: null });
  const [desactivando, setDesactivando] = useState(false);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [usuariosData, jefaturasData] = await Promise.all([
        adminService.listarUsuarios({
          rol: filtroRol || undefined,
          jefaturaId: filtroJefatura || undefined,
          activo: filtroActivo !== '' ? filtroActivo === 'true' : undefined,
        }),
        adminService.listarJefaturas(),
      ]);
      setUsuarios(usuariosData);
      setJefaturas(jefaturasData);
    } catch {
      mostrar('No se pudieron cargar los datos', 'error');
    } finally {
      setCargando(false);
    }
  }, [filtroRol, filtroJefatura, filtroActivo, mostrar]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  async function confirmarDesactivar() {
    if (!modalDesactivar.usuario) return;
    setDesactivando(true);
    try {
      await adminService.desactivarUsuario(modalDesactivar.usuario.id);
      mostrar(`Usuario ${modalDesactivar.usuario.nombres} desactivado correctamente`, 'success');
      setModalDesactivar({ abierto: false, usuario: null });
      cargarDatos();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error al desactivar';
      mostrar(msg, 'error');
    } finally {
      setDesactivando(false);
    }
  }

  const inputCls = 'rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Usuarios</h1>
          <p className="text-sm text-gray-400">{usuarios.length} resultado(s)</p>
        </div>
        {esAdmin && (
          <Link to="/usuarios/nuevo">
            <Button variant="primary" size="sm">
              <PlusIcon className="h-4 w-4" /> Nuevo usuario
            </Button>
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-700 bg-gray-800 p-4">
        <FunnelIcon className="h-4 w-4 mt-1.5 text-gray-500 shrink-0" />
        <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value as Rol | '')} className={inputCls}>
          <option value="">Todos los roles</option>
          {(Object.keys(ETIQUETAS_ROL) as Rol[]).map((r) => (
            <option key={r} value={r}>{ETIQUETAS_ROL[r]}</option>
          ))}
        </select>
        <select value={filtroJefatura} onChange={(e) => setFiltroJefatura(e.target.value ? Number(e.target.value) : '')} className={inputCls}>
          <option value="">Todas las jefaturas</option>
          {jefaturas.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}
        </select>
        <select value={filtroActivo} onChange={(e) => setFiltroActivo(e.target.value as 'true' | 'false' | '')} className={inputCls}>
          <option value="true">Solo activos</option>
          <option value="false">Solo inactivos</option>
          <option value="">Todos</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Rol</th>
              <th className="px-4 py-3 text-left">Jefatura</th>
              <th className="px-4 py-3 text-center">Estado</th>
              {esAdmin && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 bg-gray-900">
            {cargando ? (
              <tr>
                <td colSpan={esAdmin ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                </td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td colSpan={esAdmin ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                  No se encontraron usuarios con los filtros aplicados
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-gray-800/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-100 whitespace-nowrap">
                    {u.nombres} {u.apellidos}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLORES_ROL[u.rol]}`}>
                      {ETIQUETAS_ROL[u.rol]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{u.jefatura?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {u.activo ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                        <CheckCircleIcon className="h-3.5 w-3.5" /> Activo
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-gray-500">Inactivo</span>
                    )}
                  </td>
                  {esAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link to={`/usuarios/${u.id}/editar`}>
                          <Button variant="ghost" size="sm">
                            <PencilIcon className="h-4 w-4" /> Editar
                          </Button>
                        </Link>
                        {u.activo && u.id !== user?.id && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setModalDesactivar({ abierto: true, usuario: u })}
                          >
                            <NoSymbolIcon className="h-4 w-4" /> Desactivar
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de confirmación */}
      <Modal
        isOpen={modalDesactivar.abierto}
        onClose={() => !desactivando && setModalDesactivar({ abierto: false, usuario: null })}
        title="Confirmar desactivación"
      >
        <p className="text-sm text-gray-300">
          ¿Estás seguro de que deseas desactivar a{' '}
          <span className="font-semibold text-gray-100">
            {modalDesactivar.usuario?.nombres} {modalDesactivar.usuario?.apellidos}
          </span>
          ? El usuario no podrá iniciar sesión hasta que sea reactivado.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => setModalDesactivar({ abierto: false, usuario: null })}
            disabled={desactivando}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={confirmarDesactivar}
            disabled={desactivando}
          >
            {desactivando ? 'Desactivando...' : 'Desactivar'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}