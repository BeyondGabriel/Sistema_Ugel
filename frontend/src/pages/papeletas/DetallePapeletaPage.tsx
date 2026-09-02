import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  CheckIcon,
  XMarkIcon,
  ChatBubbleLeftIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';
import { papeletaService } from '../../services/papeleta.service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import type { Papeleta, EstadoPapeleta } from '../../types';

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
  PENDIENTE: 'bg-blue-900/50 text-blue-300',
  EN_REVISION: 'bg-amber-900/50 text-amber-300',
  OBSERVADO: 'bg-orange-900/50 text-orange-300',
  APROBADO: 'bg-emerald-900/50 text-emerald-300',
  RECHAZADO: 'bg-red-900/50 text-red-300',
  CANCELADO: 'bg-gray-700 text-gray-400',
  ANULADO: 'bg-orange-900/50 text-orange-300',
  ANULACION_SOLICITADA: 'bg-amber-900/50 text-amber-300',
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
    <div className="flex gap-4 py-2 border-b border-gray-700 last:border-0">
      <span className="w-36 shrink-0 text-xs font-medium text-gray-500">{label}</span>
      <span className="text-sm text-gray-200">{value}</span>
    </div>
  );
}

export function DetallePapeletaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mostrar } = useToast();

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

  async function cargar() {
    if (!id) return;
    setCargando(true);
    try {
      const data = await papeletaService.obtenerPapeleta(Number(id));
      setPapeleta(data);
    } catch {
      mostrar('No se pudo cargar la papeleta', 'error');
      navigate('/papeletas');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    } catch (err) {
      mostrar(extractMsg(err), 'error');
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

  if (cargando) {
    return (
      <div className="flex justify-center py-20">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!papeleta) return null;

  const esSolicitante = papeleta.solicitanteId === user?.id;
  const esAprobador = papeleta.aprobadorId === user?.id;
  const esAdmin = user?.rol === 'ADMIN';

  return (
    <div className="max-w-2xl space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/papeletas')}>
            <ArrowLeftIcon className="h-4 w-4" /> Volver
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-100">Papeleta N° {papeleta.numero}</h1>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_ESTADO[papeleta.estado]}`}
            >
              {ETIQUETA_ESTADO[papeleta.estado]}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => papeletaService.abrirPDF(papeleta.id)}
        >
          <DocumentTextIcon className="h-4 w-4" /> Ver PDF
        </Button>
      </div>

      {/* Datos principales */}
      <Card>
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
              <span className="font-mono font-bold tracking-widest text-emerald-400">
                {papeleta.token}
              </span>
            }
          />
        )}
        {papeleta.motivoRechazo && (
          <Fila
            label="Observación / Rechazo"
            value={<span className="text-orange-400">{papeleta.motivoRechazo}</span>}
          />
        )}
        {papeleta.motivoAnulacion && (
          <Fila
            label="Motivo de anulación"
            value={<span className="text-red-400">{papeleta.motivoAnulacion}</span>}
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
                className="text-blue-400 underline text-xs"
              >
                Ver firma
              </a>
            }
          />
        )}
      </Card>

      {/* Acciones */}
      <div className="flex flex-wrap gap-3">
        {/* Solicitante */}
        {esSolicitante &&
          (papeleta.estado === 'PENDIENTE' || papeleta.estado === 'OBSERVADO') && (
            <Button
              variant="danger"
              disabled={accionando}
              onClick={() => setModalCancelar(true)}
            >
              <XMarkIcon className="h-4 w-4" /> Cancelar papeleta
            </Button>
          )}
        {esSolicitante && papeleta.estado === 'OBSERVADO' && (
          <Link to={`/papeletas/${papeleta.id}/reenviar`}>
            <Button variant="secondary">Editar y reenviar</Button>
          </Link>
        )}
        {esSolicitante && papeleta.estado === 'APROBADO' && (
          <Button
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
              variant="secondary"
              onClick={() =>
                setModalTexto({ isOpen: true, tipo: 'observacion' })
              }
            >
              <ChatBubbleLeftIcon className="h-4 w-4" /> Observar
            </Button>
            <Button
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
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {errorTexto && <p className="text-xs text-red-400">{errorTexto}</p>}
          <div className="flex justify-end gap-3">
            <Button
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
            <Button variant="primary" onClick={confirmarModal} disabled={accionando}>
              {accionando ? 'Procesando...' : 'Confirmar'}
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
        <p className="text-sm text-gray-300">
          ¿Estás seguro de cancelar esta papeleta? No se puede deshacer.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setModalCancelar(false)}>
            No
          </Button>
          <Button
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