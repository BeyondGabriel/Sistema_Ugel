// ===========================================================
// Verificación de src/utils/fechaHora.ts
// ===========================================================
// Ejecuta casos de aceptación sobre el archivo TS real (lo transpila
// en memoria) en la zona horaria indicada por la variable TZ.
//
// Uso:
//   node scripts/verificar-fechahora.mjs                  (zona del sistema)
//   $env:TZ='America/Lima'; node scripts/verificar-fechahora.mjs
// ===========================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const raizFrontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const origen = path.join(raizFrontend, 'src', 'utils', 'fechaHora.ts');
const destino = path.join(os.tmpdir(), `verificar-fechahora-${process.pid}.cjs`);
const compilado = ts.transpileModule(fs.readFileSync(origen, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
fs.writeFileSync(destino, compilado.outputText);

const {
  extraerHoraLocal,
  extraerFechaLocal,
  fechaHoyLocal,
  fechaHaceDiasLocal,
  fechaHaceMesesLocal,
  valorLocalParaInput,
} = require(destino);

const tz = process.env.TZ ?? '(del sistema)';
const offset = new Date().getTimezoneOffset();
const esLima = offset === 300;
console.log(`TZ=${tz}  offset=${offset} min  (se esperan valores en la zona del proceso)`);

/** Componentes locales calculados directamente con Date, como referencia. */
function partesLocales(iso) {
  const d = new Date(iso);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return {
    fecha: `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    hora: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

// ── 1. La conversión debe coincidir con los componentes locales de Date
for (const iso of [
  '2026-10-16T15:00:00.000Z',
  '2026-10-16T04:00:00.000Z',
  '2026-10-17T04:59:00.000Z',
  '2026-10-17T05:00:00.000Z',
  '2026-01-01T00:00:00.000Z',
  '2026-12-31T23:59:00.000Z',
]) {
  const esperado = partesLocales(iso);
  assert.equal(extraerHoraLocal(iso), esperado.hora, `hora de ${iso}`);
  assert.equal(extraerFechaLocal(iso), esperado.fecha, `fecha de ${iso}`);
}

// ── 2. Normalización de medianoche (24:00 → 00:00) y formato HH:mm
assert.match(extraerHoraLocal('2026-10-17T05:00:00.000Z'), /^(0\d|1\d|2[0-3]):[0-5]\d$/);
assert.notEqual(extraerHoraLocal('2026-10-17T05:00:00.000Z'), '24:00');

// ── 3. Entradas inválidas → cadena vacía (no lanza)
assert.equal(extraerHoraLocal('no-es-fecha'), '');
assert.equal(extraerFechaLocal(''), '');
assert.equal(extraerFechaLocal('no-es-fecha'), '');
assert.equal(valorLocalParaInput('no-es-fecha'), '');

// ── 4. Helpers de "hoy" / relativos, calculados en la zona del proceso
function fechaRelativa(ajustar) {
  const d = new Date();
  ajustar(d);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
assert.equal(fechaHoyLocal(), fechaRelativa(() => {}));
assert.equal(fechaHaceDiasLocal(30), fechaRelativa((d) => d.setDate(d.getDate() - 30)));
assert.equal(fechaHaceDiasLocal(7), fechaRelativa((d) => d.setDate(d.getDate() - 7)));
assert.equal(fechaHaceMesesLocal(1), fechaRelativa((d) => d.setMonth(d.getMonth() - 1)));

// ── 5. valorLocalParaInput: ida y vuelta sin desplazamiento
for (const iso of ['2026-10-16T15:00:00.000Z', '2026-10-17T04:59:00.000Z', '2026-10-17T05:00:00.000Z']) {
  const valorInput = valorLocalParaInput(iso);
  assert.match(valorInput, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.equal(
    new Date(valorInput).toISOString(),
    iso,
    `${iso}: el valor del input debe reparsearse como el mismo instante`,
  );
}

// ── 6. ACEPTACIÓN A: papeleta HORAS 10:00 → 12:00 (flujo normal, ida y vuelta)
// Envío: <input type="date"> + <input type="time"> → ISO UTC (ruta de envío actual)
const fechaHoras = '2026-10-16';
const envioSalida = new Date(`${fechaHoras}T10:00:00`).toISOString();
const envioRetorno = new Date(`${fechaHoras}T12:00:00`).toISOString();
// Relectura al editar: lo que muestra el formulario
assert.equal(extraerFechaLocal(envioSalida), fechaHoras);
assert.equal(extraerHoraLocal(envioSalida), '10:00');
assert.equal(extraerHoraLocal(envioRetorno), '12:00');
console.log(
  `  A) 10:00→12:00  envío=${envioSalida}\n` +
    `     antes (slice UTC): ${envioSalida.slice(11, 16)}   ahora (local): ${extraerHoraLocal(envioSalida)}`,
);

// ── 6b. ACEPTACIÓN A2: papeleta DIAS (fecha inicio/fin, ida y vuelta)
// Envío actual: new Date(`${fecha}T00:00:00`).toISOString()  (medianoche local)
const envioFechaDIAS = new Date(`${fechaHoras}T00:00:00`).toISOString();
assert.equal(extraerFechaLocal(envioFechaDIAS), fechaHoras, 'la fecha DIAS debe volver igual');
console.log(
  `  A2) DIAS       envío=${envioFechaDIAS}\n` +
    `     antes (slice UTC): ${envioFechaDIAS.slice(0, 10)}   ahora (local): ${extraerFechaLocal(envioFechaDIAS)}`,
);

// ── 7. ACEPTACIÓN B: caso borde 23:00 → 23:59 (cruce de medianoche en UTC)
const envioSalidaB = new Date(`${fechaHoras}T23:00:00`).toISOString();
const envioRetornoB = new Date(`${fechaHoras}T23:59:00`).toISOString();
assert.equal(extraerHoraLocal(envioSalidaB), '23:00');
assert.equal(extraerHoraLocal(envioRetornoB), '23:59');
assert.equal(extraerFechaLocal(envioSalidaB), fechaHoras, 'el día local no debe saltar');
console.log(
  `  B) 23:00→23:59  envío=${envioSalidaB}\n` +
    `     antes (slice UTC): ${envioSalidaB.slice(0, 10)} ${envioSalidaB.slice(11, 16)}   ahora (local): ${extraerFechaLocal(envioSalidaB)} ${extraerHoraLocal(envioSalidaB)}`,
);

// ── 8. Filtros de listados: el día del filtro es el día local
assert.equal(fechaHoyLocal(), fechaRelativa(() => {}));

// ── 9. Valores concretos de Perú (UTC-5) para el reporte
if (esLima) {
  assert.equal(extraerHoraLocal('2026-10-16T15:00:00.000Z'), '10:00');
  assert.equal(extraerFechaLocal('2026-10-16T04:00:00.000Z'), '2026-10-15');
  assert.equal(extraerHoraLocal('2026-10-17T05:00:00.000Z'), '00:00');
  console.log('  C) Perú (UTC-5): 15:00Z → 10:00 · 04:00Z → día anterior · 05:00Z → 00:00');
}

console.log(`\n✅ Todas las verificaciones pasaron con TZ=${tz} (offset ${offset} min)`);
fs.rmSync(destino, { force: true });
