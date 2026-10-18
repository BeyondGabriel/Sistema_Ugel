import { type ReactNode } from 'react';
import {
  CheckIcon,
  EnvelopeIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

/*
 * ===========================================================
 * SIGPER Design System · página interna de verificación
 * ===========================================================
 * No forma parte del producto: sirve para revisar visualmente
 * los tokens y componentes antes de rediseñar cada página.
 * Ruta pública: /design-system
 */

/* ─── Utilidades de contraste (WCAG 2.1) ───────────────────── */

function canalLineal(canal: number): number {
  return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const limpio = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) =>
    canalLineal(parseInt(limpio.slice(i, i + 2), 16) / 255),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio de contraste WCAG entre dos colores hex (siempre ≥ 1). */
function contraste(hexA: string, hexB: string): number {
  const [claro, oscuro] = [luminancia(hexA), luminancia(hexB)].sort((a, b) => b - a);
  return (claro + 0.05) / (oscuro + 0.05);
}

function etiquetaNivel(ratio: number): string {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA (texto grande)';
  return 'Insuficiente';
}

const BLANCO = '#FFFFFF';
const NAVY = '#0A1D3D';

/* ─── Datos de la paleta ───────────────────────────────────── */

interface TokenColor {
  nombre: string;
  clase: string;
  hex: string;
  nota?: string;
}

const paletaMarca: TokenColor[] = [
  { nombre: 'brand-navy', clase: 'bg-brand-navy', hex: '#0A1D3D', nota: 'Sidebar, top bar, headings' },
  { nombre: 'brand-navyLight', clase: 'bg-brand-navyLight', hex: '#1E3A5F', nota: 'Hover de sidebar' },
  { nombre: 'brand-yellow', clase: 'bg-brand-yellow', hex: '#F5C518', nota: 'Acentos, badges, ítem activo' },
  { nombre: 'brand-yellowDark', clase: 'bg-brand-yellowDark', hex: '#D4A800', nota: 'Hover del amarillo' },
  { nombre: 'brand-blue', clase: 'bg-brand-blue', hex: '#2563EB', nota: 'Botones primarios, links' },
  { nombre: 'brand-blueHover', clase: 'bg-brand-blueHover', hex: '#1D4ED8', nota: 'Hover del azul' },
];

const paletaSuperficie: TokenColor[] = [
  { nombre: 'surface-bg', clase: 'bg-surface-bg', hex: '#F5F7FA', nota: 'Fondo del contenido' },
  { nombre: 'surface-card', clase: 'bg-surface-card', hex: '#FFFFFF', nota: 'Cards' },
  { nombre: 'surface-sidebar', clase: 'bg-surface-sidebar', hex: '#0A1D3D', nota: 'Sidebar' },
  { nombre: 'surface-topbar', clase: 'bg-surface-topbar', hex: '#0A1D3D', nota: 'Top bar' },
];

const paletaTexto: TokenColor[] = [
  { nombre: 'content-primary', clase: 'bg-content-primary', hex: '#0F172A', nota: 'Títulos y texto principal' },
  { nombre: 'content-secondary', clase: 'bg-content-secondary', hex: '#64748B', nota: 'Subtítulos' },
  { nombre: 'content-tertiary', clase: 'bg-content-tertiary', hex: '#94A3B8', nota: 'Hints y placeholders' },
  { nombre: 'content-inverse', clase: 'bg-content-inverse', hex: '#FFFFFF', nota: 'Texto sobre fondos oscuros' },
  { nombre: 'content-onYellow', clase: 'bg-content-onYellow', hex: '#0A1D3D', nota: 'Texto sobre amarillo (obligatorio)' },
];

const paletaLineas: TokenColor[] = [
  { nombre: 'line-light', clase: 'bg-line-light', hex: '#E2E8F0', nota: 'Bordes sutiles' },
  { nombre: 'line-strong', clase: 'bg-line-strong', hex: '#CBD5E1', nota: 'Bordes visibles' },
];

const paletaEstados: TokenColor[] = [
  { nombre: 'state-success-bg', clase: 'bg-state-success-bg', hex: '#E8F8F0', nota: 'Fondo de éxito' },
  { nombre: 'state-success-fg', clase: 'bg-state-success-fg', hex: '#047857', nota: 'Texto/icono de éxito' },
  { nombre: 'state-warning-bg', clase: 'bg-state-warning-bg', hex: '#FEF9E7', nota: 'Fondo de advertencia' },
  { nombre: 'state-warning-fg', clase: 'bg-state-warning-fg', hex: '#8A6D00', nota: 'Texto de advertencia' },
  { nombre: 'state-error-bg', clase: 'bg-state-error-bg', hex: '#FEE9E9', nota: 'Fondo de error' },
  { nombre: 'state-error-fg', clase: 'bg-state-error-fg', hex: '#C81E1E', nota: 'Texto/icono de error' },
  { nombre: 'state-info-bg', clase: 'bg-state-info-bg', hex: '#E8F3FE', nota: 'Fondo informativo' },
  { nombre: 'state-info-fg', clase: 'bg-state-info-fg', hex: '#2563EB', nota: 'Texto informativo' },
];

interface ParContraste {
  descripcion: string;
  uso: string;
  frente: string;
  fondo: string;
  esperado: string;
  prohibido?: boolean;
}

const paresContraste: ParContraste[] = [
  { descripcion: 'Navy sobre blanco', uso: 'Headings y texto principal', frente: '#0A1D3D', fondo: '#FFFFFF', esperado: '~15:1' },
  { descripcion: 'Amarillo sobre navy', uso: 'Acentos e ítem activo del sidebar', frente: '#F5C518', fondo: '#0A1D3D', esperado: '~10:1' },
  { descripcion: 'Navy sobre amarillo', uso: 'Texto sobre amarillo', frente: '#0A1D3D', fondo: '#F5C518', esperado: '~10:1' },
  { descripcion: 'Azul sobre blanco', uso: 'Botones primarios y links', frente: '#2563EB', fondo: '#FFFFFF', esperado: '~4.5:1' },
  { descripcion: 'Gris secundario sobre blanco', uso: 'Subtítulos', frente: '#64748B', fondo: '#FFFFFF', esperado: '~5:1' },
  { descripcion: 'Blanco sobre amarillo', uso: 'PROHIBIDO en cualquier superficie', frente: '#FFFFFF', fondo: '#F5C518', esperado: '~2:1', prohibido: true },
  { descripcion: 'Amarillo sobre blanco', uso: 'PROHIBIDO para texto', frente: '#F5C518', fondo: '#FFFFFF', esperado: '~1.7:1', prohibido: true },
  { descripcion: 'brand-yellowDark sobre blanco', uso: 'Solo hover del amarillo, NUNCA texto', frente: '#D4A800', fondo: '#FFFFFF', esperado: '—' },
  { descripcion: 'state-warning-fg sobre warning-bg', uso: 'Badge de advertencia', frente: '#8A6D00', fondo: '#FEF9E7', esperado: '≥ 4.5:1' },
  { descripcion: 'state-success-fg sobre success-bg', uso: 'Badge de éxito', frente: '#047857', fondo: '#E8F8F0', esperado: '≥ 4.5:1' },
  { descripcion: 'state-error-fg sobre error-bg', uso: 'Badge de error', frente: '#C81E1E', fondo: '#FEE9E9', esperado: '≥ 4.5:1' },
  { descripcion: 'Blanco sobre error-fg', uso: 'Botón de peligro', frente: '#FFFFFF', fondo: '#C81E1E', esperado: '≥ 5.5:1' },
];

const variantes = ['primary', 'secondary', 'danger', 'ghost'] as const;
const tamanos = ['sm', 'md', 'lg'] as const;
const estadosBoton = ['normal', 'disabled', 'cargando'] as const;

interface FilaTabla {
  numero: string;
  trabajador: string;
  tipo: string;
  estado: string;
  badge: string;
  fecha: string;
}

const filasTabla: FilaTabla[] = [
  { numero: 'PAP-2026-0001', trabajador: 'Ana Torres Vega', tipo: 'Particular', estado: 'Aprobada', badge: 'badge-success', fecha: '12/10/2026' },
  { numero: 'PAP-2026-0002', trabajador: 'Luis Ramírez Soto', tipo: 'Comisión', estado: 'Pendiente', badge: 'badge-warning', fecha: '13/10/2026' },
  { numero: 'PAP-2026-0003', trabajador: 'María Paredes Ruiz', tipo: 'Salud', estado: 'Rechazada', badge: 'badge-error', fecha: '14/10/2026' },
  { numero: 'PAP-2026-0004', trabajador: 'Jorge Neira Castro', tipo: 'Particular', estado: 'En revisión', badge: 'badge-info', fecha: '15/10/2026' },
];

/* ─── Componentes auxiliares de la página ──────────────────── */

function Seccion({
  numero,
  titulo,
  descripcion,
  children,
}: {
  numero: number;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) {
  return (
    <section className="card p-6">
      <div className="flex items-center gap-3">
        <span className="badge bg-brand-navy text-content-inverse">{numero}</span>
        <h2 className="heading-2">{titulo}</h2>
      </div>
      {descripcion && <p className="body-muted mt-2">{descripcion}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function NivelChip({ ratio }: { ratio: number }) {
  const color =
    ratio >= 4.5
      ? 'border-state-success-fg'
      : ratio >= 3
        ? 'border-state-warning-fg'
        : 'border-state-error-fg';
  return (
    <span className={`badge border bg-surface-card text-content-primary ${color}`}>
      {etiquetaNivel(ratio)}
    </span>
  );
}

function RatioFila({ texto, ratio }: { texto: string; ratio: number }) {
  const ok = ratio >= 4.5;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-content-secondary">{texto}</span>
      <span className="flex items-center gap-1 text-xs font-medium text-content-primary">
        {ratio.toFixed(2)}:1
        {ok ? (
          <CheckIcon className="h-3.5 w-3.5 text-state-success-fg" aria-hidden="true" />
        ) : (
          <XMarkIcon className="h-3.5 w-3.5 text-state-error-fg" aria-hidden="true" />
        )}
      </span>
    </div>
  );
}

function Swatch({ token }: { token: TokenColor }) {
  const vsBlanco = contraste(token.hex, BLANCO);
  const vsNavy = contraste(token.hex, NAVY);
  // La "Aa" se pinta con el color que MEJOR contrasta sobre el swatch: así la
  // propia demo nunca cae en una combinación prohibida (blanco sobre amarillo).
  const colorAa = vsBlanco >= vsNavy ? BLANCO : NAVY;

  return (
    <div className="overflow-hidden rounded-ds-md border border-line-light bg-surface-card">
      <div className={`${token.clase} flex h-16 items-center justify-center border-b border-line-light`}>
        <span className="text-lg font-bold" style={{ color: colorAa }}>
          Aa
        </span>
      </div>
      <div className="p-3">
        <p className="text-xs font-semibold text-content-primary">{token.nombre}</p>
        <p className="font-mono text-xs text-content-secondary">{token.hex}</p>
        {token.nota && <p className="mt-1 text-xs text-content-secondary">{token.nota}</p>}
        <div className="mt-2 space-y-0.5 border-t border-line-light pt-2">
          <RatioFila texto="texto blanco" ratio={vsBlanco} />
          <RatioFila texto="texto navy" ratio={vsNavy} />
        </div>
      </div>
    </div>
  );
}

function GrupoPaleta({ titulo, tokens }: { titulo: string; tokens: TokenColor[] }) {
  return (
    <div>
      <h3 className="heading-3 mb-3">{titulo}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tokens.map((token) => (
          <Swatch key={token.nombre} token={token} />
        ))}
      </div>
    </div>
  );
}

function FilaTipografia({
  clase,
  detalle,
  muestra,
}: {
  clase: string;
  detalle: string;
  muestra: string;
}) {
  return (
    <div className="border-b border-line-light py-3 last:border-0">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <code className="rounded-ds-sm bg-surface-bg px-1.5 py-0.5 text-xs text-content-secondary">
          .{clase}
        </code>
        <span className="text-xs text-content-secondary">{detalle}</span>
      </div>
      <p className={clase}>{muestra}</p>
    </div>
  );
}

interface BadgeDemo {
  clase: string;
  texto: string;
  bg: string;
  fg: string;
}

const badgesDemo: BadgeDemo[] = [
  { clase: 'badge-success', texto: 'Aprobada', bg: '#E8F8F0', fg: '#047857' },
  { clase: 'badge-warning', texto: 'Pendiente', bg: '#FEF9E7', fg: '#8A6D00' },
  { clase: 'badge-error', texto: 'Rechazada', bg: '#FEE9E9', fg: '#C81E1E' },
  { clase: 'badge-info', texto: 'En revisión', bg: '#E8F3FE', fg: '#2563EB' },
];

export function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-surface-bg">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        {/* ── Encabezado ─────────────────────────────────────── */}
        <header className="card p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-ds-md bg-brand-navy text-sm font-bold text-brand-yellow">
              SG
            </span>
            <div>
              <h1 className="heading-1">SIGPER · UGEL Talara</h1>
              <p className="body-muted">Design System institucional — base 2.0</p>
            </div>
          </div>
          <p className="body-text mt-4">
            Página interna de verificación. Muestra tokens, clases semánticas y componentes base del
            tema claro. El producto sigue en tema oscuro hasta que cada página se rediseñe en su
            propio prompt.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="badge bg-brand-navy text-content-inverse">light theme</span>
            <span className="badge bg-brand-yellow text-content-onYellow">navy + amarillo + azul</span>
            <span className="badge border border-line-strong bg-surface-card text-content-secondary">
              sin fuentes externas
            </span>
          </div>
        </header>

        {/* ── 1. Paleta ──────────────────────────────────────── */}
        <Seccion
          numero={1}
          titulo="Paleta de colores"
          descripcion="Todos los tokens con su hex y el ratio real (fórmula WCAG 2.1) frente a texto blanco y frente a texto navy."
        >
          <div className="space-y-6">
            <GrupoPaleta titulo="Marca" tokens={paletaMarca} />
            <GrupoPaleta titulo="Superficies" tokens={paletaSuperficie} />
            <GrupoPaleta titulo="Texto" tokens={paletaTexto} />
            <GrupoPaleta titulo="Bordes y líneas" tokens={paletaLineas} />
            <GrupoPaleta titulo="Estados (soft pill)" tokens={paletaEstados} />
          </div>

          <h3 className="heading-3 mt-8 mb-3">Pares de contraste verificados</h3>
          <div className="overflow-x-auto rounded-ds-md border border-line-light">
            <table className="min-w-full text-left">
              <thead className="bg-surface-bg text-xs uppercase tracking-wide text-content-secondary">
                <tr>
                  <th className="px-3 py-2 font-semibold">Combinación</th>
                  <th className="px-3 py-2 font-semibold">Uso</th>
                  <th className="px-3 py-2 font-semibold">Esperado</th>
                  <th className="px-3 py-2 font-semibold">Medido</th>
                  <th className="px-3 py-2 font-semibold">Nivel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light bg-surface-card">
                {paresContraste.map((par) => {
                  const ratio = contraste(par.frente, par.fondo);
                  return (
                    <tr key={par.descripcion} className="hover:bg-surface-bg">
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1 rounded-ds-sm border border-line-light px-1 py-0.5">
                            <span
                              className="h-3 w-3 rounded-full border border-line-strong"
                              style={{ backgroundColor: par.frente }}
                            />
                            <span
                              className="h-3 w-3 rounded-full border border-line-strong"
                              style={{ backgroundColor: par.fondo }}
                            />
                          </span>
                          <span className="text-sm text-content-primary">{par.descripcion}</span>
                          {par.prohibido && (
                            <span className="badge border border-state-error-fg bg-state-error-bg text-content-primary">
                              PROHIBIDO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-content-secondary">{par.uso}</td>
                      <td className="px-3 py-2 text-xs text-content-secondary">{par.esperado}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-content-primary">
                        {ratio.toFixed(2)}:1
                      </td>
                      <td className="px-3 py-2">
                        <NivelChip ratio={ratio} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Seccion>

        {/* ── 2. Tipografía ──────────────────────────────────── */}
        <Seccion
          numero={2}
          titulo="Tipografía"
          descripcion="Tipografía del sistema (sin fuentes externas). Solo cambia tamaño y peso."
        >
          <FilaTipografia clase="heading-1" detalle="text-2xl font-bold" muestra="Gestión de personal" />
          <FilaTipografia clase="heading-2" detalle="text-xl font-semibold" muestra="Papeletas de salida" />
          <FilaTipografia clase="heading-3" detalle="text-base font-semibold" muestra="Datos del trabajador" />
          <FilaTipografia clase="body-text" detalle="text-sm" muestra="Texto principal de párrafos y celdas." />
          <FilaTipografia clase="body-muted" detalle="text-sm text-content-secondary" muestra="Texto secundario: descripciones y ayudas." />
          <FilaTipografia clase="caption" detalle="text-xs text-content-tertiary" muestra="Texto auxiliar: usar solo como pista, nunca para información crítica" />
        </Seccion>

        {/* ── 3. Botones ─────────────────────────────────────── */}
        <Seccion
          numero={3}
          titulo="Botones"
          descripcion='Cuatro variantes por tres tamaños, siempre con theme="light". Sin theme, el componente mantiene el aspecto oscuro actual.'
        >
          <div className="space-y-3">
            {variantes.map((variante) => (
              <div key={variante} className="flex flex-wrap items-center gap-3">
                <span className="w-24 text-xs font-semibold uppercase tracking-wide text-content-secondary">
                  {variante}
                </span>
                {tamanos.map((tamano) => (
                  <Button key={tamano} variant={variante} size={tamano} theme="light">
                    {tamano === 'sm' ? 'Pequeño' : tamano === 'md' ? 'Mediano' : 'Grande'}
                  </Button>
                ))}
              </div>
            ))}
          </div>

          <h3 className="heading-3 mt-8 mb-3">Estados</h3>
          <div className="space-y-3">
            {variantes.map((variante) => (
              <div key={variante} className="flex flex-wrap items-center gap-3">
                <span className="w-24 text-xs font-semibold uppercase tracking-wide text-content-secondary">
                  {variante}
                </span>
                {estadosBoton.map((estado) => (
                  <Button
                    key={estado}
                    variant={variante}
                    theme="light"
                    disabled={estado === 'disabled'}
                    cargando={estado === 'cargando'}
                  >
                    {estado === 'normal' ? 'Guardar' : estado === 'disabled' ? 'Deshabilitado' : 'Guardando'}
                  </Button>
                ))}
              </div>
            ))}
          </div>

          <h3 className="heading-3 mt-8 mb-3">Con iconos</h3>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" theme="light" icono={<CheckIcon className="h-4 w-4" />}>
              Aprobar
            </Button>
            <Button variant="secondary" theme="light" icono={<EnvelopeIcon className="h-4 w-4" />}>
              Notificar
            </Button>
            <Button variant="ghost" theme="light" iconoDerecho={<XMarkIcon className="h-4 w-4" />}>
              Volver
            </Button>
            <Button variant="danger" theme="light" icono={<LockClosedIcon className="h-4 w-4" />}>
              Anular
            </Button>
          </div>

          <h3 className="heading-3 mt-8 mb-3">Clases CSS (.btn-*)</h3>
          <p className="mb-3 text-xs text-content-secondary">
            Alternativa sin componente: las clases de index.css funcionan en cualquier elemento.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary btn-sm">
              btn-primary btn-sm
            </button>
            <button type="button" className="btn btn-secondary btn-md">
              btn-secondary btn-md
            </button>
            <button type="button" className="btn btn-danger btn-lg">
              btn-danger btn-lg
            </button>
            <button type="button" className="btn btn-ghost btn-md">
              btn-ghost btn-md
            </button>
            <button type="button" className="btn btn-primary btn-md" disabled>
              disabled
            </button>
          </div>
        </Seccion>

        {/* ── 4. Inputs ──────────────────────────────────────── */}
        <Seccion
          numero={4}
          titulo="Inputs"
          descripcion='Todos con theme="light". Estados: default, con icono, con error y disabled.'
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Input theme="light" label="Correo institucional" placeholder="nombre@ugel.gob.pe" type="email" />
            <Input
              theme="light"
              label="Buscar trabajador"
              placeholder="DNI o apellidos"
              icono={<MagnifyingGlassIcon />}
            />
            <Input
              theme="light"
              label="DNI"
              defaultValue="1234567"
              error="El DNI debe tener 8 dígitos"
            />
            <Input theme="light" label="Área (bloqueada)" defaultValue="Administración" disabled />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-content-primary">Clase .input-field</label>
              <input className="input-field" placeholder="Input con la clase CSS" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-content-primary">Clase .input-field-error</label>
              <input className="input-field input-field-error" placeholder="Input con error" />
            </div>
          </div>
          <div className="mt-4 rounded-ds-md border border-line-light bg-surface-bg p-3">
            <p className="text-xs text-content-secondary">
              El foco usa <code className="font-mono">focus:ring-brand-blue</code>. El placeholder
              usa <code className="font-mono">content-tertiary</code> (2.56:1): sirve como pista,
              nunca como sustituto de una label visible.
            </p>
          </div>
        </Seccion>

        {/* ── 5. Badges ──────────────────────────────────────── */}
        <Seccion
          numero={5}
          titulo="Badges de estado"
          descripcion="Píldoras suaves (soft pill). El ratio mostrado es el real entre el texto y el fondo del badge."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {badgesDemo.map((badge) => {
              const ratio = contraste(badge.fg, badge.bg);
              return (
                <div key={badge.clase} className="rounded-ds-md border border-line-light bg-surface-card p-4">
                  <span className={badge.clase}>{badge.texto}</span>
                  <p className="mt-3 font-mono text-xs text-content-secondary">.{badge.clase}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-content-secondary">{ratio.toFixed(2)}:1</span>
                    <NivelChip ratio={ratio} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-ds-md border border-line-light bg-surface-card p-3">
            <p className="text-sm text-content-primary">
              <strong className="font-semibold">Estado de contraste:</strong> los cuatro badges
              cumplen AA para texto normal. Éxito{' '}
              <code className="font-mono text-content-primary">#047857</code> sobre{' '}
              <code className="font-mono text-content-primary">#E8F8F0</code> → 4.99:1; advertencia{' '}
              <code className="font-mono text-content-primary">#8A6D00</code> sobre{' '}
              <code className="font-mono text-content-primary">#FEF9E7</code> → 4.67:1; error{' '}
              <code className="font-mono text-content-primary">#C81E1E</code> sobre{' '}
              <code className="font-mono text-content-primary">#FEE9E9</code> → 4.93:1; info{' '}
              <code className="font-mono text-content-primary">#2563EB</code> sobre{' '}
              <code className="font-mono text-content-primary">#E8F3FE</code> → 4.60:1. Los fondos
              soft (#E8F8F0, #FEF9E7, #FEE9E9, #E8F3FE) no se tocaron; las cifras de esta página se
              calculan en vivo.
            </p>
          </div>
        </Seccion>

        {/* ── 6. Cards ───────────────────────────────────────── */}
        <Seccion
          numero={6}
          titulo="Cards"
          descripcion='Card simple, card con título y KPI cards, con theme="light".'
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Card theme="light">
              <h3 className="heading-3 mb-2">Card simple</h3>
              <p className="body-muted">
                Fondo blanco, borde line-light y sombra suave (shadow-card).
              </p>
            </Card>
            <Card theme="light" titulo="Card con título">
              <p className="body-text">
                El título se renderiza como header interno con content-primary.
              </p>
              <p className="caption mt-2">Pie de card en caption</p>
            </Card>
            <Card theme="light" className="card-hover">
              <p className="body-muted">Papeletas pendientes</p>
              <p className="mt-1 text-3xl font-bold text-content-primary">12</p>
              <span className="badge-warning mt-2">Requiere revisión</span>
            </Card>
          </div>

          <h3 className="heading-3 mt-8 mb-3">KPI cards (.kpi-card)</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Trabajadores', valor: '248', detalle: '+3 este mes' },
              { label: 'Asistencias hoy', valor: '231', detalle: '93% del padrón' },
              { label: 'Papeletas pendientes', valor: '12', detalle: '5 vencen hoy' },
              { label: 'Visitas activas', valor: '7', detalle: '2 sin salida' },
            ].map((kpi) => (
              <div key={kpi.label} className="kpi-card">
                <p className="text-xs font-medium uppercase tracking-wide text-content-secondary">
                  {kpi.label}
                </p>
                <p className="mt-2 text-3xl font-bold text-content-primary">{kpi.valor}</p>
                <p className="mt-1 text-xs text-content-secondary">{kpi.detalle}</p>
              </div>
            ))}
          </div>
        </Seccion>

        {/* ── 7. Tabla ───────────────────────────────────────── */}
        <Seccion
          numero={7}
          titulo="Tabla de ejemplo"
          descripcion="Header en surface-bg, filas en surface-card y hover en surface-bg. La columna Estado usa badges."
        >
          <div className="overflow-x-auto rounded-ds-md border border-line-light">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-bg text-xs uppercase tracking-wide text-content-secondary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Número</th>
                  <th className="px-4 py-3 font-semibold">Trabajador</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-light bg-surface-card">
                {filasTabla.map((fila) => (
                  <tr key={fila.numero} className="transition-colors hover:bg-surface-bg">
                    <td className="px-4 py-3 font-medium text-content-primary">{fila.numero}</td>
                    <td className="px-4 py-3 text-content-primary">{fila.trabajador}</td>
                    <td className="px-4 py-3 text-content-secondary">{fila.tipo}</td>
                    <td className="px-4 py-3">
                      <span className={fila.badge}>{fila.estado}</span>
                    </td>
                    <td className="px-4 py-3 text-content-secondary">{fila.fecha}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>

        {/* ── 8. Prohibiciones ───────────────────────────────── */}
        <Seccion
          numero={8}
          titulo="Combinaciones prohibidas"
          descripcion="No se renderizan como ejemplo real: se documentan con su ratio medido."
        >
          <div className="space-y-4">
            <div className="rounded-ds-md border-2 border-state-error-fg bg-surface-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge border border-state-error-fg bg-state-error-bg text-content-primary">
                  PROHIBIDO
                </span>
                <p className="text-sm font-semibold text-content-primary">
                  Nunca usar <code className="font-mono">text-white</code> sobre{' '}
                  <code className="font-mono">bg-brand-yellow</code>
                </p>
              </div>
              <p className="mt-2 text-sm text-content-secondary">
                Contraste medido: <strong className="text-content-primary">1.63:1</strong> (WCAG
                exige 4.5:1 para texto normal). Sobre amarillo usa siempre{' '}
                <code className="font-mono text-content-primary">text-content-onYellow</code>, que
                da 10.25:1.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="h-6 w-6 rounded-ds-sm border border-line-strong bg-brand-yellow" aria-hidden="true" />
                <span className="h-6 w-6 rounded-ds-sm border border-line-strong bg-content-inverse" aria-hidden="true" />
                <span className="text-xs text-content-secondary">#F5C518 + #FFFFFF = 1.63:1</span>
              </div>
            </div>

            <div className="rounded-ds-md border-2 border-state-error-fg bg-surface-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge border border-state-error-fg bg-state-error-bg text-content-primary">
                  PROHIBIDO
                </span>
                <p className="text-sm font-semibold text-content-primary">
                  Nunca usar <code className="font-mono">text-brand-yellow</code> sobre blanco puro
                </p>
              </div>
              <p className="mt-2 text-sm text-content-secondary">
                Contraste medido: <strong className="text-content-primary">1.63:1</strong>. Ni
                siquiera <code className="font-mono">brand-yellowDark</code> (#D4A800) alcanza AA
                sobre blanco (2.23:1): para texto usa #8A6D00 (4.92:1) o{' '}
                <code className="font-mono text-content-primary">text-content-secondary</code>{' '}
                (4.76:1).
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="h-6 w-6 rounded-ds-sm border border-line-strong bg-brand-yellow" aria-hidden="true" />
                <span className="h-6 w-6 rounded-ds-sm border border-line-strong bg-content-inverse" aria-hidden="true" />
                <span className="text-xs text-content-secondary">#F5C518 + #FFFFFF = 1.63:1</span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-content-secondary">
            Regla operativa: el amarillo es un color de <em>superficie y acento</em>, no de texto.
            Cuando necesites texto sobre amarillo, el único color permitido es navy
            (<code className="font-mono">text-content-onYellow</code>).
          </p>
        </Seccion>




      </div>
    </div>
  );
}




