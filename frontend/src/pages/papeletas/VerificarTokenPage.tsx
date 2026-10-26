import { useState, type FormEvent } from 'react';
import { QrCodeIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { papeletaService, type ResultadoVerificarToken } from '../../services/papeleta.service';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import type { EstadoPapeleta } from '../../types';

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

const ETIQUETA_ESTADO: Record<EstadoPapeleta, string> = {
  PENDIENTE: 'Pendiente', EN_REVISION: 'En revisión', OBSERVADO: 'Observado',
  APROBADO: 'Aprobado', RECHAZADO: 'Rechazado', CANCELADO: 'Cancelado',
  ANULADO: 'Anulado', ANULACION_SOLICITADA: 'Anulación solicitada',
};

const BADGE: Record<EstadoPapeleta, string> = {
  PENDIENTE: 'badge-info',
  EN_REVISION: 'badge-warning',
  OBSERVADO: 'badge-warning',
  APROBADO: 'badge-success',
  RECHAZADO: 'badge-error',
  CANCELADO: 'badge bg-line-strong text-content-secondary',
  ANULADO: 'badge-error',
  ANULACION_SOLICITADA: 'badge-warning',
};

export function VerificarTokenPage() {
  const { mostrar } = useToast();
  const [token, setToken] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoVerificarToken | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const tokenLimpio = token.trim().toUpperCase();
    if (tokenLimpio.length !== 6) {
      mostrar('El token debe tener exactamente 6 caracteres', 'warning');
      return;
    }
    setVerificando(true);
    setResultado(null);
    try {
      const res = await papeletaService.verificarToken(tokenLimpio);
      setResultado(res);

    } catch (err: unknown) {
      const mensaje =
        (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ??
        'No se pudo verificar el token. Inténtalo nuevamente.';
      mostrar(mensaje, 'error');
    }



      finally {
      setVerificando(false);
    }
  }

  const p = resultado?.papeleta;

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] bg-surface-bg px-6 py-8 space-y-5">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <QrCodeIcon className="h-6 w-6 text-brand-blue" />
        <div>
          <h1 className="text-xl font-bold text-content-primary">Verificar token de papeleta</h1>
          <p className="text-sm text-content-secondary">Comprueba la validez de una papeleta ingresando su código</p>
        </div>
      </div>

      {/* Formulario de búsqueda */}
      <Card theme="light">
        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              theme="light"
              label="Código de verificación"
              value={token}
              onChange={(e) => { setToken(e.target.value.toUpperCase()); setResultado(null); }}
              placeholder="Ej: A3BX7Z"
              maxLength={6}
              className="font-mono tracking-widest uppercase"
            />
          </div>
          <Button theme="light" variant="primary" type="submit" disabled={verificando} className="mb-0.5">
            {verificando ? 'Verificando...' : 'Verificar'}
          </Button>
        </form>
      </Card>

      {/* Resultado */}
      {resultado !== null && (
        resultado.valido && p ? (
          <Card theme="light">
            <div className="flex items-start gap-3 mb-4">
              <CheckCircleIcon className="h-6 w-6 text-state-success-fg shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-content-primary">Token válido</p>
                <p className="text-xs text-content-secondary">La papeleta fue encontrada y verificada correctamente</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex gap-4 py-1.5 border-b border-line-light">
                <span className="w-32 shrink-0 text-xs text-content-secondary">N° Papeleta</span>
                <span className="font-bold text-content-primary">{p.numero}</span>
              </div>
              <div className="flex gap-4 py-1.5 border-b border-line-light">
                <span className="w-32 shrink-0 text-xs text-content-secondary">Solicitante</span>
                <span className="text-content-primary">{p.solicitante.nombres} {p.solicitante.apellidos}</span>
              </div>
              <div className="flex gap-4 py-1.5 border-b border-line-light">
                <span className="w-32 shrink-0 text-xs text-content-secondary">Tipo</span>
                <span className="text-content-primary">{p.tipoTiempo === 'DIAS' ? 'Por día(s)' : 'Por horas'}</span>
              </div>
              <div className="flex gap-4 py-1.5 border-b border-line-light">
                <span className="w-32 shrink-0 text-xs text-content-secondary">Período</span>
                <span className="text-content-primary">
                  {p.tipoTiempo === 'DIAS'
                    ? `${formatFecha(p.fechaInicio)} al ${formatFecha(p.fechaFin)}`
                    : `${formatFecha(p.fechaInicio)} · ${p.horaSalida ? formatHora(p.horaSalida) : ''} → ${p.horaRetorno ? formatHora(p.horaRetorno) : ''}`
                  }
                </span>
              </div>
              <div className="flex gap-4 py-1.5">
                <span className="w-32 shrink-0 text-xs text-content-secondary">Estado</span>
                <span className={BADGE[p.estado]}>
                  {ETIQUETA_ESTADO[p.estado]}
                </span>
              </div>
            </div>
          </Card>
        ) : (
          <div className="flex items-center gap-3 rounded-ds-lg border border-state-error-fg/20 bg-state-error-bg p-4">
            <XCircleIcon className="h-6 w-6 text-state-error-fg shrink-0" />
            <div>
              <p className="font-semibold text-state-error-fg">Token no encontrado o inválido</p>
              <p className="text-xs text-content-secondary mt-0.5">
                {resultado.mensaje ?? 'Verifica que el código esté escrito correctamente.'}
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
}