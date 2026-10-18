# SIGPER Design System

Base del tema claro institucional (navy + amarillo + azul + blanco) para SIGPER · UGEL Talara.
Esta fase **solo prepara tokens, clases y componentes base**: las páginas se rediseñan una por una
en prompts posteriores. Mientras eso no ocurra, el producto sigue viéndose con el tema oscuro.

- Tokens: `frontend/tailwind.config.js` → `theme.extend`
- Clases semánticas: `frontend/src/index.css` → `@layer components`
- Demo de verificación: ruta pública `/design-system`
- Componentes base: `Button`, `Input`, `Card` aceptan `theme?: 'dark' | 'light'` (default `'dark'`)

## Paleta

| Token | Hex | Uso |
|---|---|---|
| brand-navy | #0A1D3D | Sidebar, top bar, headings |
| brand-yellow | #F5C518 | Acentos, badges, item activo del sidebar |
| brand-blue | #2563EB | Botones primarios, links |
| surface-bg | #F5F7FA | Fondo del área de contenido |
| surface-card | #FFFFFF | Cards |
| content-primary | #0F172A | Texto principal |
| content-secondary | #64748B | Texto secundario |
| content-onYellow | #0A1D3D | Texto sobre amarillo (obligatorio) |

Paleta completa:

| Grupo | Token | Hex |
|---|---|---|
| Marca | brand-navy | #0A1D3D |
| Marca | brand-navyLight (\| `navy-light`) | #1E3A5F |
| Marca | brand-yellow | #F5C518 |
| Marca | brand-yellowDark (\| `yellow-dark`) | #D4A800 |
| Marca | brand-blue | #2563EB |
| Marca | brand-blueHover (\| `blue-hover`) | #1D4ED8 |
| Superficie | surface-bg | #F5F7FA |
| Superficie | surface-card | #FFFFFF |
| Superficie | surface-sidebar | #0A1D3D |
| Superficie | surface-topbar | #0A1D3D |
| Texto | content-primary | #0F172A |
| Texto | content-secondary | #64748B |
| Texto | content-tertiary | #94A3B8 |
| Texto | content-inverse | #FFFFFF |
| Texto | content-onYellow (\| `on-yellow`) | #0A1D3D |
| Línea | line-light | #E2E8F0 |
| Línea | line-strong | #CBD5E1 |
| Estado | state-success-bg / fg | #E8F8F0 / #047857 |
| Estado | state-warning-bg / fg | #FEF9E7 / #8A6D00 |
| Estado | state-error-bg / fg | #FEE9E9 / #C81E1E |
| Estado | state-info-bg / fg | #E8F3FE / #2563EB |

> Nomenclatura: los tokens de dos palabras se definen en camelCase (`bg-brand-navyLight`,
> `text-content-onYellow`) y además tienen alias kebab-case (`bg-brand-navy-light`,
> `text-content-on-yellow`). Ambas formas generan la misma clase; usa la que prefieras, pero no
> mezcles ambas en un mismo archivo.

Radios: `rounded-ds-sm` 6px · `rounded-ds-md` 10px · `rounded-ds-lg` 14px · `rounded-ds-xl` 20px.
Las claves llevan prefijo **`ds-`** para no colisionar con las de Tailwind: `rounded-sm|md|lg|xl`
siguen valiendo 2px/6px/8px/12px, así que las páginas no migradas conservan sus esquinas exactas.
Solo las clases semánticas (`.card`, `.btn`, `.input-field`) y los componentes con `theme="light"`
usan los radios `ds-*`.
Sombras: `shadow-card`, `shadow-hover`, `shadow-modal`.

## Reglas de contraste

Medidas con la fórmula WCAG 2.1 (las cifras de la demo se calculan en tiempo real, no están
hardcodeadas):

