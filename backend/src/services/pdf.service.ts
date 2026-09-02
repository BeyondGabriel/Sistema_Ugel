// ===========================================================
// Servicio de generación de PDF de una papeleta, bajo demanda
// y en memoria (no se persiste nada en disco).
// ===========================================================

import PDFDocument from 'pdfkit';
import { EstadoPapeleta, TipoTiempo } from '@prisma/client';
import prisma from '../utils/prisma';

const NOMBRE_INSTITUCION = 'UGEL Talara';

/** Etiquetas legibles para cada estado, usadas en el cuerpo del PDF. */
const ETIQUETAS_ESTADO: Record<EstadoPapeleta, string> = {
  PENDIENTE: 'Pendiente',
  EN_REVISION: 'En revisión',
  OBSERVADO: 'Observado',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  CANCELADO: 'Cancelado',
  ANULADO: 'Anulado',
  ANULACION_SOLICITADA: 'Anulación solicitada',
};

function formatearFecha(fecha: Date | null | undefined): string {
  if (!fecha) {
    return '—';
  }
  return new Date(fecha).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Consulta la papeleta con todas las relaciones necesarias para el PDF. */
async function obtenerPapeletaParaPdf(papeletaId: number) {
  return prisma.papeleta.findUnique({
    where: { id: papeletaId },
    include: {
      solicitante: { include: { jefatura: true } },
      aprobador: { select: { nombres: true, apellidos: true } },
      adminAnulador: { select: { nombres: true, apellidos: true } },
    },
  });
}

type PapeletaParaPdf = NonNullable<Awaited<ReturnType<typeof obtenerPapeletaParaPdf>>>;

/**
 * Genera el PDF de una papeleta en memoria y devuelve su contenido como
 * Buffer, listo para enviarse directamente como respuesta HTTP.
 */
export async function generarPDFPapeleta(papeletaId: number): Promise<Buffer> {
  const papeleta = await obtenerPapeletaParaPdf(papeletaId);

  if (!papeleta) {
    throw new Error('Papeleta no encontrada');
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const pdfListo = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // --- Encabezado institucional ---
  doc.fontSize(18).font('Helvetica-Bold').text(NOMBRE_INSTITUCION, { align: 'center' });
  doc.fontSize(14).font('Helvetica').text('Papeleta de Salida', { align: 'center' });
  doc.moveDown(1.5);

  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('N.º de papeleta: ', { continued: true })
    .font('Helvetica')
    .text(papeleta.numero);
  doc.moveDown(0.5);

  // --- Datos del solicitante ---
  doc.font('Helvetica-Bold').text('Solicitante');
  doc.font('Helvetica').text(`${papeleta.solicitante.nombres} ${papeleta.solicitante.apellidos}`);
  doc.text(`Jefatura: ${papeleta.solicitante.jefatura?.nombre ?? 'No asignada'}`);
  doc.moveDown(0.5);

  // --- Detalle del permiso ---
  doc.font('Helvetica-Bold').text('Detalle del permiso');
  doc.font('Helvetica').text(`Tipo: ${papeleta.tipoTiempo === TipoTiempo.DIAS ? 'Días' : 'Horas'}`);

  if (papeleta.tipoTiempo === TipoTiempo.DIAS) {
    doc.text(`Desde: ${formatearFecha(papeleta.fechaInicio)}`);
    doc.text(`Hasta: ${formatearFecha(papeleta.fechaFin)}`);
  } else {
    doc.text(`Fecha: ${formatearFecha(papeleta.fechaInicio)}`);
    doc.text(`Hora de salida: ${formatearFecha(papeleta.horaSalida)}`);
    doc.text(`Hora de retorno: ${formatearFecha(papeleta.horaRetorno)}`);
  }

  const motivoCompleto =
    papeleta.motivo === 'Otros' && papeleta.motivoOtros
      ? `${papeleta.motivo} (${papeleta.motivoOtros})`
      : papeleta.motivo;
  doc.text(`Motivo: ${motivoCompleto}`);
  doc.moveDown(0.5);

  // --- Estado actual ---
  doc
    .font('Helvetica-Bold')
    .text('Estado actual: ', { continued: true })
    .font('Helvetica')
    .text(ETIQUETAS_ESTADO[papeleta.estado]);
  doc.moveDown(1.5);

  // --- Sello visual según estado ---
  dibujarSello(doc, papeleta);

  // --- Firma externa ---
  // PDFKit no soporta SVG de forma nativa; incrustar la imagen real
  // requeriría convertirla a PNG primero (p. ej. con la librería `sharp`,
  // que no está instalada en este proyecto). Eso queda para una fase
  // posterior. Por ahora se muestra un recuadro con la URL como enlace.
  if (papeleta.firmaExternaSvg) {
    doc.moveDown(3);
    dibujarRecuadroFirma(doc, papeleta.firmaExternaSvg);
  }

  doc.end();

  return pdfListo;
}

/**
 * Dibuja el sello visual correspondiente al estado de la papeleta, en la
 * esquina superior derecha del bloque actual del documento.
 */
function dibujarSello(doc: PDFKit.PDFDocument, papeleta: PapeletaParaPdf): void {
  const anchoSello = 200;
  const altoSello = 80;
  const x = doc.page.width - doc.page.margins.right - anchoSello;
  const y = doc.y;

  switch (papeleta.estado) {
    case EstadoPapeleta.APROBADO: {
      doc.save();
      doc.lineWidth(2).strokeColor('#16a34a').rect(x, y, anchoSello, altoSello).stroke();
      doc
        .fontSize(16)
        .fillColor('#16a34a')
        .font('Helvetica-Bold')
        .text('APROBADO', x, y + 10, { width: anchoSello, align: 'center' });
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Token: ${papeleta.token ?? '—'}`, x, y + 35, { width: anchoSello, align: 'center' });
      doc.text(`Fecha de aprobación: ${formatearFecha(papeleta.fechaCreacion)}`, x, y + 50, {
        width: anchoSello,
        align: 'center',
      });
      doc.restore();
      break;
    }

    case EstadoPapeleta.RECHAZADO: {
      doc.save();
      doc.lineWidth(2).strokeColor('#dc2626').rect(x, y, anchoSello, altoSello).stroke();
      doc
        .fontSize(16)
        .fillColor('#dc2626')
        .font('Helvetica-Bold')
        .text('RECHAZADO', x, y + 10, { width: anchoSello, align: 'center' });
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(papeleta.motivoRechazo ?? 'Sin motivo registrado', x, y + 35, {
          width: anchoSello,
          align: 'center',
        });
      doc.restore();
      break;
    }

    case EstadoPapeleta.ANULADO: {
      doc.save();
      doc.lineWidth(2).strokeColor('#dc2626').rect(x, y, anchoSello, altoSello).stroke();
      doc
        .fontSize(16)
        .fillColor('#dc2626')
        .font('Helvetica-Bold')
        .text('ANULADO', x, y + 10, { width: anchoSello, align: 'center' });
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(papeleta.motivoAnulacion ?? 'Sin motivo registrado', x, y + 30, {
          width: anchoSello,
          align: 'center',
        });
      if (papeleta.anuladoPorAdmin) {
        doc.text('Anulado por administrador', x, y + altoSello - 12, { width: anchoSello, align: 'center' });
      }
      doc.restore();
      break;
    }

    case EstadoPapeleta.CANCELADO: {
      doc.save();
      doc.lineWidth(2).strokeColor('#6b7280').rect(x, y, anchoSello, altoSello).stroke();
      doc
        .fontSize(14)
        .fillColor('#6b7280')
        .font('Helvetica-Bold')
        .text('CANCELADO', x, y + 15, { width: anchoSello, align: 'center' });
      doc
        .fontSize(9)
        .font('Helvetica')
        .text('Cancelado por el trabajador', x, y + 40, { width: anchoSello, align: 'center' });
      doc.restore();
      break;
    }

    default:
      // PENDIENTE, EN_REVISION, OBSERVADO, ANULACION_SOLICITADA: sin sello;
      // el estado ya quedó impreso como texto más arriba en el documento.
      break;
  }

  doc.fillColor('black').font('Helvetica');
}

/**
 * Dibuja un recuadro con la URL de la firma externa como texto clickeable.
 * No descarga ni renderiza el SVG: PDFKit no lo soporta de forma nativa,
 * y convertirlo a imagen (p. ej. con `sharp`) queda para una fase
 * posterior en la que esa librería esté instalada.
 */
function dibujarRecuadroFirma(doc: PDFKit.PDFDocument, svgUrl: string): void {
  const anchoRecuadro = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const altoRecuadro = 50;
  const x = doc.page.margins.left;
  const y = doc.y;

  doc.save();
  doc.lineWidth(1).strokeColor('#9ca3af').rect(x, y, anchoRecuadro, altoRecuadro).stroke();
  doc.fontSize(9).fillColor('#374151').font('Helvetica-Bold').text('Firma externa:', x + 10, y + 10);
  doc
    .fontSize(9)
    .fillColor('#2563eb')
    .font('Helvetica')
    .text(svgUrl, x + 10, y + 25, { width: anchoRecuadro - 20, link: svgUrl, underline: true });
  doc.restore();

  doc.fillColor('black').font('Helvetica');
}

