import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusIcon,
  DocumentTextIcon,
  CheckIcon,
  XMarkIcon,
  ChatBubbleLeftIcon,
  ArrowPathIcon,
  NoSymbolIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { papeletaService } from '../../services/papeleta.service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import type { Papeleta, EstadoPapeleta } from '../../types';

// ─── helpers ────────────────────────────────────────────

function formatFecha(ts: string): string {
  return new Date(ts).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatHora(ts: string): string {
  return new Date(ts).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const TABS: { label: string; estados: EstadoPapeleta[] }[] = [
  { label: 'Pendientes', estados: ['PENDIENTE', 'EN_REVISION', 'OBSERVADO'] },
  { label: 'Aprobadas', estados: ['APROBADO'] },
  { label: 'Rechazadas', estados: ['RECHAZADO'] },
  { label: 'Canceladas', estados: ['CANCELADO'] },
  { label: 'Anuladas', estados: ['ANULADO', 'ANULACION_SOLICITADA'] },
];

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

function extractMsg(err: unknown): string {
  return (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error al procesar';
}

// ─── modal con textarea ─────────────────────────────────
interface ModalTextoProps {
  isOpen: boolean;
  title: string;
  placeholder: string;
  onConfirmar: (texto: string) => void;
  onClose: () => void;
  cargando: boolean;
}

function ModalTexto({ isOpen, title, placeholder, onConfirmar, onClose, cargando }: ModalTextoProps) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');

  function confirmar() {
    if (!texto.trim()) { setError('Este campo es obligatorio'); return; }
    onConfirmar(texto.trim());
  }

  return (
    <Modal isOpen={isOpen} onClose={() => { if (!cargando) { setTexto(''); setError(''); onClose(); } }} title={title}>
      <div className="space-y-3">
        <textarea
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setError(''); }}
          placeholder={placeholder}
          rows={4}
          className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={cargando}>Cancelar</Button>
          <Button variant="primary" onClick={confirmar} disabled={cargando}>
            {cargando ? 'Procesando...' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── componente principal ────────────────────────────────
export function PapeletasPage() {
  const { user } = useAuth();
  const { mostrar } = useToast();

  const [papeletas, setPapeletas] = useState<Papeleta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tabActiva, setTabActiva] = useState(0);
  const [exportando, setExportando] = useState(false);

  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const [accionId, setAccionId] = useState<number | null>(null);

  const [modalRechazo, setModalRechazo] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
  const [modalObservacion, setModalObservacion] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
  const [modalAnulacion, setModalAnulacion] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
  const [modalCancelar, setModalCancelar] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await papeletaService.listarPapeletas({
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined,
      });
      setPapeletas(data);
    } catch {
      mostrar('Error al cargar las papeletas', 'error');
    } finally {
      setCargando(false);
    }
  }, [fechaInicio, fechaFin, mostrar]);

  useEffect(() => { cargar(); }, [cargar]);

  async function accion(id: number, fn: () => Promise<Papeleta>, mensajeOk: string) {
    setAccionId(id);
    try {
      await fn();
      mostrar(mensajeOk, 'success');
      await cargar();
    } catch (err) {
      mostrar(extractMsg(err), 'error');
    } finally {
      setAccionId(null);
    }
  }

  async function exportar() {
    setExportando(true);
    mostrar('Preparando descarga…', 'info');
    try {
      await papeletaService.exportarPapeletas({
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined,
      });
      mostrar('Archivo descargado', 'success');
    } catch {
      mostrar('Error al exportar', 'error');
    } finally {
      setExportando(false);
    }
  }

  const tabsConConteos = TABS.map((tab) => ({
    ...tab,
    count: papeletas.filter((p) => tab.estados.includes(p.estado)).length,
  }));

  const papeletasDeTab = papeletas.filter((p) => TABS[tabActiva].estados.includes(p.estado));

  const INPUT_CLS = 'rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-100">Papeletas</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={exportando} onClick={exportar}>
            <ArrowDownTrayIcon className="h-4 w-4" /> Exportar Excel
          </Button>
          <Link to="/papeletas/nueva">
            <Button variant="primary" size="sm">
              <PlusIcon className="h-4 w-4" /> Nueva papeleta
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtros de fecha */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-700 bg-gray-800 p-4">
        <FunnelIcon className="h-4 w-4 mt-1.5 text-gray-500 shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Desde</span>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={INPUT_CLS} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Hasta</span>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className={INPUT_CLS} />
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-700 bg-gray-800/50 p-1">
        {tabsConConteos.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setTabActiva(i)}
            className={[
              'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              tabActiva === i
                ? 'bg-gray-700 text-gray-100'
                : 'text-gray-400 hover:text-gray-200',
            ].join(' ')}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${tabActiva === i ? 'bg-emerald-600/40 text-emerald-300' : 'bg-gray-600 text-gray-300'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="flex justify-center py-10">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : papeletasDeTab.length === 0 ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800 py-10 text-center text-gray-500 text-sm">
          No hay papeletas en esta categoría
        </div>
      ) : (
        <div className="space-y-3">
          {papeletasDeTab.map((p) => {
            const esSolicitante = p.solicitanteId === user?.id;
            const esAprobador = p.aprobadorId === user?.id;
            const esAdmin = user?.rol === 'ADMIN';
            const enAccion = accionId === p.id;

            return (
              <div key={p.id} className="rounded-xl border border-gray-700 bg-gray-800 p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-100">N° {p.numero}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_ESTADO[p.estado]}`}>
                        {ETIQUETA_ESTADO[p.estado]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {p.solicitante
                        ? `${p.solicitante.nombres} ${p.solicitante.apellidos}`
                        : `Usuario #${p.solicitanteId}`}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {p.tipoTiempo === 'DIAS'
                        ? `${formatFecha(p.fechaInicio)} al ${formatFecha(p.fechaFin)}`
                        : `${formatFecha(p.fechaInicio)} · ${formatHora(p.horaSalida ?? p.fechaInicio)} → ${formatHora(p.horaRetorno ?? p.fechaFin)}`
                      }
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 truncate">
                      {p.motivo}{p.motivoOtros ? `: ${p.motivoOtros}` : ''}
                    </p>
                    {p.motivoRechazo && (
                      <p className="mt-1 text-xs text-orange-400">
                        Observación/Rechazo: {p.motivoRechazo}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Link to={`/papeletas/${p.id}`}>
                      <Button variant="ghost" size="sm">
                        <EyeIcon className="h-4 w-4" /> Ver
                      </Button>
                    </Link>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => papeletaService.abrirPDF(p.id)}
                    >
                      <DocumentTextIcon className="h-4 w-4" /> PDF
                    </Button>

                    {esSolicitante && (p.estado === 'PENDIENTE' || p.estado === 'OBSERVADO') && (
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={enAccion}
                        onClick={() => setModalCancelar({ isOpen: true, id: p.id })}
                      >
                        <XMarkIcon className="h-4 w-4" /> Cancelar
                      </Button>
                    )}

                    {esSolicitante && p.estado === 'APROBADO' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={enAccion}
                        onClick={() => accion(p.id, () => papeletaService.solicitarAnulacion(p.id), 'Solicitud de anulación enviada')}
                      >
                        <NoSymbolIcon className="h-4 w-4" /> Solicitar anulación
                      </Button>
                    )}

                    {esSolicitante && p.estado === 'ANULACION_SOLICITADA' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={enAccion}
                        onClick={() => accion(p.id, () => papeletaService.cancelarSolicitudAnulacion(p.id), 'Solicitud de anulación cancelada')}
                      >
                        <ArrowPathIcon className="h-4 w-4" /> Cancelar solicitud
                      </Button>
                    )}

                    {(esAprobador || esAdmin) && p.estado === 'PENDIENTE' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={enAccion}
                        onClick={() => accion(p.id, () => papeletaService.iniciarRevision(p.id), 'Revisión iniciada')}
                      >
                        Revisar
                      </Button>
                    )}

                    {(esAprobador || esAdmin) && p.estado === 'EN_REVISION' && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={enAccion}
                          onClick={() => accion(p.id, () => papeletaService.aprobar(p.id), 'Papeleta aprobada')}
                        >
                          <CheckIcon className="h-4 w-4" /> Aprobar
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setModalObservacion({ isOpen: true, id: p.id })}
                        >
                          <ChatBubbleLeftIcon className="h-4 w-4" /> Observar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setModalRechazo({ isOpen: true, id: p.id })}
                        >
                          <XMarkIcon className="h-4 w-4" /> Rechazar
                        </Button>
                      </>
                    )}

                    {(esAprobador || esAdmin) && (p.estado === 'APROBADO' || p.estado === 'ANULACION_SOLICITADA') && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setModalAnulacion({ isOpen: true, id: p.id })}
                      >
                        <NoSymbolIcon className="h-4 w-4" /> Anular
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modales de texto */}
      <ModalTexto
        isOpen={modalRechazo.isOpen}
        title="Motivo de rechazo"
        placeholder="Escribe el motivo por el que se rechaza esta papeleta…"
        cargando={accionId !== null}
        onClose={() => setModalRechazo({ isOpen: false, id: null })}
        onConfirmar={(texto) => {
          const id = modalRechazo.id!;
          setModalRechazo({ isOpen: false, id: null });
          accion(id, () => papeletaService.rechazar(id, texto), 'Papeleta rechazada');
        }}
      />

      <ModalTexto
        isOpen={modalObservacion.isOpen}
        title="Comentario de observación"
        placeholder="Describe qué debe corregir el solicitante…"
        cargando={accionId !== null}
        onClose={() => setModalObservacion({ isOpen: false, id: null })}
        onConfirmar={(texto) => {
          const id = modalObservacion.id!;
          setModalObservacion({ isOpen: false, id: null });
          accion(id, () => papeletaService.observar(id, texto), 'Papeleta observada');
        }}
      />

      <ModalTexto
        isOpen={modalAnulacion.isOpen}
        title="Motivo de anulación"
        placeholder="Escribe el motivo por el que se anula esta papeleta…"
        cargando={accionId !== null}
        onClose={() => setModalAnulacion({ isOpen: false, id: null })}
        onConfirmar={(texto) => {
          const id = modalAnulacion.id!;
          setModalAnulacion({ isOpen: false, id: null });
          accion(id, () => papeletaService.anular(id, texto), 'Papeleta anulada');
        }}
      />

      <Modal
        isOpen={modalCancelar.isOpen}
        onClose={() => setModalCancelar({ isOpen: false, id: null })}
        title="Cancelar papeleta"
      >
        <p className="text-sm text-gray-300">¿Estás seguro de que deseas cancelar esta papeleta? Esta acción no se puede deshacer.</p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setModalCancelar({ isOpen: false, id: null })}>No, mantener</Button>
          <Button
            variant="danger"
            disabled={accionId !== null}
            onClick={() => {
              const id = modalCancelar.id!;
              setModalCancelar({ isOpen: false, id: null });
              accion(id, () => papeletaService.cancelar(id), 'Papeleta cancelada');
            }}
          >
            {accionId !== null ? 'Cancelando...' : 'Sí, cancelar'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}