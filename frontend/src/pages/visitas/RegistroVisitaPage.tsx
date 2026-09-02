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
  const [gafete, setGafete] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    Promise.all([
      adminService.listarUsuarios({ activo: 'true' }),
      asistenciaService.obtenerPresencia(),
    ]).then(([u, p]) => {
      // listarUsuarios devuelve un array (si no, extraer u.usuarios)
      setUsuarios(Array.isArray(u) ? u : u?.usuarios ?? []);
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
        gafeteEntregado: gafete,
      });
      mostrar('Visita registrada exitosamente', 'success');
      setVisitanteNombre('');
      setVisitanteDni('');
      setTrabajadorId('');
      setBusquedaTrabajador('');
      setGafete(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? 'Error al registrar la visita';
      mostrar(msg, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/visitas')}>
          <ArrowLeftIcon className="h-4 w-4" /> Volver
        </Button>
        <div className="flex items-center gap-2">
          <UserGroupIcon className="h-5 w-5 text-violet-400" />
          <h1 className="text-xl font-bold text-gray-100">Registrar visita</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <div className="space-y-4">
            {/* Datos del visitante */}
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Datos del visitante</p>
            <Input
              label="Nombre completo *"
              value={visitanteNombre}
              onChange={(e) => { setVisitanteNombre(e.target.value); setErrores((p) => ({ ...p, nombre: '' })); }}
              error={errores.nombre}
              placeholder="Juan García López"
            />
            <Input
              label="DNI *"
              value={visitanteDni}
              onChange={(e) => { setVisitanteDni(e.target.value.replace(/\D/g, '')); setErrores((p) => ({ ...p, dni: '' })); }}
              error={errores.dni}
              placeholder="12345678"
              maxLength={8}
            />

            {/* Trabajador a visitar */}
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 pt-2">Trabajador a visitar</p>
            <Input
              label="Buscar trabajador"
              value={busquedaTrabajador}
              onChange={(e) => { setBusquedaTrabajador(e.target.value); setTrabajadorId(''); }}
              placeholder="Escribe para filtrar…"
            />
            {errores.trabajador && <p className="text-xs text-red-400">{errores.trabajador}</p>}

            {/* Lista de usuarios filtrados */}
            {busquedaTrabajador.trim() && (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900">
                {usuariosFiltrados.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-gray-500">Sin resultados</p>
                ) : (
                  usuariosFiltrados.map((u) => {
                    const presenciaU = presencia.find((p) => p.usuarioId === u.id);
                    const estaPresente = presenciaU?.estado === 'PRESENTE';
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setTrabajadorId(u.id); setBusquedaTrabajador(`${u.nombres} ${u.apellidos}`); setErrores((p) => ({ ...p, trabajador: '' })); }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-800 transition-colors"
                      >
                        <div>
                          <span className="font-medium text-gray-100">{u.nombres} {u.apellidos}</span>
                          <span className="ml-2 text-xs text-gray-500">{u.jefatura?.nombre ?? '—'}</span>
                        </div>
                        <span className={`text-xs font-medium ${estaPresente ? 'text-emerald-400' : 'text-gray-500'}`}>
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
              <div className="flex items-start gap-2 rounded-lg border border-amber-700 bg-amber-900/20 px-3 py-2">
                <ExclamationTriangleIcon className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  Este trabajador no aparece como presente en la sede. El sistema verificará su estado al registrar la visita.
                </p>
              </div>
            )}

            {/* Gafete */}
            <div className="flex items-center gap-3 pt-1">
              <input
                id="gafete"
                type="checkbox"
                checked={gafete}
                onChange={(e) => setGafete(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
              />
              <label htmlFor="gafete" className="text-sm font-medium text-gray-300">
                Gafete entregado al visitante
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" type="button" onClick={() => navigate('/visitas')}>Cancelar</Button>
              <Button variant="primary" type="submit" disabled={guardando}>
                {guardando ? 'Registrando...' : 'Registrar visita'}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}