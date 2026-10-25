// ===========================================================
// Gestión de delegaciones de aprobación (Bloque A)
// Solo el rol ADMIN accede a esta pantalla.
// ===========================================================

import { useEffect, useMemo, useState } from 'react';
import {
  PlusIcon,
  NoSymbolIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import { delegacionService } from '../../services/delegacion.service';
import { adminService } from '../../services/admin.service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import type { Delegacion, Rol, Usuario } from '../../types';

/** Roles habilitados como titular (los que aprueban papeletas por jerarquía). */
const ROLES_TITULAR: Rol[] = ['JEFE', 'DIRECTORA'];

/**
 * Encargados elegibles según el titular (misma regla que valida el backend):
 * un JEFE delega en un ESPECIALISTA de su área y la DIRECTORA en un JEFE.
 */
function esEncargadoElegible(
  titular: Usuario | undefined,
  encargado: Usuario
): boolean {
  if (!titular) return false;

  if (titular.rol === 'JEFE') {
    return (
      encargado.rol === 'ESPECIALISTA' &&
      encargado.jefaturaId != null &&
      encargado.jefaturaId === titular.jefaturaId
    );
  }

  return encargado.rol === 'JEFE';
}

const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  RRHH: 'RRHH',
  DIRECTORA: 'Directora',
  JEFE: 'Jefe',
  ESPECIALISTA: 'Especialista',
  VIGILANTE: 'Vigilante',
};

