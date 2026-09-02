// ===========================================================
// Servicio de bloqueos por papeletas aprobadas
//
// Los bloqueos NO se materializan como registros en la base de datos:
// se calculan "al vuelo" verificando si existe una papeleta APROBADA
// del usuario cuyo rango (día completo u horas) contenga el timestamp
// que se quiere registrar o editar.
// ===========================================================

import { EstadoPapeleta, TipoTiempo } from '@prisma/client';
import prisma from '../utils/prisma';
import { obtenerRangoDelDia } from '../utils/fechas';

/**
 * Verifica si un timestamp dado cae dentro de un rango bloqueado por
 * alguna papeleta APROBADA del usuario (de día completo o de horas).
 *
 * - Papeleta de DIAS: bloquea el día calendario completo, desde el
 *   inicio del día de fechaInicio hasta el final del día de fechaFin.
 * - Papeleta de HORAS: bloquea el intervalo exacto horaSalida–horaRetorno.
 *
 * Si la papeleta es anulada (o cualquier otro estado distinto de
 * APROBADO), deja de considerarse aquí automáticamente: el bloqueo
 * "se libera" solo por el hecho de filtrar por estado: APROBADO.
 */
export async function verificarBloqueo(usuarioId: number, timestamp: Date): Promise<boolean> {
  const { inicio: inicioDelDia, fin: finDelDia } = obtenerRangoDelDia(timestamp);

  const papeletasAprobadas = await prisma.papeleta.findMany({
    where: {
      solicitanteId: usuarioId,
      estado: EstadoPapeleta.APROBADO,
      OR: [
        {
          tipoTiempo: TipoTiempo.DIAS,
          fechaInicio: { lte: finDelDia },
          fechaFin: { gte: inicioDelDia },
        },
        {
          tipoTiempo: TipoTiempo.HORAS,
          horaSalida: { lte: timestamp },
          horaRetorno: { gte: timestamp },
        },
      ],
    },
  });

  return papeletasAprobadas.some((papeleta) => {
    if (papeleta.tipoTiempo === TipoTiempo.DIAS) {
      // Bloquea el día completo, sin importar la hora exacta del movimiento
      const { inicio: inicioPapeleta } = obtenerRangoDelDia(papeleta.fechaInicio);
      const { fin: finPapeleta } = obtenerRangoDelDia(papeleta.fechaFin);
      return timestamp >= inicioPapeleta && timestamp <= finPapeleta;
    }

    // tipoTiempo === HORAS: bloquea el intervalo exacto horaSalida–horaRetorno
    if (!papeleta.horaSalida || !papeleta.horaRetorno) {
      return false;
    }
    return timestamp >= papeleta.horaSalida && timestamp <= papeleta.horaRetorno;
  });
}

/**
 * Función de utilidad semántica: no crea ningún registro en base de datos.
 * El bloqueo de un rango es implícito a partir de la existencia de una
 * papeleta APROBADA; verificarBloqueo() ya lo detecta automáticamente.
 *
 * Se deja este punto de extensión para que el servicio de aprobación de
 * papeletas (fase posterior) tenga un lugar claro donde, por ejemplo,
 * disparar una notificación o un evento de Socket.IO al activarse un bloqueo.
 */
export async function bloquearRangoPapeleta(papeletaId: number): Promise<void> {
  // No requiere escritura en base de datos: el bloqueo ya es efectivo en
  // cuanto la papeleta queda en estado APROBADO.
  return;
}

/**
 * Función de utilidad semántica: no elimina ningún registro en base de
 * datos, porque nunca se crearon registros de bloqueo explícitos.
 *
 * En cuanto la papeleta deja de estar en estado APROBADO (p. ej. pasa a
 * ANULADO), verificarBloqueo() deja de considerarla automáticamente, ya
 * que esa función solo evalúa papeletas con estado APROBADO. Es decir: el
 * bloqueo se "libera" solo por el cambio de estado, sin necesidad de
 * ninguna acción adicional sobre la base de datos.
 *
 * Esta función queda como punto de extensión explícito dentro del flujo
 * de anulación (ver anulacion.controller.ts → anularPapeleta), por si en
 * una fase futura se necesita, por ejemplo, emitir un evento de Socket.IO
 * para refrescar el dashboard de asistencias en tiempo real.
 */
export async function liberarBloqueoPapeleta(papeletaId: number): Promise<void> {
  console.log(`Bloqueos liberados para papeleta ${papeletaId}`);
}
