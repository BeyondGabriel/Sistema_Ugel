// ===========================================================
// Controlador del webhook de firma externa (Supabase → backend)
// ===========================================================

import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { webhookFirmaSchema } from '../schemas/firmaExterna.schema';

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

    // Los datos ya llegan validados por webhookFirmaSchema.
    const { papeletaId, svgUrl } = req.body as z.infer<typeof webhookFirmaSchema>;

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
