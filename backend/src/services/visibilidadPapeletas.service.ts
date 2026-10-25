// ===========================================================
// Reglas de visibilidad de papeletas según el rol del usuario.
// Compartido entre papeleta.controller.ts y pdf.controller.ts,
// para que ambos respeten exactamente el mismo criterio.
// ===========================================================

import { Rol } from '@prisma/client';
import prisma from '../utils/prisma';
import { UsuarioAutenticado } from '../middlewares/authJWT';

/**
 * Devuelve los ids de solicitante que el usuario autenticado puede ver,
 * o null si no tiene restricción (ve a todos).
 *
 * Bloque A (jerarquía/autorización):
 * - ADMIN, RRHH, DIRECTORA, VIGILANTE: null → ven todas las papeletas.
 *   DIRECTORA y VIGILANTE necesitan alcance global por su función (firma
 *   institucional y control de puerta).
 * - JEFE: ve las propias + las de sus subordinados directos (jefeId === su id).
 * - ESPECIALISTA: solo las propias.
 */
export async function obtenerIdsVisibles(
  usuarioToken: UsuarioAutenticado,
): Promise<number[] | null> {
  if (
    usuarioToken.rol === Rol.ADMIN ||
    usuarioToken.rol === Rol.RRHH ||
    usuarioToken.rol === Rol.DIRECTORA ||
    usuarioToken.rol === Rol.VIGILANTE
  ) {
    return null;
  }

  if (usuarioToken.rol === Rol.JEFE) {
    return obtenerIdsEquipo(usuarioToken);
  }

  // ESPECIALISTA: solo su propio usuario
  return [usuarioToken.id];
}

/**
 * Alcance organizacional "de equipo" usado por asistencias y visitas:
 *
 * - JEFE: su propio id + el de sus subordinados directos.
 * - DIRECTORA: su propio id + el de todos los jefes.
 * - Resto de roles: null (sin restricción de equipo; cada controlador decide
 *   si además limita a "solo lo propio", como ESPECIALISTA).
 *
 * Es deliberadamente distinto de `obtenerIdsVisibles`, porque las papeletas
 * de la Directora y del Vigilante son de alcance global, mientras que sus
 * vistas de equipo siguen la jerarquía.
 */
export async function obtenerIdsEquipo(
  usuarioToken: UsuarioAutenticado,
): Promise<number[] | null> {
  if (usuarioToken.rol === Rol.JEFE) {
    const subordinados = await prisma.usuario.findMany({
      where: { jefeId: usuarioToken.id },
      select: { id: true },
    });

    return [usuarioToken.id, ...subordinados.map((u) => u.id)];
  }

  if (usuarioToken.rol === Rol.DIRECTORA) {
    const jefes = await prisma.usuario.findMany({
      where: { rol: Rol.JEFE, activo: true },
      select: { id: true },
    });

    return [usuarioToken.id, ...jefes.map((u) => u.id)];
  }

  return null;
}

/** Verifica si el usuario autenticado puede ver la papeleta de un solicitante dado. */
export async function usuarioPuedeVerPapeleta(
  usuarioToken: UsuarioAutenticado,
  solicitanteId: number,
): Promise<boolean> {
  const idsVisibles = await obtenerIdsVisibles(usuarioToken);

  if (idsVisibles === null) {
    return true;
  }

  return idsVisibles.includes(solicitanteId);
}


