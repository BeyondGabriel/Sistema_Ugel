// ===========================================================
// Utilidades de fecha y hora del frontend
// ===========================================================
//
// El backend (Prisma/MySQL) devuelve los campos DateTime como ISO 8601
// en UTC, por ejemplo "2026-10-16T15:00:00.000Z". Extraer la hora o la
// fecha con .slice() toma los componentes en UTC, no en la zona horaria
// del navegador, lo que produce desplazamientos: un usuario en Perú
// (UTC-5) que registró las "10:00" vuelve a ver "15:00".
//
// Estas funciones centralizan la conversión a la zona horaria local del
// navegador usando el API nativo de Date + Intl. No hay offsets fijos ni
// librerías externas: si un usuario accede desde otra zona horaria, los
// valores se muestran en SU zona horaria.

const LOCALE = 'es-PE';

/** Opciones de formato para las horas (24h → HH:mm). */
const OPCIONES_HORA: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

/** Opciones de formato para las fechas numéricas. */
const OPCIONES_FECHA: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

/**
 * Formatea un Date como "HH:mm" en la zona horaria local del navegador.
 * Función interna: siempre se invoca con un Date válido.
 */
function horaLocalDe(fecha: Date): string {
  // hour12:false puede devolver "24:00" para la medianoche en algunos
  // motores, por eso se normaliza a "00:00". También se descartan los
  // sufijos que ciertas configuraciones regionales añaden ("10:00 a. m.").
  return fecha
    .toLocaleTimeString(LOCALE, OPCIONES_HORA)
    .replace(/^24:00/, '00:00')
    .replace(/[^\d:]/g, '');
}

/**
 * Formatea un Date como "YYYY-MM-DD" (formato que espera
 * <input type="date">) en la zona horaria local del navegador.
 * Función interna: siempre se invoca con un Date válido.
 */
function fechaLocalDe(fecha: Date): string {
  // es-PE devuelve DD/MM/YYYY; se normaliza a YYYY-MM-DD.
  const [dia, mes, anio] = fecha
    .toLocaleDateString(LOCALE, OPCIONES_FECHA)
    .split(/[^\d]+/)
    .filter((parte) => parte.length > 0);

  if (!dia || !mes || !anio) return '';

  return `${anio.padStart(4, '0')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

/**
 * Extrae la hora "HH:mm" de un ISO 8601 UTC, expresada en la zona
 * horaria local del navegador.
 *
 * Ej: extraerHoraLocal('2026-10-16T15:00:00.000Z') → '10:00' (UTC-5).
 * Devuelve '' si el valor no es una fecha válida.
 */
export function extraerHoraLocal(isoString: string): string {
  const fecha = new Date(isoString);
  if (Number.isNaN(fecha.getTime())) return '';
  return horaLocalDe(fecha);
}

/**
 * Extrae la fecha "YYYY-MM-DD" de un ISO 8601 UTC, expresada en la zona
 * horaria local del navegador.
 *
 * Ej: extraerFechaLocal('2026-10-16T04:00:00.000Z') → '2026-10-15' (UTC-5).
 * Devuelve '' si el valor no es una fecha válida.
 */
export function extraerFechaLocal(isoString: string): string {
  const fecha = new Date(isoString);
  if (Number.isNaN(fecha.getTime())) return '';
  return fechaLocalDe(fecha);
}

/** Fecha de hoy "YYYY-MM-DD" en la zona horaria local del navegador. */
export function fechaHoyLocal(): string {
  return fechaLocalDe(new Date());
}

/** Fecha "YYYY-MM-DD" de hace `dias` días en la zona horaria local. */
export function fechaHaceDiasLocal(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return fechaLocalDe(fecha);
}

/** Fecha "YYYY-MM-DD" de hace `meses` meses en la zona horaria local. */
export function fechaHaceMesesLocal(meses: number): string {
  const fecha = new Date();
  fecha.setMonth(fecha.getMonth() - meses);
  return fechaLocalDe(fecha);
}

/**
 * Convierte un ISO 8601 UTC al valor que espera un
 * `<input type="datetime-local">`: "YYYY-MM-DDTHH:mm" en la zona horaria
 * local del navegador.
 *
 * Se usan los getters locales de Date (no Intl) porque aquí el resultado
 * se vuelve a parsear como fecha local: `new Date(valor)` interpreta el
 * formato sin zona horaria como hora local, con lo que el ciclo
 * mostrar → editar → enviar no desplaza la hora.
 *
 * Devuelve '' si el valor no es una fecha válida.
 */
export function valorLocalParaInput(isoString: string): string {
  const fecha = new Date(isoString);
  if (Number.isNaN(fecha.getTime())) return '';

  const anio = String(fecha.getFullYear()).padStart(4, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  const hora = String(fecha.getHours()).padStart(2, '0');
  const minuto = String(fecha.getMinutes()).padStart(2, '0');

  return `${anio}-${mes}-${dia}T${hora}:${minuto}`;
}
