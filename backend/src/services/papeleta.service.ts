// ===========================================================
// Servicio del módulo de papeletas: numeración, tokens,
// jerarquía de aprobación, bloqueos y timeout de revisión.
// ===========================================================

import { Rol, EstadoPapeleta, Prisma, Papeleta } from '@prisma/client';
import prisma from '../utils/prisma';
import { generarToken, generarTokenUnico } from '../utils/tokenGenerator';
import { bloquearRangoPapeleta } from './bloqueos.service';
import { notificar } from './notificacion.service';

/** Re-exportados para no romper a quienes ya importan estas funciones desde aquí. */
export { generarToken, generarTokenUnico };


/** Minutos que puede permanecer una papeleta EN_REVISION antes de expirar. */
export const MINUTOS_TIMEOUT_REVISION = 20;

/** Cliente de Prisma "normal" o el cliente de una transacción en curso. */
type ClientePrisma = typeof prisma | Prisma.TransactionClient;

/**
 * Error específico para cuando no se encuentra un aprobador disponible
 * para el rol del solicitante. Permite que el controller distinga este
 * caso (→ 400, mensaje de negocio) de otros errores inesperados (→ 500).
 */
export class AprobadorNoEncontradoError extends Error {}

/**
 * Calcula el siguiente número consecutivo anual de papeleta, con formato
 * "XXXX-YYYY". El consecutivo es global (no se reinicia por jefatura) y
 * se reinicia automáticamente cada año porque se busca solo entre los
 * números que terminan en "-{año}".
 *
 * Nota sobre concurrencia: esta función puede recibir el cliente de una
 * transacción de Prisma en curso (parámetro `cliente`). Llamarla dentro de
 * la misma transacción que crea la papeleta (ver crearPapeleta) reduce el
 * riesgo de que dos solicitudes simultáneas obtengan el mismo número,
 * aunque no lo elimina por completo a nivel de base de datos; para una
 * empresa de ~50 trabajadores este riesgo es aceptable en esta fase.
 */
export async function generarNumeroPapeleta(año: number, cliente: ClientePrisma = prisma): Promise<string> {
  const sufijo = `-${año}`;

  const papeletasDelAño = await cliente.papeleta.findMany({
    where: { numero: { endsWith: sufijo } },
    select: { numero: true },
  });

  let maxConsecutivo = 0;

  for (const { numero } of papeletasDelAño) {
    const [consecutivoStr] = numero.split('-');
    const consecutivo = Number(consecutivoStr);
    if (!Number.isNaN(consecutivo) && consecutivo > maxConsecutivo) {
      maxConsecutivo = consecutivo;
    }
  }

  const consecutivoFormateado = String(maxConsecutivo + 1).padStart(4, '0');
  return `${consecutivoFormateado}-${año}`;
}

/**
 * Determina el aprobador de una papeleta según el rol del solicitante:
 * - DIRECTORA: null (auto-aprobación, no necesita aprobador).
 * - ESPECIALISTA: su jefe inmediato (jefeId).
 * - JEFE: la Directora activa.
 * - VIGILANTE: el usuario de RRHH activo.
 * - RRHH / ADMIN: su jefe inmediato (jefeId, asignado vía su jefatura).
 *
 * Lanza AprobadorNoEncontradoError si no se puede determinar un aprobador
 * y el solicitante no es Directora.
 */
