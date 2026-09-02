// ===========================================================
// Reglas de visibilidad de papeletas según el rol del usuario.
// Compartido entre papeleta.controller.ts y pdf.controller.ts,
// para que ambos respeten exactamente el mismo criterio.
// ===========================================================

import { Rol } from '@prisma/client';
import prisma from '../utils/prisma';
import { PayloadJWT } from '../middlewares/authJWT';

/**
 * Devuelve los ids de solicitante que el usuario autenticado puede ver,
 * o null si no tiene restricción (ve a todos: ADMIN y RRHH).
 *
 * - JEFE: ve las propias + las de sus subordinados (jefeId === su id).
 * - DIRECTORA: ve las propias + las de todos los usuarios con rol JEFE.
 * - ESPECIALISTA, VIGILANTE: solo las propias.
 */
export async function obtenerIdsVisibles(usuarioToken: PayloadJWT): Promise<number[] | null> {
  if (usuarioToken.rol === Rol.ADMIN || usuarioToken.rol === Rol.RRHH) {
    return null;
  }

  if (usuarioToken.rol === Rol.JEFE) {
    const subordinados = await prisma.usuario.findMany({
      where: { jefeId: usuarioToken.id },
      select: { id: true },
    });
    return [usuarioToken.id, ...subordinados.map((u) => u.id)];
  }

  if (usuarioToken.rol === Rol.DIRECTORA) {
    const jefes = await prisma.usuario.findMany({
      where: { rol: Rol.JEFE },
      select: { id: true },
    });
    return [usuarioToken.id, ...jefes.map((u) => u.id)];
  }

  // ESPECIALISTA, VIGILANTE: solo su propio usuario
  return [usuarioToken.id];
}

/** Verifica si el usuario autenticado puede ver la papeleta de un solicitante dado. */
export async function usuarioPuedeVerPapeleta(usuarioToken: PayloadJWT, solicitanteId: number): Promise<boolean> {
  const idsVisibles = await obtenerIdsVisibles(usuarioToken);
  if (idsVisibles === null) {
    return true;
  }
  return idsVisibles.includes(solicitanteId);
}
