import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, UserGroupIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { visitaService } from '../../services/visita.service';
import { asistenciaService } from '../../services/asistencia.service';
import { adminService } from '../../services/admin.service';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import type { Usuario } from '../../types';

// Definición local del tipo de presencia (evita importar un tipo que tal vez no existe)
interface PresenciaItem {
  usuarioId: number;
  nombres?: string;
  apellidos?: string;
  jefatura?: string;
  estado: 'PRESENTE' | 'AUSENTE';
  ultimoMovimiento?: string;
}

export function RegistroVisitaPage() {
  const navigate = useNavigate();
  const { mostrar } = useToast();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [presencia, setPresencia] = useState<PresenciaItem[]>([]);
  const [busquedaTrabajador, setBusquedaTrabajador] = useState('');
  const [trabajadorId, setTrabajadorId] = useState<number | ''>('');

  const [visitanteNombre, setVisitanteNombre] = useState('');
  const [visitanteDni, setVisitanteDni] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    Promise.all([
      adminService.listarUsuarios({ activo: true }),
      asistenciaService.obtenerPresencia(),
    ]).then(([u, p]) => {
      setUsuarios(u);
      setPresencia(p);
    });
  }, []);

  const estadoPresencia = trabajadorId
    ? presencia.find((p) => p.usuarioId === trabajadorId)?.estado
    : null;

  const usuariosFiltrados = usuarios.filter((u) => {
    const texto = `${u.nombres} ${u.apellidos}`.toLowerCase();
    return texto.includes(busquedaTrabajador.toLowerCase());
  });

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!visitanteNombre.trim()) e.nombre = 'El nombre del visitante es obligatorio';
    if (!visitanteDni.trim()) e.dni = 'El DNI es obligatorio';
    if (!trabajadorId) e.trabajador = 'Selecciona el trabajador a visitar';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validar()) return;
    setGuardando(true);
    try {
      await visitaService.registrarVisita({
        visitanteNombre: visitanteNombre.trim(),
        visitanteDni: visitanteDni.trim(),
        trabajadorVisitadoId: trabajadorId as number,
      });
      mostrar('Visita registrada exitosamente', 'success');
      setVisitanteNombre('');
      setVisitanteDni('');
      setTrabajadorId('');
      setBusquedaTrabajador('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? 'Error al registrar la visita';
      mostrar(msg, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-3.5rem)] bg-surface-bg px-6 py-8 space-y-5">
      <div className="flex items-center gap-3">
        <Button theme="light" variant="ghost" size="sm" onClick={() => navigate('/visitas')}>
          <ArrowLeftIcon className="h-4 w-4" /> Volver
        </Button>
        <div className="flex items-center gap-2">
          <UserGroupIcon className="h-5 w-5 text-brand-blue" />
          <h1 className="text-xl font-bold text-content-primary">Registrar visita</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <Card theme="light">
          <div className="space-y-4">
            {/* Datos del visitante */}
            <p className="text-xs font-semibold uppercase tracking-wide text-content-secondary">Datos del visitante</p>
            <Input
              theme="light"
              label="Nombre completo *"
              value={visitanteNombre}
              onChange={(e) => { setVisitanteNombre(e.target.value); setErrores((p) => ({ ...p, nombre: '' })); }}
              error={errores.nombre}
              placeholder="Juan García López"
            />
            <Input
              theme="light"
              label="DNI *"
              value={visitanteDni}
              onChange={(e) => { setVisitanteDni(e.target.value.replace(/\D/g, '')); setErrores((p) => ({ ...p, dni: '' })); }}
              error={errores.dni}
              placeholder="12345678"
              maxLength={8}
            />

            {/* Trabajador a visitar */}
            <p className="text-xs font-semibold uppercase tracking-wide text-content-secondary pt-2">Trabajador a visitar</p>
            <Input
              theme="light"
              label="Buscar trabajador"
              value={busquedaTrabajador}
              onChange={(e) => { setBusquedaTrabajador(e.target.value); setTrabajadorId(''); }}
              placeholder="Escribe para filtrar…"
            />
            {errores.trabajador && <p className="text-xs text-state-error-fg">{errores.trabajador}</p>}

            {/* Lista de usuarios filtrados */}
            {busquedaTrabajador.trim() && (
              <div className="max-h-44 overflow-y-auto rounded-ds-lg border border-line-light bg-surface-card shadow-card">
                {usuariosFiltrados.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-content-tertiary">Sin resultados</p>
                ) : (
                  usuariosFiltrados.map((u) => {
                    const presenciaU = presencia.find((p) => p.usuarioId === u.id);
                    const estaPresente = presenciaU?.estado === 'PRESENTE';
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setTrabajadorId(u.id); setBusquedaTrabajador(`${u.nombres} ${u.apellidos}`); setErrores((p) => ({ ...p, trabajador: '' })); }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm border-b border-line-light hover:bg-surface-bg transition-colors"
                      >
                        <div>
                          <span className="font-medium text-content-primary">{u.nombres} {u.apellidos}</span>
                          <span className="ml-2 text-xs text-content-secondary">{u.jefatura?.nombre ?? '—'}</span>
                        </div>
                        <span className={`text-xs font-medium ${estaPresente ? 'text-state-success-fg' : 'text-content-tertiary'}`}>
                          {estaPresente ? 'Presente' : 'Ausente'}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Advertencia de ausencia */}
            {trabajadorId && estadoPresencia === 'AUSENTE' && (
              <div className="flex items-start gap-2 rounded-ds-lg border border-state-warning-fg/20 bg-state-warning-bg px-3 py-2">
                <ExclamationTriangleIcon className="h-4 w-4 text-state-warning-fg shrink-0 mt-0.5" />
                <p className="text-xs text-state-warning-fg">
                  Este trabajador no aparece como presente en la sede. El sistema verificará su estado al registrar la visita.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button theme="light" variant="ghost" type="button" onClick={() => navigate('/visitas')}>Cancelar</Button>
              <Button theme="light" variant="primary" type="submit" disabled={guardando}>
                {guardando ? 'Registrando...' : 'Registrar visita'}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}