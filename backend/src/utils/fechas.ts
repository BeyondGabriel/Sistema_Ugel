// ===========================================================
// Utilidades para cálculo de rangos de fechas
// ===========================================================

/**
 * Dada una fecha, devuelve el inicio (00:00:00.000) y el fin
 * (23:59:59.999) del día calendario al que pertenece.
 * Útil para acotar consultas "todos los movimientos de hoy/de tal día".
 */
export function obtenerRangoDelDia(fecha: Date): { inicio: Date; fin: Date } {
  const inicio = new Date(fecha);
  inicio.setHours(0, 0, 0, 0);

  const fin = new Date(fecha);
  fin.setHours(23, 59, 59, 999);

  return { inicio, fin };
}

/**
 * Convierte una fecha ya validada (YYYY-MM-DD) a un Date con hora local.
 * Si `finDelDia` es true, la hora se fija a 23:59:59.999.
 *
 * Es un mapeo de formato (no valida), pensado para usarse sobre entradas
 * que ya fueron verificadas por Zod.
 */
export function parseFechaLocal(fecha: string, finDelDia = false): Date {
  const [y, m, d] = fecha.split('-').map(Number);

  if (finDelDia) {
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }

  return new Date(y, m - 1, d);
}
