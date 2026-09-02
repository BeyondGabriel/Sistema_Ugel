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

export function notificar(usuarioId: number, mensaje: string): void {
  _notificarAsync(usuarioId, mensaje).catch((error) => {
    console.error(`Error al enviar notificación al usuario ${usuarioId}:`, error);
  });
}

async function _notificarAsync(usuarioId: number, mensaje: string): Promise<void> {
  const notificacion = await prisma.notificacion.create({
    data: { usuarioId, mensaje },
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
