// ===========================================================
// Controlador de generación de PDF de papeletas
// ===========================================================

import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { generarPDFPapeleta } from '../services/pdf.service';
import { obtenerIdsVisibles } from '../services/visibilidadPapeletas.service';

/**
 * GET /api/papeletas/:id/pdf
 * Genera y devuelve el PDF de una papeleta en memoria (no se guarda en
 * disco), respetando las mismas reglas de visibilidad que el resto del
 * módulo de papeletas.
 */
export async function descargarPDF(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ mensaje: 'El id proporcionado no es válido' });
      return;
    }

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

    const idsVisibles = await obtenerIdsVisibles(usuarioToken);
    if (idsVisibles !== null && !idsVisibles.includes(papeleta.solicitanteId)) {
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
