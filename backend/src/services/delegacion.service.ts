// ===========================================================
// Servicio de delegaciones de aprobación (Bloque A)
//
// Una delegación traslada temporalmente la facultad de aprobar papeletas
// de un titular (JEFE o DIRECTORA) a un encargado. Mientras la delegación
// está vigente, `papeleta.service.ts` enruta las papeletas al encargado
// en lugar del titular.
//
// Estas funciones son de solo lectura y las consumen tanto el controlador
// de delegaciones como el servicio de papeletas, de modo que el criterio
// de "delegación vigente" sea exactamente el mismo en todo el sistema.
// ===========================================================

import { Prisma, Rol } from '@prisma/client';
import prisma from '../utils/prisma';

/** Cliente de Prisma "normal" o el cliente de una transacción en curso. */
type ClientePrisma = typeof prisma | Prisma.TransactionClient;

/** Datos públicos del encargado que acompañan a una delegación vigente. */
const seleccionEncargado = {
  id: true,
  nombres: true,
  apellidos: true,
  rol: true,
  tituloFormal: true,
} as const;

/**
 * Devuelve la delegación activa y vigente en `fecha` para el titular dado,
 * o null si no existe. Solo se consideran encargados activos y disponibles.
 */
export async function obtenerDelegacionVigente(
  titularId: number,
  fecha: Date = new Date(),
  cliente: ClientePrisma = prisma,
) {
  return cliente.delegacion.findFirst({
    where: {
      titularId,
      activo: true,
      fechaInicio: { lte: fecha },
      fechaFin: { gte: fecha },
      encargado: { activo: true, noDisponible: false },
    },
    include: {
      encargado: { select: seleccionEncargado },
      titular: { select: seleccionEncargado },
    },
    orderBy: { fechaInicio: 'desc' },
  });
}

/**
 * Indica si el rango [fechaInicio, fechaFin] se solapa con otra delegación
 * activa del mismo titular (opcionalmente excluyendo una delegación por id,
 * para permitir ediciones).
 */
export async function existeSolapeDelegacion(
  titularId: number,
  fechaInicio: Date,
  fechaFin: Date,
  idExcluir?: number,
): Promise<boolean> {
  const solapada = await prisma.delegacion.findFirst({
    where: {
      titularId,
      activo: true,
      fechaInicio: { lte: fechaFin },
      fechaFin: { gte: fechaInicio },
      ...(idExcluir !== undefined ? { id: { not: idExcluir } } : {}),
    },
    select: { id: true },
  });

  return solapada !== null;
}

/**
 * Valida que el encargado sea elegible para el titular según la jerarquía:
 * - titular JEFE → encargado ESPECIALISTA de su misma área (jefatura);
 * - titular DIRECTORA → encargado JEFE de área.
 *
 * Devuelve el mensaje de error o `null` si la combinación es válida.
 */
export function validarEncargadoElegible(
  titular: { rol: Rol; jefaturaId: number | null },
  encargado: { rol: Rol; jefaturaId: number | null },
): string | null {
  if (titular.rol === Rol.JEFE) {
    const esEspecialistaDelArea =
      encargado.rol === Rol.ESPECIALISTA &&
      encargado.jefaturaId !== null &&
      encargado.jefaturaId === titular.jefaturaId;

    if (!esEspecialistaDelArea) {
      return 'El encargado no es elegible: un jefe de área solo puede delegar en un especialista de su misma área';
    }

    return null;
  }

  if (encargado.rol !== Rol.JEFE) {
    return 'El encargado no es elegible: la Directora solo puede delegar en un jefe de área';
  }

  return null;
}
