// ===========================================================
// Servicio del módulo de vacaciones
//
// Concentra la lógica de negocio pura del reglamento interno de
// vacaciones: disponibilidad de saldo, límite de fraccionamiento en
// medios días y exigencia del bloque principal de 7 días calendario.
//
// El controlador (vacacion.controller.ts) se limita a orquestar la
// persistencia y las notificaciones; cualquier rechazo de negocio se
// comunica mediante VacacionError para que el controlador traduzca el
// error a la respuesta HTTP correspondiente.
// ===========================================================

import { Prisma, TipoVacacion, EstadoSolicitudVacacion } from '@prisma/client';
import prisma from '../utils/prisma';

/** Error de negocio del módulo de vacaciones (mensaje apto para el cliente). */
export class VacacionError extends Error {
  constructor(public mensaje: string, public statusCode: number = 400) {
    super(mensaje);
    this.name = 'VacacionError';
  }
}

/** Estados de solicitud que ya comprometen saldo del trabajador. */
const ESTADOS_VIGENTES: EstadoSolicitudVacacion[] = [
  EstadoSolicitudVacacion.APROBADA,
  EstadoSolicitudVacacion.CON_VB,
];

/** Máximo de días de saldo consumibles mediante fraccionamiento (medios días). */
const LIMITE_FRACCIONAMIENTO = 7.0;

/** Mínimo de días calendario del primer bloque continuo del año. */
const MINIMO_BLOQUE_PRINCIPAL = 7;

/**
 * Convierte un valor Decimal de Prisma (o null/undefined) a número.
 * Se usa para poder comparar y sumar sin arrastrar la aritmética de Decimal.
 */
function aNumero(valor: Prisma.Decimal | number | null | undefined): number {
  return Number(valor ?? 0);
}

/** Redondea a 2 decimales para evitar ruido de coma flotante (6.999999...). */
function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Rango [1 de enero, 31 de diciembre] del año indicado. */
function rangoDelAnio(anio: number): { inicio: Date; fin: Date } {
  return {
    inicio: new Date(anio, 0, 1),
    fin: new Date(anio, 11, 31, 23, 59, 59, 999),
  };
}

/**
 * Obtiene el saldo de un trabajador para un año específico.
 *
 * Devuelve el registro de VacacionSaldo junto con `diasPendientes`
 * (diasGanados - diasUsados), que es el saldo realmente disponible.
 */
export async function obtenerSaldo(usuarioId: number, anio: number) {
  const saldo = await prisma.vacacionSaldo.findUnique({
    where: { usuarioId_anio: { usuarioId, anio } },
  });

  if (!saldo) {
    throw new VacacionError(`No hay saldo registrado para el año ${anio}`, 404);
  }

  const pendientes = redondear2(aNumero(saldo.diasGanados) - aNumero(saldo.diasUsados));

  return { ...saldo, diasPendientes: pendientes };
}

/**
 * Valida las reglas del reglamento antes de crear una solicitud:
 *
 * 1. Saldo suficiente para cubrir los días que se descontarían.
 * 2. Fraccionamiento: los medios días vigentes del año no pueden superar
 *    el equivalente a 7 días hábiles (14 medios días).
 * 3. Bloque principal: la primera solicitud del año, si es de día completo,
 *    debe ser continua y de al menos 7 días calendario (Art. 43.1).
 *
 * Lanza VacacionError con el detalle del incumplimiento.
 */
export async function validarReglasNegocio(
  usuarioId: number,
  anio: number,
  tipo: TipoVacacion,
  fechaInicio: Date,
  fechaFin: Date,
  diasDescontados: number
): Promise<void> {
  const saldo = await obtenerSaldo(usuarioId, anio);

  // 1. Validar saldo suficiente
  if (aNumero(diasDescontados) > saldo.diasPendientes) {
    throw new VacacionError(
      `Saldo insuficiente. Tienes ${saldo.diasPendientes} días disponibles.`,
      400
    );
  }

  const { inicio: inicioDelAnio, fin: finDelAnio } = rangoDelAnio(anio);

  // Solicitudes del año que ya comprometen saldo (aprobadas o con VoBo).
  const solicitudesVigentes = await prisma.solicitudVacacion.findMany({
    where: {
      solicitanteId: usuarioId,
      estado: { in: ESTADOS_VIGENTES },
      fechaInicio: { gte: inicioDelAnio, lte: finDelAnio },
    },
    select: { tipo: true, diasDescontados: true },
  });

  // 2. Validar regla de fraccionamiento (máximo 7 días hábiles / 7.0 en saldo)
  if (tipo === TipoVacacion.MEDIO_DIA) {
    const usadoEnMediosDias = redondear2(
      solicitudesVigentes
        .filter((solicitud) => solicitud.tipo === TipoVacacion.MEDIO_DIA)
        .reduce((total, solicitud) => total + aNumero(solicitud.diasDescontados), 0)
    );

    if (usadoEnMediosDias + aNumero(diasDescontados) > LIMITE_FRACCIONAMIENTO) {
      throw new VacacionError(
        'Ha superado el límite de 7 días hábiles (14 medios días) de fraccionamiento permitidos por el reglamento.',
        400
      );
    }
  }

  // 3. Validar bloque principal (mínimo 7 días calendario)
  // Solo aplica si es la primera solicitud del año y es DIA_COMPLETO.
  if (solicitudesVigentes.length === 0 && tipo === TipoVacacion.DIA_COMPLETO) {
    const diffTiempo = fechaFin.getTime() - fechaInicio.getTime();
    const diasCalendario = Math.ceil(diffTiempo / (1000 * 60 * 60 * 24)) + 1;

    if (diasCalendario < MINIMO_BLOQUE_PRINCIPAL) {
      throw new VacacionError(
        'La primera solicitud del año debe ser un bloque continuo de mínimo 7 días calendario (Art. 43.1).',
        400
      );
    }
  }
}