/** Convierte una fecha a valor aceptado por <input type="datetime-local">. */
function aInputLocal(fecha: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}` +
    `T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`
  );
}

function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Estado visible de la delegación (el backend solo expone `vigente`). */
function estadoDe(delegacion: Delegacion): {
  etiqueta: string;
  clase: string;
} {
  if (!delegacion.activo) {
    return { etiqueta: 'Anulada', clase: 'badge-error' };
  }
  if (delegacion.vigente) {
    return { etiqueta: 'Vigente', clase: 'badge-success' };
  }
  if (new Date(delegacion.fechaInicio).getTime() > Date.now()) {
    return { etiqueta: 'Programada', clase: 'badge-info' };
  }
  return { etiqueta: 'Vencida', clase: 'badge-warning' };
}

function nombreCompleto(usuario?: Delegacion['titular']): string {
  if (!usuario) return '—';
  return `${usuario.nombres} ${usuario.apellidos}`;
}

export function DelegacionesPage() {
  const { user } = useAuth();
  const { mostrar } = useToast();
  const esAdmin = user?.rol === 'ADMIN';

  const [delegaciones, setDelegaciones] = useState<Delegacion[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [soloVigentes, setSoloVigentes] = useState(false);

  // Modal crear
  const [modalCrear, setModalCrear] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [titularId, setTitularId] = useState<number | ''>('');
  const [encargadoId, setEncargadoId] = useState<number | ''>('');
  const [fechaInicio, setFechaInicio] = useState(aInputLocal(new Date()));
  const [fechaFin, setFechaFin] = useState(
    aInputLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  );
  const [motivo, setMotivo] = useState('');
  const [documentoRef, setDocumentoRef] = useState('');

  // Modal anular
  const [modalAnular, setModalAnular] = useState<{
    abierto: boolean;
    delegacion: Delegacion | null;
    anulando: boolean;
    motivo: string;
  }>({ abierto: false, delegacion: null, anulando: false, motivo: '' });

  async function cargar() {
    if (!esAdmin) {
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      const [lista, listaUsuarios] = await Promise.all([
        delegacionService.listar(),
        adminService.listarUsuarios({ activo: true }),
      ]);
      setDelegaciones(lista);
      setUsuarios(listaUsuarios);
    } catch {
      mostrar('No se pudieron cargar las delegaciones', 'error');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esAdmin]);

  const titulares = useMemo(
    () => usuarios.filter((u) => ROLES_TITULAR.includes(u.rol)),
    [usuarios]
  );

  const titularSeleccionado = useMemo(
    () => usuarios.find((u) => u.id === titularId),
    [usuarios, titularId]
  );

  const encargados = useMemo(
    () =>
      usuarios.filter(
        (u) =>
          u.id !== titularId &&
          !u.noDisponible &&
          esEncargadoElegible(titularSeleccionado, u)
      ),
    [usuarios, titularId, titularSeleccionado]
  );

  const visibles = useMemo(
    () => (soloVigentes ? delegaciones.filter((d) => d.vigente) : delegaciones),
    [delegaciones, soloVigentes]
  );

  function abrirCrear() {
    setTitularId('');
    setEncargadoId('');
    setFechaInicio(aInputLocal(new Date()));
    setFechaFin(aInputLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
    setMotivo('');
    setDocumentoRef('');
    setModalCrear(true);
  }

  async function crear() {
    if (!titularId || !encargadoId) {
      mostrar('Selecciona titular y encargado', 'error');
      return;
    }
    if (new Date(fechaFin) <= new Date(fechaInicio)) {
      mostrar('La fecha de fin debe ser posterior a la de inicio', 'error');
      return;
    }

    setGuardando(true);
    try {
      await delegacionService.crear({
        titularId: Number(titularId),
        encargadoId: Number(encargadoId),
        fechaInicio: new Date(fechaInicio).toISOString(),
        fechaFin: new Date(fechaFin).toISOString(),
        motivo: motivo.trim() || undefined,
        documentoRef: documentoRef.trim() || undefined,
      });
      mostrar('Delegación registrada correctamente', 'success');
      setModalCrear(false);
      await cargar();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { mensaje?: string } } })?.response?.data
          ?.mensaje ?? 'Error al registrar la delegación';
      mostrar(msg, 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarAnular() {
    if (!modalAnular.delegacion) return;
    setModalAnular((prev) => ({ ...prev, anulando: true }));
    try {
      await delegacionService.anular(
        modalAnular.delegacion.id,
        modalAnular.motivo.trim() || undefined
      );
      mostrar('Delegación anulada', 'success');
      setModalAnular({ abierto: false, delegacion: null, anulando: false, motivo: '' });
      await cargar();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { mensaje?: string } } })?.response?.data
          ?.mensaje ?? 'Error al anular la delegación';
      mostrar(msg, 'error');
      setModalAnular((prev) => ({ ...prev, anulando: false }));
    }
  }

  if (!esAdmin) {
    return (
      <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] bg-surface-bg px-6 py-8">
        <div className="rounded-ds-lg border border-line-light bg-surface-card p-6 text-sm text-content-secondary shadow-card">
          No tienes permiso para gestionar delegaciones de aprobación.
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] space-y-5 bg-surface-bg px-6 py-8 text-content-primary">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-content-primary">Delegaciones de aprobación</h1>
          <p className="text-sm text-content-secondary">
            Mientras una delegación está vigente, las papeletas del titular se asignan al
            encargado.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-content-secondary">
            <input
              type="checkbox"
              checked={soloVigentes}
              onChange={(e) => setSoloVigentes(e.target.checked)}
              className="h-4 w-4 rounded border-line-strong bg-surface-card text-brand-blue focus:ring-brand-blue"
            />
            Solo vigentes
          </label>
          <Button variant="primary" size="sm" theme="light" onClick={abrirCrear}>
            <PlusIcon className="h-4 w-4" /> Nueva delegación
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-ds-lg border border-line-light shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-bg text-xs font-semibold uppercase tracking-wide text-content-secondary">
            <tr>
              <th className="px-4 py-3 text-left">Titular</th>
              <th className="px-4 py-3 text-left">Encargado</th>
              <th className="px-4 py-3 text-left">Desde</th>
              <th className="px-4 py-3 text-left">Hasta</th>
              <th className="px-4 py-3 text-left">Motivo</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-light bg-surface-card">
            {cargando ? (
              <tr>
                <td colSpan={7} className="py-10 text-center">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
                </td>
              </tr>
            ) : visibles.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-content-tertiary">
                  No hay delegaciones registradas.
                </td>
              </tr>
            ) : (
              visibles.map((d) => {
                const estado = estadoDe(d);
                return (
                  <tr key={d.id} className="hover:bg-surface-bg transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-content-primary">
                        <ArrowsRightLeftIcon className="h-4 w-4 shrink-0 text-content-tertiary" />
                        <div>
                          <p>{nombreCompleto(d.titular)}</p>
                          <p className="text-xs text-content-tertiary">
                            {d.titular ? ETIQUETA_ROL[d.titular.rol] : '—'}
                            {d.titular?.noDisponible ? ' · P1C' : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-content-primary">{nombreCompleto(d.encargado)}</p>
                      <p className="text-xs text-content-tertiary">
                        {d.encargado ? ETIQUETA_ROL[d.encargado.rol] : '—'}
                        {d.encargado?.noDisponible ? ' · P1C' : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-content-secondary">
                      {formatearFechaHora(d.fechaInicio)}
                    </td>
                    <td className="px-4 py-3 text-content-secondary">
                      {formatearFechaHora(d.fechaFin)}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-content-secondary">
                      <span className="line-clamp-2">{d.motivo || '—'}</span>
                      {d.documentoRef && (
                        <span className="mt-0.5 block text-xs text-content-tertiary">
                          Ref. {d.documentoRef}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={estado.clase}>
                        {estado.etiqueta}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {d.activo && (
                        <Button
                          variant="danger"
                          size="sm"
                          theme="light"
                          onClick={() =>
                            setModalAnular({
                              abierto: true,
                              delegacion: d,
                              anulando: false,
                              motivo: '',
                            })
                          }
                        >
                          <NoSymbolIcon className="h-4 w-4" /> Anular
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal crear */}
      <Modal
        isOpen={modalCrear}
        onClose={() => !guardando && setModalCrear(false)}
        title="Nueva delegación"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-content-primary">
              Titular (delega su facultad)
            </label>
            <select
              value={titularId}
              onChange={(e) => {
                setTitularId(e.target.value ? Number(e.target.value) : '');
                setEncargadoId('');
              }}
              className="input-field"
            >
              <option value="">Selecciona un titular</option>
              {titulares.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.tituloFormal
                    ? `${u.tituloFormal} — ${u.nombres} ${u.apellidos}`
                    : `${u.nombres} ${u.apellidos} (${ETIQUETA_ROL[u.rol]})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-content-primary">
              Encargado (asume la aprobación)
            </label>
            <select
              value={encargadoId}
              onChange={(e) =>
                setEncargadoId(e.target.value ? Number(e.target.value) : '')
              }
              disabled={!titularId}
              className="input-field"
            >
              <option value="">
                {titularId ? 'Selecciona un encargado' : 'Primero elige al titular'}
              </option>
              {encargados.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.tituloFormal
                    ? `${u.tituloFormal} — ${u.nombres} ${u.apellidos}`
                    : `${u.nombres} ${u.apellidos} (${ETIQUETA_ROL[u.rol]})`}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-content-secondary">
              Solo se listan usuarios activos y elegibles según la jerarquía: un jefe de área
              delega en un especialista de su misma área y la Directora en un jefe de área.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-content-primary">
                Fecha de inicio
              </label>
              <input
                type="datetime-local"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-content-primary">
                Fecha de fin
              </label>
              <input
                type="datetime-local"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-content-primary">
              Documento de referencia (opcional)
            </label>
            <input
              type="text"
              value={documentoRef}
              onChange={(e) => setDocumentoRef(e.target.value)}
              maxLength={200}
              placeholder="Ej. Resolución Directoral N° 123-2026"
              className="input-field"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-content-primary">
              Motivo (opcional)
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Ej. Descanso médico del titular"
              className="input-field"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" theme="light" onClick={() => setModalCrear(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              theme="light"
              onClick={crear}
              disabled={guardando || !titularId || !encargadoId}
            >
              {guardando ? 'Guardando…' : 'Registrar delegación'}
            </Button>
          </div>
        </div>
      </Modal>


      {/* Modal anular */}
      <Modal
        isOpen={modalAnular.abierto}
        onClose={() =>
          !modalAnular.anulando &&
          setModalAnular({ abierto: false, delegacion: null, anulando: false, motivo: '' })
        }
        title="Anular delegación"
      >
        <p className="text-sm text-content-secondary">
          Se revocará la delegación de{' '}
          <span className="font-semibold text-content-primary">
            {nombreCompleto(modalAnular.delegacion?.titular)}
          </span>{' '}
          a{' '}
          <span className="font-semibold text-content-primary">
            {nombreCompleto(modalAnular.delegacion?.encargado)}
          </span>
          . El registro se conserva para trazabilidad.
        </p>
        <textarea
          value={modalAnular.motivo}
          onChange={(e) =>
            setModalAnular((prev) => ({ ...prev, motivo: e.target.value }))
          }
          rows={3}
          maxLength={500}
          placeholder="Motivo de la anulación (opcional)"
          className="input-field mt-3"
        />
        <div className="mt-4 flex justify-end gap-3">
          <Button
            variant="ghost"
            theme="light"
            disabled={modalAnular.anulando}
            onClick={() =>
              setModalAnular({
                abierto: false,
                delegacion: null,
                anulando: false,
                motivo: '',
              })
            }
          >
            Cancelar
          </Button>
          <Button variant="danger" theme="light" onClick={confirmarAnular} disabled={modalAnular.anulando}>
            {modalAnular.anulando ? 'Anulando…' : 'Anular delegación'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