export async function determinarAprobador(solicitanteId: number): Promise<number | null> {
  const solicitante = await prisma.usuario.findUnique({
    where: { id: solicitanteId },
    include: { jefatura: true },
  });

  if (!solicitante) {
    throw new Error('Usuario solicitante no encontrado');
  }

  switch (solicitante.rol) {
    case Rol.DIRECTORA:
      return null;

    case Rol.ESPECIALISTA: {
      if (!solicitante.jefeId) {
        throw new AprobadorNoEncontradoError('El especialista no tiene un jefe asignado');
      }
      return solicitante.jefeId;
    }

    case Rol.JEFE: {
      const directora = await prisma.usuario.findFirst({
        where: { rol: Rol.DIRECTORA, activo: true },
      });
      if (!directora) {
        throw new AprobadorNoEncontradoError('No hay una Directora activa para aprobar la papeleta');
      }
      return directora.id;
    }

    case Rol.VIGILANTE: {
      const rrhh = await prisma.usuario.findFirst({
        where: { rol: Rol.RRHH, activo: true },
      });
      if (!rrhh) {
        throw new AprobadorNoEncontradoError('No hay un usuario de RRHH activo para aprobar la papeleta');
      }
      return rrhh.id;
    }

    case Rol.RRHH:
    case Rol.ADMIN: {
      if (!solicitante.jefeId) {
        throw new AprobadorNoEncontradoError('El usuario no tiene un jefe asignado en su jefatura');
      }
      return solicitante.jefeId;
    }

    default:
      throw new AprobadorNoEncontradoError('No se pudo determinar un aprobador para el rol del solicitante');
  }
}

/**
 * Placeholder de aplicación de bloqueos de asistencia al aprobar una
 * papeleta. El bloqueo real ya es efectivo en cuanto la papeleta queda
 * APROBADA (ver services/bloqueos.service.ts → verificarBloqueo, que
 * consulta directamente las papeletas aprobadas), así que aquí solo se
 * deja constancia explícita de este paso dentro del flujo de aprobación.
 */
export async function aplicarBloqueos(papeletaId: number): Promise<void> {
  await bloquearRangoPapeleta(papeletaId);
  console.log(`Bloqueos aplicados para papeleta ${papeletaId}`);
}

/** true si una papeleta EN_REVISION ya superó los 20 minutos desde fechaRevision. */
export function haExpiradoRevision(papeleta: {
  estado: EstadoPapeleta;
  fechaRevision: Date | null;
}): boolean {
  if (papeleta.estado !== EstadoPapeleta.EN_REVISION || !papeleta.fechaRevision) {
    return false;
  }
  const minutosTranscurridos = (Date.now() - papeleta.fechaRevision.getTime()) / (1000 * 60);
  return minutosTranscurridos > MINUTOS_TIMEOUT_REVISION;
}

/**
 * Si la papeleta dada tiene su revisión expirada, la revierte a PENDIENTE
 * de inmediato (limpiando fechaRevision) y notifica al solicitante.
 * Devuelve la papeleta actualizada (o la misma, sin cambios, si no había
 * expirado). Es genérica para poder usarse tanto con una Papeleta simple
 * como con una que incluya relaciones (solicitante, aprobador, etc.).
 */
export async function revertirSiExpiro<T extends Papeleta>(papeleta: T): Promise<T> {
  if (!haExpiradoRevision(papeleta)) {
    return papeleta;
  }

  const papeletaActualizada = await prisma.papeleta.update({
    where: { id: papeleta.id },
    data: { estado: EstadoPapeleta.PENDIENTE, fechaRevision: null },
  });

  notificar(
    papeleta.solicitanteId,
    `Su papeleta ${papeleta.numero} volvió a estado PENDIENTE porque el tiempo de revisión expiró.`,
  );

  // También se notifica al aprobador para que sepa que la papeleta volvió a cola
  if (papeleta.aprobadorId) {
    notificar(
      papeleta.aprobadorId,
      `La revisión de la papeleta ${papeleta.numero} expiró y volvió a estado PENDIENTE.`,
    );
  }

  return {
    ...papeleta,
    estado: papeletaActualizada.estado,
    fechaRevision: papeletaActualizada.fechaRevision,
  } as T;
}

/**
 * Job periódico: busca todas las papeletas EN_REVISION cuya fechaRevision
 * superó los 20 minutos y las revierte a PENDIENTE. Pensado para llamarse
 * cada 60 segundos desde un setInterval en server.ts.
 */
export async function revertirRevisionesExpiradas(): Promise<void> {
  const limite = new Date(Date.now() - MINUTOS_TIMEOUT_REVISION * 60 * 1000);

  const papeletasExpiradas = await prisma.papeleta.findMany({
    where: {
      estado: EstadoPapeleta.EN_REVISION,
      fechaRevision: { lte: limite },
    },
  });

  for (const papeleta of papeletasExpiradas) {
    await revertirSiExpiro(papeleta);
  }
}
