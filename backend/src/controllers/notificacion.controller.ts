// ===========================================================
// Controlador de notificaciones del usuario autenticado
// ===========================================================

import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import {
  notificacionIdParamsSchema,
  listarNotificacionesQuerySchema,
} from '../schemas/notificacion.schema';

/**
 * GET /api/notificaciones
 * Devuelve las notificaciones del usuario autenticado en orden descendente.
 * Parámetro de query opcional: soloNoLeidas=true
 */
export async function listarNotificaciones(req: Request, res: Response): Promise<void> {
  try {
    const usuarioToken = req.usuario;
    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    // El query ya llega validado por listarNotificacionesQuerySchema.
    const { soloNoLeidas } = req.query as unknown as z.infer<typeof listarNotificacionesQuerySchema>;

    const notificaciones = await prisma.notificacion.findMany({
      where: {
        usuarioId: usuarioToken.id,
        ...(soloNoLeidas === 'true' ? { leida: false } : {}),
      },
      orderBy: { fecha: 'desc' },
    });

    const noLeidas = notificaciones.filter((n) => !n.leida).length;

    res.status(200).json({ notificaciones, noLeidas });
  } catch (error) {
    console.error('Error en listarNotificaciones:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * PUT /api/notificaciones/:id/leer
 * Marca una notificación individual como leída. Solo el dueño puede marcarla.
 */
export async function marcarLeida(req: Request, res: Response): Promise<void> {
  try {
    // El id ya llega validado (entero positivo) por notificacionIdParamsSchema.
    const { id } = req.params as unknown as z.infer<typeof notificacionIdParamsSchema>;

    const usuarioToken = req.usuario;
    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const notificacion = await prisma.notificacion.findUnique({ where: { id } });
    if (!notificacion) {
      res.status(404).json({ mensaje: 'Notificación no encontrada' });
      return;
    }

    if (notificacion.usuarioId !== usuarioToken.id) {
      res.status(403).json({ mensaje: 'No tiene permisos para modificar esta notificación' });
      return;
    }

    const actualizada = await prisma.notificacion.update({
      where: { id },
      data: { leida: true },
    });

    res.status(200).json({ notificacion: actualizada });
  } catch (error) {
    console.error('Error en marcarLeida:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * PUT /api/notificaciones/leer-todas
 * Marca como leídas todas las notificaciones del usuario autenticado.
 */
export async function marcarTodasLeidas(req: Request, res: Response): Promise<void> {
  try {
    const usuarioToken = req.usuario;
    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const { count } = await prisma.notificacion.updateMany({
      where: { usuarioId: usuarioToken.id, leida: false },
      data: { leida: true },
    });

    res.status(200).json({ mensaje: `${count} notificaciones marcadas como leídas` });
  } catch (error) {
    console.error('Error en marcarTodasLeidas:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}
