// ===========================================================
// Servicio de anulación de papeletas: ventana temporal flexible,
// cierre automático de solicitudes vencidas y alertas previas al cierre.
// ===========================================================

import { EstadoPapeleta, TipoTiempo, TipoMovimiento, Papeleta } from '@prisma/client';
import prisma from '../utils/prisma';
import { obtenerRangoDelDia } from '../utils/fechas';
import { notificar } from './notificacion.service';

export interface ResultadoPuedeAnular {
  permitido: boolean;
  razon?: string;
}

/**
 * Determina si una papeleta APROBADA (o ANULACION_SOLICITADA) todavía
 * puede anularse, según su tipo:
 * - DIAS: mientras no se haya alcanzado fechaInicio.
 * - HORAS: mientras el trabajador no haya regresado (no existe una
 *   ENTRADA ese día con timestamp >= horaRetorno).
 * El Admin no tiene esta restricción (siempre permitido, esAdmin=true).
 *
 * Nota: el prompt describe la firma sin Promise, pero la regla de HORAS
 * necesita consultar el último movimiento del día en base de datos, así
 * que esta función es async por necesidad práctica (igual que ocurrió
 * con generarToken/generarTokenUnico en la Fase 3).
 */
export async function puedeAnular(papeleta: Papeleta, esAdmin: boolean): Promise<ResultadoPuedeAnular> {
  if (esAdmin) {
    return { permitido: true };
  }

  if (papeleta.tipoTiempo === TipoTiempo.DIAS) {
    if (new Date() < papeleta.fechaInicio) {
      return { permitido: true };
    }
    return { permitido: false, razon: 'Ya se alcanzó la fecha de inicio de la papeleta; no se puede anular' };
  }

  // tipoTiempo === HORAS
  if (!papeleta.horaRetorno) {
    // No debería ocurrir en una papeleta de tipo HORAS, pero ante un dato
    // incompleto se prefiere permitir la anulación antes que bloquearla.
    return { permitido: true };
  }

  const { inicio, fin } = obtenerRangoDelDia(papeleta.fechaInicio);

  const ultimoMovimiento = await prisma.movimiento.findFirst({
    where: {
      usuarioId: papeleta.solicitanteId,
      timestamp: { gte: inicio, lte: fin },
    },
    orderBy: { timestamp: 'desc' },
  });

  const yaRegreso =
    ultimoMovimiento?.tipo === TipoMovimiento.ENTRADA && ultimoMovimiento.timestamp >= papeleta.horaRetorno;

  if (yaRegreso) {
    return { permitido: false, razon: 'El trabajador ya registró su regreso; no se puede anular' };
  }

  return { permitido: true };
}

/**
 * Job periódico: revisa todas las papeletas en ANULACION_SOLICITADA y, si
 * la ventana de anulación ya se cerró, las revierte automáticamente a
 * APROBADO (la solicitud de anulación queda cancelada implícitamente).
 */
export async function cerrarSolicitudesExpiradas(): Promise<void> {
  const solicitudes = await prisma.papeleta.findMany({
    where: { estado: EstadoPapeleta.ANULACION_SOLICITADA },
  });

  for (const papeleta of solicitudes) {
    const resultado = await puedeAnular(papeleta, false);

    if (!resultado.permitido) {
      await prisma.papeleta.update({
        where: { id: papeleta.id },
        data: { estado: EstadoPapeleta.APROBADO },
      });

      notificar(
        papeleta.solicitanteId,
        `La ventana para anular su papeleta ${papeleta.numero} se cerró. La solicitud de anulación fue cancelada automáticamente y la papeleta vuelve a estar APROBADA.`,
      );

      if (papeleta.aprobadorId) {
        notificar(
          papeleta.aprobadorId,
          `La solicitud de anulación de la papeleta ${papeleta.numero} fue cancelada automáticamente porque se cerró la ventana de tiempo.`,
        );
      }
    }
  }
}

/** Momento en que se cierra la ventana de anulación de una papeleta. */
function calcularCierreVentana(papeleta: Papeleta): Date | null {
  if (papeleta.tipoTiempo === TipoTiempo.DIAS) {
    return papeleta.fechaInicio;
  }
  return papeleta.horaRetorno ?? null;
}

const MS_VENTANA_ALERTA = 60 * 60 * 1000; // alerta cuando falta 1 hora o menos
const MS_REPETICION_ALERTA = 20 * 60 * 1000; // repetir cada 20 minutos

/**
 * Registro en memoria de la última vez que se alertó sobre cada papeleta.
 * Es deliberadamente un Map en memoria de proceso (no una tabla en BD):
 * para un servidor único de ~50 usuarios es más que suficiente, y evita
 * tener que añadir una columna solo para esto. Si el proceso se reinicia,
 * en el peor caso se reenvía una alerta antes de tiempo; sin impacto real.
 */
const ultimaAlertaEnviada = new Map<number, number>();

/**
 * Para papeletas en ANULACION_SOLICITADA, si queda 1 hora o menos para que
 * se cierre la ventana de anulación, notifica al jefe y al solicitante.
 * La alerta se repite cada 20 minutos mientras la solicitud siga abierta y
 * la ventana no se haya cerrado.
 */
export async function verificarYNotificarVentanaAnulacion(): Promise<void> {
  const solicitudes = await prisma.papeleta.findMany({
    where: { estado: EstadoPapeleta.ANULACION_SOLICITADA },
  });

  const idsActivos = new Set(solicitudes.map((p) => p.id));

  // Limpia del Map las solicitudes que ya no están activas (se resolvieron
  // o se cerraron), para no acumular memoria indefinidamente.
  for (const idRegistrado of ultimaAlertaEnviada.keys()) {
    if (!idsActivos.has(idRegistrado)) {
      ultimaAlertaEnviada.delete(idRegistrado);
    }
  }

  for (const papeleta of solicitudes) {
    const cierreVentana = calcularCierreVentana(papeleta);
    if (!cierreVentana) {
      continue;
    }

    const msRestantes = cierreVentana.getTime() - Date.now();

    // Si ya se cerró la ventana, no se alerta aquí: cerrarSolicitudesExpiradas()
    // se encarga de revertir la papeleta a APROBADO en ese caso.
    if (msRestantes <= 0 || msRestantes > MS_VENTANA_ALERTA) {
      continue;
    }

    const ultimaAlerta = ultimaAlertaEnviada.get(papeleta.id);
    const debeAlertar = ultimaAlerta === undefined || Date.now() - ultimaAlerta >= MS_REPETICION_ALERTA;

    if (!debeAlertar) {
      continue;
    }

    const minutosRestantes = Math.max(0, Math.round(msRestantes / (60 * 1000)));
    const mensaje = `La ventana para anular la papeleta ${papeleta.numero} cierra en aproximadamente ${minutosRestantes} minutos.`;

    notificar(papeleta.solicitanteId, mensaje);
    if (papeleta.aprobadorId) {
      notificar(papeleta.aprobadorId, mensaje);
    }

    ultimaAlertaEnviada.set(papeleta.id, Date.now());
  }
}
