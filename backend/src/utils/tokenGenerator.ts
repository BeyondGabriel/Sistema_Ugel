// ===========================================================
// Generador de tokens alfanuméricos (usado por las papeletas
// aprobadas como código de verificación)
// ===========================================================

import crypto from 'crypto';
import prisma from './prisma';

/** Caracteres usados para los tokens: evita I, O, 0, 1 por ambigüedad visual. */
const CARACTERES_TOKEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Genera un token alfanumérico de `length` caracteres (mayúsculas + números). */
export function generarToken(length: number = 6): string {
  return Array.from(
    { length },
    () => CARACTERES_TOKEN[crypto.randomInt(0, CARACTERES_TOKEN.length)],
  ).join('');
}

/**
 * Genera un token de 6 caracteres garantizando que sea único en la base de
 * datos (en el muy improbable caso de colisión, reintenta).
 */
export async function generarTokenUnico(): Promise<string> {
  let token = generarToken();
  let existente = await prisma.papeleta.findUnique({ where: { token } });

  while (existente) {
    token = generarToken();
    existente = await prisma.papeleta.findUnique({ where: { token } });
  }

  return token;
}
