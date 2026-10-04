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
 * Compara dos cadenas en tiempo constante (H1 / H1-b).
 *
 * Se calcula un HMAC-SHA256 de longitud fija (32 bytes) sobre cada valor antes
 * de invocar `crypto.timingSafeEqual`. Así la comparación no depende de la
 * longitud de las entradas y desaparece la fuga de longitud que producía el
 * antiguo early-return.
 */
function compararSecretosTiempoConstante(recibido: string, esperado: string): boolean {
  const hashA = crypto.createHmac('sha256', esperado).update(recibido).digest();
  const hashB = crypto.createHmac('sha256', esperado).update(esperado).digest();

  return crypto.timingSafeEqual(hashA, hashB);
}

/** Ventana máxima aceptada para el anti-replay del webhook (300 segundos). */
const TOLERANCIA_ANTI_REPLAY_MS = 300 * 1000;

/**
 * Normaliza un timestamp (epoch en segundos o en milisegundos) a milisegundos.
 * Devuelve null si no es un número finito.
 */
function timestampEnMs(timestamp: string): number | null {
  const valor = Number(timestamp);

  if (!Number.isFinite(valor)) {
    return null;
  }

  return valor < 1e12 ? valor * 1000 : valor;
}

/**
 * Verifica la firma HMAC-SHA256 del cuerpo crudo (H3).
 *
 * El emisor firma la cadena `${timestamp}.${rawBody}` con el secreto compartido
 * y envía el digest en hexadecimal por `x-webhook-signature`.
 */
function verificarFirmaHmac(
  firmaRecibida: string,
  timestamp: string,
  secreto: string,
  rawBody: Buffer | undefined,
): boolean {
  if (!rawBody) {
    return false;
  }

  const firmaEsperada = crypto
    .createHmac('sha256', secreto)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex');

  return compararSecretosTiempoConstante(firmaRecibida, firmaEsperada);
}

/**
 * POST /api/firmas/webhook
 * No usa authJWT: la autenticación la aporta el webhook mediante firma HMAC
 * (H3) o, por retrocompatibilidad, el secreto estático x-webhook-secret. Solo
 * se registra la firma en papeletas APROBADAS y de forma idempotente (H4).
 */
export async function webhookFirma(req: Request, res: Response): Promise<void> {
  try {
    const secretEsperado = process.env.WEBHOOK_SECRET;

    if (!secretEsperado) {
      console.error('WEBHOOK_SECRET no está configurado en las variables de entorno');
      res.status(500).json({ mensaje: 'Error de configuración del servidor' });
      return;
    }

    // ---- H3: autenticación e integridad (HMAC + anti-replay) ----
    const firmaRecibida = req.header('x-webhook-signature');
    const timestampRecibido = req.header('x-webhook-timestamp');
    const secretRecibido = req.header('x-webhook-secret');
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

    let autenticado = false;

    if (firmaRecibida && timestampRecibido) {
      const timestampMs = timestampEnMs(timestampRecibido);
      const dentroDeVentana =
        timestampMs !== null &&
        Math.abs(Date.now() - timestampMs) <= TOLERANCIA_ANTI_REPLAY_MS;

      if (!dentroDeVentana) {
        res.status(401).json({ mensaje: 'Firma de webhook expirada (anti-replay)' });
        return;
      }

      autenticado = verificarFirmaHmac(
        firmaRecibida,
        timestampRecibido,
        secretEsperado,
        rawBody,
      );
    } else if (secretRecibido) {
      // Retrocompatibilidad: emisor que sólo envía el secreto estático.
      autenticado = compararSecretosTiempoConstante(secretRecibido, secretEsperado);
    } else {
      res.status(401).json({ mensaje: 'Credenciales de webhook ausentes' });
      return;
    }

    if (!autenticado) {
      res.status(401).json({ mensaje: 'Clave de webhook inválida' });
      return;
    }

    // Los datos ya llegan validados por webhookFirmaSchema.
    const { papeletaId, svgUrl } = req.body as z.infer<typeof webhookFirmaSchema>;

    // ---- H4: autorización del recurso ----
    const papeleta = await prisma.papeleta.findUnique({ where: { id: papeletaId } });
    if (!papeleta) {
      res.status(404).json({ mensaje: 'Papeleta no encontrada' });
      return;
    }

    if (papeleta.estado !== EstadoPapeleta.APROBADO) {
      res.status(409).json({
        mensaje: `No se puede registrar la firma: la papeleta debe estar APROBADO (estado actual: ${papeleta.estado})`,
      });
      return;
    }

    // ---- H4: idempotencia defensiva ----
    if (papeleta.firmaExternaSvg === svgUrl) {
      res.status(200).json({ mensaje: 'Firma ya registrada previamente', papeletaId });
      return;
    }

    if (papeleta.firmaExternaSvg) {
      res.status(409).json({
        mensaje:
          'La papeleta ya tiene una firma externa distinta; se rechaza la sobreescritura',
      });
      return;
    }

    // Escritura atómica y condicional: sólo firma si sigue APROBADA y sin firma.
    const resultado = await prisma.papeleta.updateMany({
      where: {
        id: papeletaId,
        estado: EstadoPapeleta.APROBADO,
        firmaExternaSvg: null,
      },
      data: { firmaExternaSvg: svgUrl },
    });

    if (resultado.count === 0) {
      res.status(409).json({
        mensaje: 'La papeleta cambió de estado o ya fue firmada durante la operación',
      });
      return;
    }

    res.status(200).json({ mensaje: 'Firma registrada correctamente', papeletaId });
  } catch (error) {
    console.error('Error en webhookFirma:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}
