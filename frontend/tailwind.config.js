/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Verde corporativo - color principal de marca
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        // Gris corporativo - usado en superficies, fondos y modo oscuro
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
          // ── Design System (tema claro institucional) ──
          bg: '#F5F7FA', // fondo del área de contenido
          card: '#FFFFFF', // cards
          sidebar: '#0A1D3D', // sidebar
          topbar: '#0A1D3D', // top bar
        },

        // ── Design System institucional (navy + amarillo + azul + blanco) ──
        // Se añaden junto a las escalas anteriores: ninguna se elimina.
        // Los tokens con dos palabras existen en camelCase (nombre oficial) y en
        // kebab-case (alias). Motivo: la especificación del design system usa
        // `bg-brand-blue-hover` en las clases y `blueHover` en el config; con los
        // alias ambos nombres funcionan y ningún `@apply` puede romperse.
        brand: {
          navy: '#0A1D3D', // sidebar, top bar, headings
          navyLight: '#1E3A5F', // hover de sidebar
          'navy-light': '#1E3A5F', // alias de navyLight
          yellow: '#F5C518', // acentos, badges, item activo del sidebar
          yellowDark: '#D4A800', // hover del amarillo
          'yellow-dark': '#D4A800', // alias de yellowDark
          blue: '#2563EB', // botones primarios, links
          blueHover: '#1D4ED8', // hover del azul
          'blue-hover': '#1D4ED8', // alias de blueHover
        },
        content: {
          primary: '#0F172A', // títulos, texto principal
          secondary: '#64748B', // subtítulos, texto secundario
          tertiary: '#94A3B8', // hints, placeholders
          inverse: '#FFFFFF', // texto sobre fondos oscuros
          onYellow: '#0A1D3D', // SIEMPRE sobre amarillo, NUNCA blanco
          'on-yellow': '#0A1D3D', // alias de onYellow
        },
        line: {
          light: '#E2E8F0', // bordes sutiles
          strong: '#CBD5E1', // bordes más visibles
        },
        state: {
          // success.fg pasó de #10B981 (2.31:1 sobre su propio fondo) a #047857 (4.99:1, AA).
          success: { bg: '#E8F8F0', fg: '#047857' },
          // warning.fg pasó de #D4A800 (2.12:1 sobre su propio fondo) a #8A6D00 (4.67:1, AA).
          warning: { bg: '#FEF9E7', fg: '#8A6D00' },
          // error.fg pasó de #EF4444 (3.76:1) → #DC2626 → #C81E1E
          // (5.74:1 con blanco en btn-danger, 4.93:1 sobre error-bg en badge-error).
          error: { bg: '#FEE9E9', fg: '#C81E1E' },
          info: { bg: '#E8F3FE', fg: '#2563EB' },
        },
      },
      // Radios del Design System, con prefijo `ds-` para NO colisionar con las
      // claves por defecto de Tailwind (`rounded-sm|md|lg|xl` siguen siendo
      // 2px/6px/8px/12px). Así las páginas aún no migradas conservan sus
      // esquinas originales y sólo las clases semánticas (.card, .btn,
      // .input-field) y los componentes `theme="light"` usan 14px/20px.
      borderRadius: {
        'ds-sm': '6px',
        'ds-md': '10px',
        'ds-lg': '14px',
        'ds-xl': '20px',
      },
      // Tampoco existía `boxShadow`.
      boxShadow: {
        card: '0 1px 3px rgba(15,23,42,0.05), 0 1px 2px rgba(15,23,42,0.03)',
        hover: '0 4px 12px rgba(15,23,42,0.08)',
        modal: '0 20px 50px rgba(15,23,42,0.15)',
      },
    },
  },
  plugins: [],
};
