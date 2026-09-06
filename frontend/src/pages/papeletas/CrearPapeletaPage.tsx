import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, DocumentPlusIcon } from '@heroicons/react/24/outline';
import { papeletaService, type DatosCrearPapeleta } from '../../services/papeleta.service';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

const MOTIVOS = [
  'Descanso médico',
  'Atención médica',
  'Asunto particular',
  'Comisión de servicio',
  'Docencia',
  'Onomástico',
  'Vacaciones',
  'Omisión de marcado entrada/salida',
  'Autorización de ingreso fuera de tolerancia',
  'Compensación de horas trabajadas',
  'Otros',
] as const;

const SELECT_CLS = 'w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500';
const REGEX_24H = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function CrearPapeletaPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { mostrar } = useToast();
  const esEdicion = Boolean(id);

  const [tipoTiempo, setTipoTiempo] = useState<'DIAS' | 'HORAS'>('DIAS');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [fechaHoras, setFechaHoras] = useState('');
  const [horaSalida, setHoraSalida] = useState('');
  const [horaRetorno, setHoraRetorno] = useState('');
  const [motivo, setMotivo] = useState<string>(MOTIVOS[0]);
  const [motivoOtros, setMotivoOtros] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(esEdicion);

  // Cargar papeleta existente si es modo edición
  useEffect(() => {
    if (!esEdicion || !id) return;
    async function cargarPapeleta() {
      try {
        const papeleta = await papeletaService.obtenerPapeleta(Number(id));
        setTipoTiempo(papeleta.tipoTiempo);
        setMotivo(papeleta.motivo);
        setMotivoOtros(papeleta.motivoOtros ?? '');

        if (papeleta.tipoTiempo === 'DIAS') {
          // fechaInicio y fechaFin vienen como ISO; las convertimos a YYYY-MM-DD local
          setFechaInicio(papeleta.fechaInicio.slice(0, 10));
          setFechaFin(papeleta.fechaFin.slice(0, 10));
        } else {
          // Para horas, suponemos que fechaInicio es la fecha del permiso
          setFechaHoras(papeleta.fechaInicio.slice(0, 10));
          setHoraSalida(papeleta.horaSalida?.slice(11, 16) ?? '');
          setHoraRetorno(papeleta.horaRetorno?.slice(11, 16) ?? '');
        }
      } catch {
        mostrar('No se pudo cargar la papeleta', 'error');
        navigate('/papeletas');
      } finally {
        setCargando(false);
      }
    }
    cargarPapeleta();
  }, [esEdicion, id, navigate, mostrar]);

  function validar(): boolean {
    const e: Record<string, string> = {};

    if (tipoTiempo === 'DIAS') {
      if (!fechaInicio) e.fechaInicio = 'La fecha de inicio es obligatoria';
      if (!fechaFin) e.fechaFin = 'La fecha de fin es obligatoria';
      if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
        e.fechaFin = 'La fecha de fin debe ser posterior o igual a la de inicio';
      }
    } else {
      if (!fechaHoras) e.fechaHoras = 'La fecha es obligatoria';
      if (!horaSalida) {
        e.horaSalida = 'La hora de salida es obligatoria';
      } else if (!REGEX_24H.test(horaSalida)) {
        e.horaSalida = 'Formato 24h requerido (HH:mm)';
      }
      if (!horaRetorno) {
        e.horaRetorno = 'La hora de retorno es obligatoria';
      } else if (!REGEX_24H.test(horaRetorno)) {
        e.horaRetorno = 'Formato 24h requerido (HH:mm)';
      }
      if (horaSalida && horaRetorno && REGEX_24H.test(horaSalida) && REGEX_24H.test(horaRetorno)) {
        if (horaRetorno <= horaSalida) {
          e.horaRetorno = 'La hora de retorno debe ser posterior a la de salida';
        }
      }
    }

    if (motivo === 'Otros' && !motivoOtros.trim()) {
      e.motivoOtros = 'Especifica el motivo';
    }

    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validar()) return;
    setGuardando(true);

    try {
      let datos: DatosCrearPapeleta;

      if (tipoTiempo === 'DIAS') {
        datos = {
          tipoTiempo: 'DIAS',
          fechaInicio: new Date(`${fechaInicio}T00:00:00`).toISOString(),
          fechaFin: new Date(`${fechaFin}T00:00:00`).toISOString(),
          motivo,
          motivoOtros: motivo === 'Otros' ? motivoOtros.trim() : null,
        };
      } else {
        const salidaISO = new Date(`${fechaHoras}T${horaSalida}:00`).toISOString();
        const retornoISO = new Date(`${fechaHoras}T${horaRetorno}:00`).toISOString();
        datos = {
          tipoTiempo: 'HORAS',
          fechaInicio: salidaISO,
          fechaFin: retornoISO,
          horaSalida: salidaISO,
          horaRetorno: retornoISO,
          motivo,
          motivoOtros: motivo === 'Otros' ? motivoOtros.trim() : null,
        };
      }

      if (esEdicion && id) {
        // Reenviar papeleta observada
        const papeleta = await papeletaService.reenviar(Number(id), datos);
        mostrar(`Papeleta N° ${papeleta.numero} reenviada correctamente`, 'success');
      } else {
        // Crear nueva
        const papeleta = await papeletaService.crearPapeleta(datos);
        mostrar(`Papeleta N° ${papeleta.numero} creada exitosamente`, 'success');
      }

      navigate('/papeletas');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ??
        'No se pudo guardar la papeleta';
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
    <div className="max-w-xl space-y-5">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/papeletas')}>
          <ArrowLeftIcon className="h-4 w-4" /> Volver
        </Button>
        <div className="flex items-center gap-2">
          <DocumentPlusIcon className="h-5 w-5 text-emerald-400" />
          <h1 className="text-xl font-bold text-gray-100">
            {esEdicion ? 'Reenviar papeleta observada' : 'Nueva papeleta'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <div className="space-y-4">
            {/* Tipo de permiso */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Tipo de permiso *</label>
              <div className="flex gap-3">
                {(['DIAS', 'HORAS'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipoTiempo(t)}
                    className={[
                      'flex-1 rounded-lg border py-2 text-sm font-medium transition-colors',
                      tipoTiempo === t
                        ? 'border-emerald-600 bg-emerald-900/40 text-emerald-400'
                        : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500',
                    ].join(' ')}
                  >
                    {t === 'DIAS' ? 'Por día(s)' : 'Por horas'}
                  </button>
                ))}
              </div>
            </div>

            {/* Campos de fecha según tipo */}
            {tipoTiempo === 'DIAS' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Fecha inicio *"
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => { setFechaInicio(e.target.value); setErrores((p) => ({ ...p, fechaInicio: '' })); }}
                  error={errores.fechaInicio}
                />
                <Input
                  label="Fecha fin *"
                  type="date"
                  value={fechaFin}
                  min={fechaInicio}
                  onChange={(e) => { setFechaFin(e.target.value); setErrores((p) => ({ ...p, fechaFin: '' })); }}
                  error={errores.fechaFin}
                />
              </div>
            ) : (
              <>
                <Input
                  label="Fecha del permiso *"
                  type="date"
                  value={fechaHoras}
                  onChange={(e) => { setFechaHoras(e.target.value); setErrores((p) => ({ ...p, fechaHoras: '' })); }}
                  error={errores.fechaHoras}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Hora de salida * (24h)"
                    type="text"
                    value={horaSalida}
                    onChange={(e) => { setHoraSalida(e.target.value); setErrores((p) => ({ ...p, horaSalida: '' })); }}
                    error={errores.horaSalida}
                    placeholder="HH:mm"
                  />
                  <Input
                    label="Hora de retorno * (24h)"
                    type="text"
                    value={horaRetorno}
                    onChange={(e) => { setHoraRetorno(e.target.value); setErrores((p) => ({ ...p, horaRetorno: '' })); }}
                    error={errores.horaRetorno}
                    placeholder="HH:mm"
                  />
                </div>
              </>
            )}

            {/* Motivo */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Motivo *</label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className={SELECT_CLS}
              >
                {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {motivo === 'Otros' && (
              <Input
                label="Especifica el motivo *"
                value={motivoOtros}
                onChange={(e) => { setMotivoOtros(e.target.value); setErrores((p) => ({ ...p, motivoOtros: '' })); }}
                error={errores.motivoOtros}
                placeholder="Describe el motivo de tu solicitud"
              />
            )}

            {/* Botones */}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" type="button" onClick={() => navigate('/papeletas')} disabled={guardando}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={guardando}>
                {guardando ? (esEdicion ? 'Reenviando...' : 'Enviando...') : (esEdicion ? 'Reenviar solicitud' : 'Enviar solicitud')}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}