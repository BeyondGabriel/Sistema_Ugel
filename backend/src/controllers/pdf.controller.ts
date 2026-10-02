// ===========================================================
// Controlador de generación de PDF de papeletas
// ===========================================================

import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { generarPDFPapeleta } from '../services/pdf.service';
import { usuarioPuedeVerPapeleta } from '../services/visibilidadPapeletas.service';
import { papeletaIdParamsSchema } from '../schemas/papeleta.schema';

/**
 * GET /api/papeletas/:id/pdf
 * Genera y devuelve el PDF de una papeleta en memoria (no se guarda en
 * disco), respetando las mismas reglas de visibilidad que el resto del
 * módulo de papeletas.
 */
export async function descargarPDF(req: Request, res: Response): Promise<void> {
  try {
    // El id ya llega validado (entero positivo) por papeletaIdParamsSchema.
    const { id } = req.params as unknown as z.infer<typeof papeletaIdParamsSchema>;

    const usuarioToken = req.usuario;
    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const papeleta = await prisma.papeleta.findUnique({ where: { id } });
    if (!papeleta) {
      res.status(404).json({ mensaje: 'Papeleta no encontrada' });
      return;
    }

    // Autorización centralizada (A-06): misma regla de visibilidad que el
    // resto del módulo, sin lógica duplicada a mano.
    const puedeVer = await usuarioPuedeVerPapeleta(
      usuarioToken,
      papeleta.solicitanteId,
    );
    if (!puedeVer) {
      res.status(403).json({ mensaje: 'No tiene permisos para ver esta papeleta' });
      return;
    }

    const bufferPdf = await generarPDFPapeleta(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="papeleta-${papeleta.numero}.pdf"`);
    res.status(200).send(bufferPdf);
  } catch (error) {
    console.error('Error en descargarPDF:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}
