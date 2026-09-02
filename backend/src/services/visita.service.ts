// ===========================================================
// Servicio del módulo de visitas
// ===========================================================

import { TipoMovimiento } from '@prisma/client';
import prisma from '../utils/prisma';
import { obtenerRangoDelDia } from '../utils/fechas';

/**
 * Verifica si un trabajador está presente en la sede en este momento:
 * true si su último movimiento del día de hoy es de tipo ENTRADA.
 * Reutiliza exactamente el mismo criterio que el módulo de asistencias
 * (Fase 2, obtenerPresencia) para no duplicar la regla de negocio.
 */
export async function verificarPresencia(usuarioId: number): Promise<boolean> {
  const { inicio, fin } = obtenerRangoDelDia(new Date());

  const ultimoMovimiento = await prisma.movimiento.findFirst({
    where: {
      usuarioId,
      timestamp: { gte: inicio, lte: fin },
    },
    orderBy: { timestamp: 'desc' },
  });

  return ultimoMovimiento?.tipo === TipoMovimiento.ENTRADA;
}

// Nota: el prompt de esta fase menciona, como punto opcional, una función
// exportarVisitas(filtros) a modo de placeholder para la exportación a
// Excel. El propio prompt indica "si prefieres, lo dejamos para la Fase 6"
// (reportes); se deja fuera de esta fase para no introducir lógica de
// filtros duplicada que tendría que rehacerse cuando se defina el formato
// real del reporte.
