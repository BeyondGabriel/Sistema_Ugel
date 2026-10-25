// ===========================================================
// Servicio de notificaciones (implementación real - Fase 6)
//
// Persiste cada notificación en la tabla Notificacion de la base de datos
// y emite en tiempo real el evento 'notificacion' a la sala del usuario
// destinatario a través de Socket.IO.
//
// Nota sobre la firma: la función sigue devolviendo void (no Promise<void>)
// de cara a los callers existentes (papeleta.service, anulacion.service,
// visita.controller, etc.), que la llaman sin await (fire-and-forget).
// Internamente lanza una promesa que se gestiona con .catch() para que
// los errores no queden silenciados y no rompan el flujo del caller.
// ===========================================================

import prisma from '../utils/prisma';
import { getIO } from '../sockets/io';

/** Longitud máxima del campo Notificacion.mensaje (VARCHAR(500)). */
const MENSAJE_MAX_LENGTH = 500;

/**
 * Recorta un mensaje a MENSAJE_MAX_LENGTH caracteres.
 * Si se trunca, se añade "…" al final (1 char reemplaza al último).
 * Garantiza que notificar() nunca falle con P2000 por longitud.
 */
function truncarMensaje(mensaje: string): string {
  if (mensaje.length <= MENSAJE_MAX_LENGTH) {
    return mensaje;
  }
  return mensaje.slice(0, MENSAJE_MAX_LENGTH - 1) + '…';
}

export function notificar(usuarioId: number, mensaje: string): void {
  _notificarAsync(usuarioId, mensaje).catch((error) => {
    console.error(`Error al enviar notificación al usuario ${usuarioId}:`, error);
  });
}

async function _notificarAsync(usuarioId: number, mensaje: string): Promise<void> {
  const notificacion = await prisma.notificacion.create({
    data: { usuarioId, mensaje: truncarMensaje(mensaje) },
  });

  const io = getIO();
  if (io) {
    io.to(`usuario:${usuarioId}`).emit('notificacion', {
      id: notificacion.id,
      mensaje: notificacion.mensaje,
      fecha: notificacion.fecha,
      leida: notificacion.leida,
    });
  }
}
