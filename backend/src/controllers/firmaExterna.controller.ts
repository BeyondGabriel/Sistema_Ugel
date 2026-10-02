// ===========================================================
// Controlador del webhook de firma externa (Supabase → backend)
// ===========================================================

import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { EstadoPapeleta } from '@prisma/client';
import prisma from '../utils/prisma';
import { webhookFirmaSchema } from '../schemas/firmaExterna.schema';

/**
 * Compara dos cadenas en tiempo constante (B-01). `crypto.timingSafeEqual`
 * exige buffers de igual longitud; si difieren, el secreto ya no puede ser
 * válido y se descarta sin convertirlo en error.
 */
function compararSecretosTiempoConstante(recibido: string, esperado: string): boolean {
  const bufferRecibido = Buffer.from(recibido, 'utf8');
  const bufferEsperado = Buffer.from(esperado, 'utf8');

  if (bufferRecibido.length !== bufferEsperado.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferRecibido, bufferEsperado);
}

/**
 * POST /api/firmas/webhook
 * No usa authJWT: la seguridad la da el header x-webhook-secret, que solo
 * Supabase (o quien dispare el webhook) conoce. Solo se permite registrar la
 * firma en papeletas vigentes (no ANULADO ni CANCELADO).
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

    // B-01: comparación en tiempo constante (evita fuga por temporización).
    if (!secretRecibido || !compararSecretosTiempoConstante(secretRecibido, secretEsperado)) {
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

    // B-01: comprobación de negocio: no se firma una papeleta ya invalidada.
    if (
      papeleta.estado === EstadoPapeleta.ANULADO ||
      papeleta.estado === EstadoPapeleta.CANCELADO
    ) {
      res.status(409).json({
        mensaje: `No se puede registrar la firma: la papeleta está en estado ${papeleta.estado}`,
      });
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
