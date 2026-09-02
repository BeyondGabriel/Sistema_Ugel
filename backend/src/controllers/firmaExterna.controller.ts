// ===========================================================
// Controlador del webhook de firma externa (Supabase → backend)
// ===========================================================

import { Request, Response } from 'express';
import prisma from '../utils/prisma';

/**
 * POST /api/firmas/webhook
 * No usa authJWT: la seguridad la da el header x-webhook-secret, que solo
 * Supabase (o quien dispare el webhook) conoce. La papeleta solo necesita
 * existir; la firma puede adjuntarse sin importar su estado actual.
 */
export async function webhookFirma(req: Request, res: Response): Promise<void> {
  try {
    const secretRecibido = req.header('x-webhook-secret');
    const secretEsperado = process.env.WEBHOOK_SECRET;

    if (!secretEsperado) {
      console.error('WEBHOOK_SECRET no está configurado en las variables de entorno');
      res.status(500).json({ mensaje: 'Error de configuración del servidor' });
      return;
    }

    if (!secretRecibido || secretRecibido !== secretEsperado) {
      res.status(401).json({ mensaje: 'Clave de webhook inválida' });
      return;
    }

    const { papeletaId, svgUrl } = req.body as { papeletaId?: number; svgUrl?: string };

    if (!papeletaId || !svgUrl) {
      res.status(400).json({ mensaje: 'papeletaId y svgUrl son obligatorios' });
      return;
    }

    const papeleta = await prisma.papeleta.findUnique({ where: { id: papeletaId } });
    if (!papeleta) {
      res.status(404).json({ mensaje: 'Papeleta no encontrada' });
      return;
    }

    await prisma.papeleta.update({
      where: { id: papeletaId },
      data: { firmaExternaSvg: svgUrl },
    });

    res.status(200).json({ mensaje: 'Firma registrada correctamente', papeletaId });
  } catch (error) {
    console.error('Error en webhookFirma:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}
