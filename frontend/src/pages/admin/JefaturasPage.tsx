import { useEffect, useState } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import { adminService } from '../../services/admin.service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import type { Jefatura } from '../../types';

export function JefaturasPage() {
  const { user } = useAuth();
  const { mostrar } = useToast();
  const esAdmin = user?.rol === 'ADMIN';

  const [jefaturas, setJefaturas] = useState<Jefatura[]>([]);
  const [cargando, setCargando] = useState(true);

  // Modal crear/editar
  const [modalForm, setModalForm] = useState<{
    abierto: boolean;
    jefatura: Jefatura | null;
    guardando: boolean;
    nombre: string;
    descripcion: string;
  }>({
    abierto: false,
    jefatura: null,
    guardando: false,
    nombre: '',
    descripcion: '',
  });

  // Modal eliminar
  const [modalEliminar, setModalEliminar] = useState<{
    abierto: boolean;
    jefatura: Jefatura | null;
    eliminando: boolean;
  }>({ abierto: false, jefatura: null, eliminando: false });

  async function cargarJefaturas() {
    setCargando(true);
    try {
      const data = await adminService.listarJefaturas();
      setJefaturas(data);
    } catch {
      mostrar('No se pudieron cargar las jefaturas', 'error');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargarJefaturas(); }, []);

  function abrirModalCrear() {
    setModalForm({
      abierto: true,
      jefatura: null,
      guardando: false,
      nombre: '',
      descripcion: '',
    });
  }

  function abrirModalEditar(jefatura: Jefatura) {
    setModalForm({
      abierto: true,
      jefatura,
      guardando: false,
      nombre: jefatura.nombre,
      descripcion: jefatura.descripcion ?? '',
    });
  }

  function cerrarModalForm() {
    setModalForm((prev) => ({ ...prev, abierto: false }));
  }

  async function guardarJefatura() {
    if (!modalForm.nombre.trim()) return;

    setModalForm((prev) => ({ ...prev, guardando: true }));
    try {
      if (modalForm.jefatura) {
        await adminService.editarJefatura(modalForm.jefatura.id, {
          nombre: modalForm.nombre,
          descripcion: modalForm.descripcion || undefined,
        });
        mostrar('Jefatura actualizada correctamente', 'success');
      } else {
        await adminService.crearJefatura({
          nombre: modalForm.nombre,
          descripcion: modalForm.descripcion || undefined,
        });
        mostrar('Jefatura creada correctamente', 'success');
      }
      cerrarModalForm();
      cargarJefaturas();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error al guardar';
      mostrar(msg, 'error');
    } finally {
      setModalForm((prev) => ({ ...prev, guardando: false }));
    }
  }

  async function confirmarEliminar() {
    if (!modalEliminar.jefatura) return;

    setModalEliminar((prev) => ({ ...prev, eliminando: true }));
    try {
      await adminService.eliminarJefatura(modalEliminar.jefatura.id);
      mostrar('Jefatura eliminada', 'success');
      setModalEliminar({ abierto: false, jefatura: null, eliminando: false });
      cargarJefaturas();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error al eliminar';
      mostrar(msg, 'error');
    } finally {
      setModalEliminar((prev) => ({ ...prev, eliminando: false }));
    }
  }

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Jefaturas</h1>
          <p className="text-sm text-gray-400">{jefaturas.length} jefatura(s)</p>
        </div>
        {esAdmin && (
          <Button variant="primary" size="sm" onClick={abrirModalCrear}>
            <PlusIcon className="h-4 w-4" /> Nueva jefatura
          </Button>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Descripción</th>
              <th className="px-4 py-3 text-center">Usuarios</th>
              {esAdmin && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 bg-gray-900">
            {cargando ? (
              <tr>
                <td colSpan={esAdmin ? 4 : 3} className="px-4 py-8 text-center text-gray-500">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                </td>
              </tr>
            ) : jefaturas.length === 0 ? (
              <tr>
                <td colSpan={esAdmin ? 4 : 3} className="px-4 py-8 text-center text-gray-500">
                  No hay jefaturas registradas
                </td>
              </tr>
            ) : (
              jefaturas.map((j) => (
                <tr key={j.id} className="hover:bg-gray-800/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-100">
                    <div className="flex items-center gap-2">
                      <BuildingOfficeIcon className="h-4 w-4 text-gray-500" />
                      {j.nombre}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{j.descripcion ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-400">
                    {(j as any)._count?.usuarios ?? '—'}
                  </td>
                  {esAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => abrirModalEditar(j)}>
                          <PencilIcon className="h-4 w-4" /> Editar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setModalEliminar({ abierto: true, jefatura: j, eliminando: false })}
                        >
                          <TrashIcon className="h-4 w-4" /> Eliminar
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal crear/editar */}
      <Modal
        isOpen={modalForm.abierto}
        onClose={cerrarModalForm}
        title={modalForm.jefatura ? 'Editar jefatura' : 'Nueva jefatura'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
            <input
              type="text"
              value={modalForm.nombre}
              onChange={(e) => setModalForm((prev) => ({ ...prev, nombre: e.target.value }))}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Nombre de la jefatura"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Descripción</label>
            <textarea
              value={modalForm.descripcion}
              onChange={(e) => setModalForm((prev) => ({ ...prev, descripcion: e.target.value }))}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Descripción (opcional)"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={cerrarModalForm} disabled={modalForm.guardando}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={guardarJefatura} disabled={modalForm.guardando || !modalForm.nombre.trim()}>
              {modalForm.guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal eliminar */}
      <Modal
        isOpen={modalEliminar.abierto}
        onClose={() => !modalEliminar.eliminando && setModalEliminar({ abierto: false, jefatura: null, eliminando: false })}
        title="Eliminar jefatura"
      >
        <p className="text-sm text-gray-300">
          ¿Estás seguro de que deseas eliminar la jefatura{' '}
          <span className="font-semibold text-gray-100">{modalEliminar.jefatura?.nombre}</span>?
          Esta acción no se puede deshacer.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => setModalEliminar({ abierto: false, jefatura: null, eliminando: false })}
            disabled={modalEliminar.eliminando}
          >
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmarEliminar} disabled={modalEliminar.eliminando}>
            {modalEliminar.eliminando ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}