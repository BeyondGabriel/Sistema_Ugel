import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  CheckIcon,
  XMarkIcon,
  ChatBubbleLeftIcon,
  NoSymbolIcon,
  ExclamationTriangleIcon,
  LockOpenIcon,
} from '@heroicons/react/24/outline';
import { papeletaService } from '../../services/papeleta.service';
import { adminService } from '../../services/admin.service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useSocket } from '../../hooks/useSocket';
import type { CambioPapeleta } from '../../contexts/SocketContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import type { Papeleta, EstadoPapeleta, Usuario } from '../../types';

function formatFechaHora(ts: string): string {
  return new Date(ts).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
function formatFecha(ts: string): string {
  return new Date(ts).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const BADGE_ESTADO: Record<EstadoPapeleta, string> = {
  PENDIENTE: 'badge-info',
  EN_REVISION: 'badge-warning',
  OBSERVADO: 'badge-warning',
  APROBADO: 'badge-success',
  RECHAZADO: 'badge-error',
  CANCELADO: 'badge bg-line-strong text-content-secondary',
  ANULADO: 'badge-error',
  ANULACION_SOLICITADA: 'badge-warning',
};
const ETIQUETA_ESTADO: Record<EstadoPapeleta, string> = {
  PENDIENTE: 'Pendiente',
  EN_REVISION: 'En revisión',
  OBSERVADO: 'Observado',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  CANCELADO: 'Cancelado',
  ANULADO: 'Anulado',
  ANULACION_SOLICITADA: 'Anulación solicitada',
};

function Fila({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 border-b border-line-light last:border-0">
      <span className="w-36 shrink-0 text-xs font-medium text-content-secondary">{label}</span>
      <span className="text-sm text-content-primary">{value}</span>
    </div>
  );
}

export function DetallePapeletaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mostrar } = useToast();
  const { papeletaCambios } = useSocket();

  const [papeleta, setPapeleta] = useState<Papeleta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [accionando, setAccionando] = useState(false);

  // Modales
  const [modalTexto, setModalTexto] = useState<{
    isOpen: boolean;
    tipo: 'rechazo' | 'observacion' | 'anulacion' | null;
  }>({ isOpen: false, tipo: null });
  const [textoModal, setTextoModal] = useState('');
  const [errorTexto, setErrorTexto] = useState('');
  const [modalCancelar, setModalCancelar] = useState(false);

  // Bloque A: desbloqueo de papeletas sin aprobador (solo ADMIN).
  const [modalDesbloqueo, setModalDesbloqueo] = useState(false);
  const [usuariosAprobadores, setUsuariosAprobadores] = useState<Usuario[]>([]);
  const [cargandoAprobadores, setCargandoAprobadores] = useState(false);
  const [aprobadorSeleccionado, setAprobadorSeleccionado] = useState<number | ''>('');
  const [comentarioDesbloqueo, setComentarioDesbloqueo] = useState('');

  async function cargar(silencioso = false) {
    if (!id) return;
    // Los refrescos disparados por socket no muestran el spinner: así el
    // detalle no se desmonta ni parpadea.
    if (!silencioso) setCargando(true);
    try {
      const data = await papeletaService.obtenerPapeleta(Number(id));
      setPapeleta(data);
    } catch {
      mostrar('No se pudo cargar la papeleta', 'error');
      navigate('/papeletas');
    } finally {
      if (!silencioso) setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── refresco en vivo por Socket.IO ─────────────────────
  const ultimoCambio: CambioPapeleta | undefined = papeletaCambios[0];

  // Cambio ya atendido (incluye el que existiera al montar): la carga inicial
  // de arriba ya trae el estado actual.
  const cambioAtendido = useRef(ultimoCambio);

  // Recarga el detalle solo si el último cambio corresponde a esta papeleta,
  // con debounce de 300 ms para agrupar ráfagas de eventos.
  useEffect(() => {
    if (!ultimoCambio || !id) return;
    if (ultimoCambio.papeletaId !== Number(id)) return;
    if (ultimoCambio === cambioAtendido.current) return;

    cambioAtendido.current = ultimoCambio;

    const timer = setTimeout(() => {
      void cargar(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [ultimoCambio, id]); // eslint-disable-line react-hooks/exhaustive-deps

  function extractMsg(err: unknown): string {
    return (
      (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ??
      'Error al procesar'
    );
  }

  async function ejecutarAccion(fn: () => Promise<Papeleta>, mensajeOk: string) {
    setAccionando(true);
    try {
      const actualizada = await fn();
      setPapeleta(actualizada);
      mostrar(mensajeOk, 'success');
      return true;
    } catch (err) {
      mostrar(extractMsg(err), 'error');
      return false;
    } finally {
      setAccionando(false);
    }
  }

  async function confirmarModal() {
    if (!textoModal.trim()) {
      setErrorTexto('Este campo es obligatorio');
      return;
    }
    if (!papeleta) return;
    const tipo = modalTexto.tipo;
    const texto = textoModal.trim();
    setModalTexto({ isOpen: false, tipo: null });
    setTextoModal('');
    if (tipo === 'rechazo')
      await ejecutarAccion(
        () => papeletaService.rechazar(papeleta.id, texto),
        'Papeleta rechazada'
      );
    if (tipo === 'observacion')
      await ejecutarAccion(
        () => papeletaService.observar(papeleta.id, texto),
        'Papeleta observada'
      );
    if (tipo === 'anulacion')
      await ejecutarAccion(
        () => papeletaService.anular(papeleta.id, texto),
        'Papeleta anulada'
      );
  }

  // ─── Bloque A: desbloqueo de papeletas ─────────────────
  async function abrirDesbloqueo() {
    setModalDesbloqueo(true);
    setAprobadorSeleccionado('');
    setComentarioDesbloqueo('');
    if (usuariosAprobadores.length > 0) return;
    setCargandoAprobadores(true);
    try {
      const lista = await adminService.listarUsuarios({ activo: true });
      setUsuariosAprobadores(
        lista.filter(
          (u) =>
            ['ADMIN', 'RRHH', 'DIRECTORA', 'JEFE'].includes(u.rol) &&
            u.id !== papeleta?.solicitanteId
        )
      );
    } catch {
      mostrar('No se pudo cargar la lista de aprobadores', 'error');
    } finally {
      setCargandoAprobadores(false);
    }
  }

  async function confirmarDesbloqueo() {
    if (!papeleta) return;
    if (!aprobadorSeleccionado) {
      mostrar('Selecciona un aprobador', 'error');
      return;
    }
    const ok = await ejecutarAccion(
      () =>
        papeletaService.desbloquear(
          papeleta.id,
          Number(aprobadorSeleccionado),
          comentarioDesbloqueo.trim() || undefined
        ),
      'Papeleta desbloqueada y reasignada'
    );
    if (!ok) return;
    setModalDesbloqueo(false);
    setAprobadorSeleccionado('');
    setComentarioDesbloqueo('');
  }

  if (cargando) {
    return (
      <div className="-mx-6 -my-8 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-surface-bg">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
      </div>
    );
  }

  if (!papeleta) return null;

  const esSolicitante = papeleta.solicitanteId === user?.id;
  const esAdmin = user?.rol === 'ADMIN';
  // Bloque A: solo estos roles pueden aprobar/rechazar/observar (backend 403).
  const puedeAprobarRol = ['ADMIN', 'RRHH', 'DIRECTORA', 'JEFE'].includes(
    user?.rol ?? ''
  );
  const esAprobador = puedeAprobarRol && papeleta.aprobadorId === user?.id;
  const esVigilante = user?.rol === 'VIGILANTE';
  // Papeleta creada sin aprobador resoluble: solo el Admin puede reasignarla.
  const estaBloqueada =
    Boolean(papeleta.requiereAprobadorEspecial) && papeleta.aprobadorId === null;

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] bg-surface-bg px-6 py-8 space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button theme="light" variant="ghost" size="sm" onClick={() => navigate('/papeletas')}>
            <ArrowLeftIcon className="h-4 w-4" /> Volver
          </Button>
          <div>
            <h1 className="text-xl font-bold text-content-primary">Papeleta N° {papeleta.numero}</h1>
            <span className={`inline-block ${BADGE_ESTADO[papeleta.estado]}`}>
              {ETIQUETA_ESTADO[papeleta.estado]}
            </span>
          </div>
        </div>
        <Button
          theme="light"
          variant="ghost"
          size="sm"
          onClick={() => papeletaService.abrirPDF(papeleta.id)}
        >
          <DocumentTextIcon className="h-4 w-4" /> Ver PDF
        </Button>
      </div>

      {/* Datos principales */}
      <Card theme="light">
        <Fila
          label="Solicitante"
          value={
            papeleta.solicitante
              ? `${papeleta.solicitante.nombres} ${papeleta.solicitante.apellidos}`
              : `#${papeleta.solicitanteId}`
          }
        />
        <Fila
          label="Aprobador"
          value={
            papeleta.aprobador
              ? `${papeleta.aprobador.nombres} ${papeleta.aprobador.apellidos}`
              : '—'
          }
        />
        <Fila
          label="Tipo de permiso"
          value={papeleta.tipoTiempo === 'DIAS' ? 'Por día(s)' : 'Por horas'}
        />
        {papeleta.tipoTiempo === 'DIAS' ? (
          <>
            <Fila label="Fecha inicio" value={formatFecha(papeleta.fechaInicio)} />
            <Fila label="Fecha fin" value={formatFecha(papeleta.fechaFin)} />
          </>
        ) : (
          <>
            <Fila label="Fecha" value={formatFecha(papeleta.fechaInicio)} />
            <Fila
              label="Hora salida"
              value={
                papeleta.horaSalida
                  ? formatFechaHora(papeleta.horaSalida).split(', ')[1]
                  : '—'
              }
            />
            <Fila
              label="Hora retorno"
              value={
                papeleta.horaRetorno
                  ? formatFechaHora(papeleta.horaRetorno).split(', ')[1]
                  : '—'
              }
            />
          </>
        )}
        <Fila
          label="Motivo"
          value={
            papeleta.motivoOtros
              ? `${papeleta.motivo}: ${papeleta.motivoOtros}`
              : papeleta.motivo
          }
        />
        <Fila label="Creada el" value={formatFechaHora(papeleta.fechaCreacion)} />
        {papeleta.token && (
          <Fila
            label="Token de verificación"
            value={
              <span className="font-mono font-bold tracking-widest text-brand-blue">
                {papeleta.token}
              </span>
            }
          />
        )}
        {papeleta.motivoRechazo && (
          <Fila
            label="Observación / Rechazo"
            value={<span className="text-state-warning-fg">{papeleta.motivoRechazo}</span>}
          />
        )}
        {papeleta.motivoAnulacion && (
          <Fila
            label="Motivo de anulación"
            value={<span className="text-state-error-fg">{papeleta.motivoAnulacion}</span>}
          />
        )}
        {papeleta.fechaAnulacion && (
          <Fila label="Anulada el" value={formatFechaHora(papeleta.fechaAnulacion)} />
        )}
        {papeleta.firmaExternaSvg && (
          <Fila
            label="Firma externa"
            value={
              <a
                href={papeleta.firmaExternaSvg}
                target="_blank"
                rel="noreferrer"
                className="text-brand-blue underline text-xs"
              >
                Ver firma
              </a>
            }
          />
        )}
      </Card>

      {/* Bloque A: papeleta bloqueada sin aprobador */}
      {estaBloqueada && (
        <div className="rounded-ds-lg border border-state-warning-fg/20 bg-state-warning-bg p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-state-warning-fg" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-state-warning-fg">
                Papeleta bloqueada: sin aprobador asignado
              </p>
              <p className="mt-1 text-sm text-content-secondary">
                {esAdmin
                  ? 'La jerarquía no permitió resolver un aprobador disponible (titular no disponible o sin delegación vigente). Asígnale un aprobador para que pueda continuar.'
                  : 'La jerarquía no permitió resolver un aprobador disponible. El Administrador debe reasignar esta papeleta antes de que pueda aprobarse.'}
              </p>
              {esAdmin && (
                <Button
                  theme="light"
                  variant="primary"
                  size="sm"
                  className="mt-3"
                  disabled={accionando}
                  onClick={() => void abrirDesbloqueo()}
                >
                  <LockOpenIcon className="h-4 w-4" /> Desbloquear y asignar aprobador
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bloque A: aviso de solo lectura para Vigilante */}
      {esVigilante && !esSolicitante && (
        <p className="rounded-ds-lg border border-line-light bg-surface-card px-4 py-2 text-xs text-content-secondary">
          Perfil Vigilante: esta papeleta es de solo lectura.
        </p>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap gap-3">
        {/* Solicitante */}
        {esSolicitante &&
          (papeleta.estado === 'PENDIENTE' || papeleta.estado === 'OBSERVADO') && (
            <Button
              theme="light"
              variant="danger"
              disabled={accionando}
              onClick={() => setModalCancelar(true)}
            >
              <XMarkIcon className="h-4 w-4" /> Cancelar papeleta
            </Button>
          )}
        {esSolicitante && papeleta.estado === 'OBSERVADO' && (
          <Link to={`/papeletas/${papeleta.id}/reenviar`}>
            <Button theme="light" variant="secondary">Editar y reenviar</Button>
          </Link>
        )}
        {esSolicitante && papeleta.estado === 'APROBADO' && (
          <Button
            theme="light"
            variant="secondary"
            disabled={accionando}
            onClick={() =>
              ejecutarAccion(
                () => papeletaService.solicitarAnulacion(papeleta.id),
                'Solicitud de anulación enviada'
              )
            }
          >
            <NoSymbolIcon className="h-4 w-4" /> Solicitar anulación
          </Button>
        )}
        {esSolicitante && papeleta.estado === 'ANULACION_SOLICITADA' && (
          <Button
            theme="light"
            variant="ghost"
            disabled={accionando}
            onClick={() =>
              ejecutarAccion(
                () => papeletaService.cancelarSolicitudAnulacion(papeleta.id),
                'Solicitud cancelada'
              )
            }
          >
            Cancelar solicitud de anulación
          </Button>
        )}

        {/* Aprobador / Admin */}
        {(esAprobador || esAdmin) && papeleta.estado === 'PENDIENTE' && (
          <Button
            theme="light"
            variant="secondary"
            disabled={accionando}
            onClick={() =>
              ejecutarAccion(
                () => papeletaService.iniciarRevision(papeleta.id),
                'Revisión iniciada'
              )
            }
          >
            Iniciar revisión
          </Button>
        )}
        {(esAprobador || esAdmin) && papeleta.estado === 'EN_REVISION' && (
          <>
            <Button
              theme="light"
              variant="primary"
              disabled={accionando}
              onClick={() =>
                ejecutarAccion(
                  () => papeletaService.aprobar(papeleta.id),
                  'Papeleta aprobada'
                )
              }
            >
              <CheckIcon className="h-4 w-4" /> Aprobar
            </Button>
            <Button
              theme="light"
              variant="secondary"
              onClick={() =>
                setModalTexto({ isOpen: true, tipo: 'observacion' })
              }
            >
              <ChatBubbleLeftIcon className="h-4 w-4" /> Observar
            </Button>
            <Button
              theme="light"
              variant="danger"
              onClick={() => setModalTexto({ isOpen: true, tipo: 'rechazo' })}
            >
              <XMarkIcon className="h-4 w-4" /> Rechazar
            </Button>
          </>
        )}
        {(esAprobador || esAdmin) &&
          (papeleta.estado === 'APROBADO' ||
            papeleta.estado === 'ANULACION_SOLICITADA') && (
            <Button
              theme="light"
              variant="danger"
              onClick={() => setModalTexto({ isOpen: true, tipo: 'anulacion' })}
            >
              <NoSymbolIcon className="h-4 w-4" /> Anular
            </Button>
          )}
      </div>

      {/* Modal de texto (rechazar / observar / anular) */}
      <Modal
        isOpen={modalTexto.isOpen}
        onClose={() => {
          if (!accionando) {
            setModalTexto({ isOpen: false, tipo: null });
            setTextoModal('');
            setErrorTexto('');
          }
        }}
        title={
          modalTexto.tipo === 'rechazo'
            ? 'Motivo de rechazo'
            : modalTexto.tipo === 'observacion'
            ? 'Comentario de observación'
            : 'Motivo de anulación'
        }
      >
        <div className="space-y-3">
          <textarea
            value={textoModal}
            onChange={(e) => {
              setTextoModal(e.target.value);
              setErrorTexto('');
            }}
            placeholder="Escribe el motivo…"
            rows={4}
            className="input-field"
          />
          {errorTexto && <p className="text-xs text-state-error-fg">{errorTexto}</p>}
          <div className="flex justify-end gap-3">
            <Button
              theme="light"
              variant="ghost"
              onClick={() => {
                setModalTexto({ isOpen: false, tipo: null });
                setTextoModal('');
                setErrorTexto('');
              }}
              disabled={accionando}
            >
              Cancelar
            </Button>
            <Button theme="light" variant="primary" onClick={confirmarModal} disabled={accionando}>
              {accionando ? 'Procesando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bloque A: modal de desbloqueo (ADMIN) */}
      <Modal
        isOpen={modalDesbloqueo}
        onClose={() => {
          if (!accionando) setModalDesbloqueo(false);
        }}
        title="Desbloquear papeleta"
      >
        <div className="space-y-3">
          <p className="text-sm text-content-secondary">
            Asigna un aprobador disponible para la papeleta N° {papeleta.numero}.
            Quedará en estado <strong>Pendiente</strong> y se notificará al solicitante.
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-content-primary">Aprobador</label>
            <select
              value={aprobadorSeleccionado}
              onChange={(e) =>
                setAprobadorSeleccionado(
                  e.target.value ? Number(e.target.value) : ''
                )
              }
              disabled={cargandoAprobadores}
              className="input-field"
            >
              <option value="">
                {cargandoAprobadores ? 'Cargando…' : 'Selecciona un aprobador'}
              </option>
              {usuariosAprobadores.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.tituloFormal
                    ? `${u.tituloFormal} — ${u.nombres} ${u.apellidos}`
                    : `${u.nombres} ${u.apellidos} (${u.rol})`}
                  {u.noDisponible ? ' · no disponible' : ''}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={comentarioDesbloqueo}
            onChange={(e) => setComentarioDesbloqueo(e.target.value)}
            placeholder="Comentario para la trazabilidad (opcional)"
            rows={3}
            className="input-field"
          />
          <div className="flex justify-end gap-3">
            <Button
              theme="light"
              variant="ghost"
              disabled={accionando}
              onClick={() => setModalDesbloqueo(false)}
            >
              Cancelar
            </Button>
            <Button
              theme="light"
              variant="primary"
              disabled={accionando || !aprobadorSeleccionado}
              onClick={() => void confirmarDesbloqueo()}
            >
              {accionando ? 'Procesando…' : 'Desbloquear'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal cancelar */}
      <Modal
        isOpen={modalCancelar}
        onClose={() => setModalCancelar(false)}
        title="Cancelar papeleta"
      >
        <p className="text-sm text-content-secondary">
          ¿Estás seguro de cancelar esta papeleta? No se puede deshacer.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <Button theme="light" variant="ghost" onClick={() => setModalCancelar(false)}>
            No
          </Button>
          <Button
            theme="light"
            variant="danger"
            disabled={accionando}
            onClick={() => {
              setModalCancelar(false);
              ejecutarAccion(
                () => papeletaService.cancelar(papeleta.id),
                'Papeleta cancelada'
              );
            }}
          >
            {accionando ? 'Cancelando...' : 'Sí, cancelar'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}