- Navy sobre blanco → **16.72:1** (AAA)
- Amarillo sobre navy → **10.26:1** (AAA)
- Navy sobre amarillo → **10.26:1** (AAA)
- Azul sobre blanco → **5.17:1** (AA)
- Gris secundario sobre blanco → **4.76:1** (AA)
- Gris terciario sobre blanco → **2.56:1** (solo pistas/placeholders, nunca información crítica)
- warning-fg (#8A6D00) sobre warning-bg (#FEF9E7) → **4.67:1** (AA)
- success-fg (#047857) sobre success-bg (#E8F8F0) → **4.99:1** (AA)
- success-fg (#047857) sobre blanco → **5.48:1** (AA)
- error-fg (#C81E1E) sobre error-bg (#FEE9E9) → **4.93:1** (AA)
- Blanco sobre error-fg (#C81E1E) → **5.74:1** (AA)
- PROHIBIDO: blanco sobre amarillo → **1.63:1**
- PROHIBIDO: amarillo sobre blanco → **1.63:1**

Reglas duras:

1. Sobre `bg-brand-yellow` el único color de texto permitido es `text-content-onYellow` (navy).
2. El amarillo nunca se usa como color de texto sobre blanco.
3. `#D4A800` (brand-yellowDark) **no** es una alternativa válida para texto: mide 2.23:1 sobre
   blanco. Es un color de superficie/hover, no de texto.

### Correcciones de accesibilidad aplicadas

| Combinación | Antes | Ahora | Nivel |
|---|---|---|---|
| warning-fg sobre warning-bg | #D4A800 / #FEF9E7 = 2.12:1 | #8A6D00 / #FEF9E7 = 4.67:1 | AA |
| error-fg sobre error-bg (`badge-error`) | #DC2626 / #FEE9E9 = 4.15:1 | #C81E1E / #FEE9E9 = 4.93:1 | AA |
| Blanco sobre error-fg (`btn-danger`) | #FFFFFF / #DC2626 = 4.83:1 | #FFFFFF / #C81E1E = 5.74:1 | AA |
| success-fg sobre success-bg (`badge-success`) | #10B981 / #E8F8F0 = 2.31:1 | #047857 / #E8F8F0 = 4.99:1 | AA |
| success-fg sobre blanco | #10B981 / #FFFFFF = 2.54:1 | #047857 / #FFFFFF = 5.48:1 | AA |

Solo cambiaron los `fg` de estado (`warning.fg`, `error.fg` y `success.fg`). Los fondos soft
(`#E8F8F0`, `#FEF9E7`, `#FEE9E9`, `#E8F3FE`) y el amarillo de marca (`#F5C518`) no se tocaron:
todo lo que consume los tokens (`badge-*`, `btn-danger`, `input-field-error`, el borde de error de
`Input theme="light"`) se actualiza automáticamente, sin hex duplicados en CSS.

> Todos los pares fondo/texto usados por las clases semánticas del DS (`.badge-*`, `.btn-*`,
> `.input-field-error`, `.card`) cumplen WCAG AA (≥ 4.5:1) para texto normal. Las excepciones
> conocidas son: `content-tertiary` (#94A3B8, 2.56:1 sobre blanco), usado solo para hints/captions
> no críticos, y el par `brand-yellow` / `content-inverse` (prohibido por regla del DS).

## Cómo usar los componentes

### Botones

```tsx
<Button variant="primary" theme="light">Guardar</Button>
<Button variant="secondary" theme="light">Cancelar</Button>
<Button variant="danger" theme="light">Eliminar</Button>
<Button variant="ghost" theme="light">Volver</Button>
```

Sin `theme` el botón se ve **exactamente** como antes (`theme="dark"` por defecto). Se aceptan
`variant`/`variante`, `size`/`tamano`, `cargando`, `icono`, `iconoDerecho` y `fullWidth`.

### Cards

```tsx
<Card theme="light" titulo="Título opcional">Contenido</Card>
```

### Inputs

```tsx
<Input label="Email" icono={<EnvelopeIcon />} theme="light" />
```

El `Input` mantiene `label`, `error` e `icono`. `error` cambia el borde a `state-error-fg` y muestra
el mensaje debajo.

### Badges

```tsx
<span className="badge-success">Activo</span>
<span className="badge-error">Rechazado</span>
```

### Clases semánticas disponibles

| Clase | Uso |
|---|---|
| `card` / `card-hover` / `kpi-card` | Superficie blanca + borde + `shadow-card` |
| `btn` + `btn-primary`\|`secondary`\|`danger`\|`ghost` | Botón sin componente |
| `btn-sm` \| `btn-md` \| `btn-lg` | Tamaños de botón |
| `input-field` / `input-field-error` | Campo de texto |
| `badge` + `badge-success`\|`warning`\|`error`\|`info` | Píldoras de estado |
| `heading-1` \| `heading-2` \| `heading-3` | Títulos |
| `body-text` \| `body-muted` \| `caption` | Párrafos y texto auxiliar |

Tailwind solo emite las clases semánticas que aparecen en algún archivo (purge). Si aplicas una
clase a un elemento que no la usaba antes, el CSS se regenera en el siguiente build.

## Migración de páginas

El rediseño se hace una página a la vez. En cada página:

1. Cambiar el contenedor principal a `bg-surface-bg`.
2. Cambiar el texto a `text-content-primary` / `text-content-secondary`.
3. Pasar `theme="light"` a todos los `<Button>`, `<Input>` y `<Card>`.
4. Reemplazar clases duras (`bg-gray-800`) por tokens (`bg-surface-card`).
5. Reemplazar badges `bg-emerald-900/50 text-emerald-400` por `badge-success`, etc.

Las páginas no rediseñadas siguen viéndose como antes (tema oscuro) y siguen funcionando, porque
`theme="dark"` es el default y `body` conserva `#111827` / `#f3f4f6`.

Checklist por página:

- [ ] Contenedor en `bg-surface-bg` y `max-w-*` consistente.
- [ ] Ni una clase `bg-gray-*`, `text-gray-*` o `border-gray-*` en la página migrada.
- [ ] Sin `text-white` sobre `bg-brand-yellow`.
- [ ] Focus visible en todos los controles (lo aporta `theme="light"`).
- [ ] Tables: header `bg-surface-bg`, filas `bg-surface-card`, hover `hover:bg-surface-bg`.

## Verificación

1. `cd frontend && npm run build` → debe terminar en `EXITCODE=0`.
2. Abrir `/design-system` (ruta pública, sin login) y revisar las 8 secciones.
3. Abrir páginas no migradas y confirmar que no cambió nada.
4. En DevTools: un `rounded-lg` de una página no migrada mide `border-radius: 8px`; `.card`, `.btn`
   y `.input-field` miden `14px`. Cualquier otro valor en un `rounded-*` suelto es una regresión.

La demo calcula los ratios de contraste en el cliente con la fórmula WCAG, de modo que cualquier
cambio de hex en `tailwind.config.js` que rompa un contraste se ve inmediatamente al recargar.

