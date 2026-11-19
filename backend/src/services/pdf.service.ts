// ===========================================================
// Servicio de generación de PDF de una papeleta, bajo demanda
// y en memoria (no se persiste nada en disco).
// ===========================================================

import PDFDocument from 'pdfkit';
import {
  EstadoPapeleta,
  EstadoSolicitudVacacion,
  TipoTiempo,
  TipoVacacion,
} from '@prisma/client';
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

// ===========================================================
// PDF de solicitudes de vacaciones
// ===========================================================

/** Etiquetas legibles para el estado de una solicitud de vacaciones. */
const ETIQUETAS_ESTADO_VACACION: Record<EstadoSolicitudVacacion, string> = {
  PENDIENTE: 'Pendiente',
  CON_VB: 'Con VoBo del Jefe',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
};

/** Formatea una fecha (sin hora) en el formato local es-PE. */
function formatearFechaVacacion(fecha: Date | null | undefined): string {
  if (!fecha) {
    return '—';
  }
  return new Date(fecha).toLocaleDateString('es-PE', { dateStyle: 'medium' });
}

/** Consulta la solicitud de vacaciones con las relaciones necesarias para el PDF. */
async function obtenerVacacionParaPdf(solicitudId: number) {
  return prisma.solicitudVacacion.findUnique({
    where: { id: solicitudId },
    include: {
      solicitante: { include: { jefatura: true } },
      aprobador: { select: { nombres: true, apellidos: true } },
      rrhh: { select: { nombres: true, apellidos: true } },
    },
  });
}

/**
 * Dibuja un texto diagonal como marca de agua sobre toda la página.
 * Se invoca antes del contenido para que el texto quede por detrás de los
 * datos de la solicitud.
 */
function dibujarMarcaAgua(doc: PDFKit.PDFDocument, texto: string): void {
  doc.save();
  doc.translate(doc.page.width / 2, doc.page.height / 2);
  doc.rotate(-45);
  doc
    .font('Helvetica-Bold')
    .fontSize(42)
    .fillColor('#d1d5db')
    .fillOpacity(0.5)
    .text(texto, -240, -20, { width: 480, align: 'center' });
  doc.restore();

  // Restaurar el estado tipográfico y el cursor del documento.
  doc.fillColor('black').fillOpacity(1).font('Helvetica');
  doc.x = doc.page.margins.left;
  doc.y = doc.page.margins.top;
}

/** Nombre completo de un usuario, o un guion si no existe. */
function nombreCompleto(usuario: { nombres: string; apellidos: string } | null): string {
  if (!usuario) {
    return '—';
  }
  return `${usuario.nombres} ${usuario.apellidos}`;
}

/**
 * Dibuja el recuadro inferior con los tres espacios de firma:
 * Trabajador, Jefe Inmediato (VoBo) y RRHH (Aprobación Final).
 */
function dibujarRecuadroFirmasVacacion(
  doc: PDFKit.PDFDocument,
  nombres: { trabajador: string; jefe: string; rrhh: string }
): void {
  const margenIzquierdo = doc.page.margins.left;
  const anchoTotal = doc.page.width - margenIzquierdo - doc.page.margins.right;
  const altoRecuadro = 95;
  const anchoFirma = anchoTotal / 3;
  const y = doc.page.height - doc.page.margins.bottom - altoRecuadro;

  const firmas = [
    { titulo: 'Trabajador', nombre: nombres.trabajador },
    { titulo: 'Jefe Inmediato (VoBo)', nombre: nombres.jefe },
    { titulo: 'RRHH (Aprobación Final)', nombre: nombres.rrhh },
  ];

  doc.save();
  doc.lineWidth(1).strokeColor('#6b7280');
  doc.rect(margenIzquierdo, y, anchoTotal, altoRecuadro).stroke();

  firmas.forEach((firma, indice) => {
    const x = margenIzquierdo + indice * anchoFirma;

    // Separador vertical entre espacios de firma
    if (indice > 0) {
      doc.moveTo(x, y).lineTo(x, y + altoRecuadro).stroke();
    }

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#374151')
      .text(firma.nombre, x + 6, y + 40, { width: anchoFirma - 12, align: 'center' });

    // Línea de firma
    doc
      .moveTo(x + 15, y + 58)
      .lineTo(x + anchoFirma - 15, y + 58)
      .stroke();

    doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .fillColor('#374151')
      .text(firma.titulo, x + 6, y + 64, { width: anchoFirma - 12, align: 'center' });
  });

  doc.restore();

  doc.fillColor('black').font('Helvetica');
}

/**
 * Genera el PDF de una solicitud de vacaciones en memoria y devuelve su
 * contenido como Buffer, listo para enviarse directamente como respuesta HTTP.
 */
export async function generarPDFVacacion(solicitudId: number): Promise<Buffer> {
  const solicitud = await obtenerVacacionParaPdf(solicitudId);

  if (!solicitud) {
    throw new Error('Solicitud de vacaciones no encontrada');
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const pdfListo = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // --- Marca de agua si la solicitud aún no está aprobada ---
  if (solicitud.estado !== EstadoSolicitudVacacion.APROBADA) {
    dibujarMarcaAgua(doc, 'PENDIENTE DE APROBACIÓN');
  }

  // --- Encabezado institucional ---
  doc.fontSize(18).font('Helvetica-Bold').text(NOMBRE_INSTITUCION, { align: 'center' });
  doc.fontSize(14).font('Helvetica').text('Solicitud de Vacaciones', { align: 'center' });
  doc.moveDown(1.5);

  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('N.º de solicitud: ', { continued: true })
    .font('Helvetica')
    .text(String(solicitud.id));
  doc.moveDown(0.5);

  // --- Datos del solicitante ---
  doc.font('Helvetica-Bold').text('Solicitante');
  doc
    .font('Helvetica')
    .text(`${solicitud.solicitante.nombres} ${solicitud.solicitante.apellidos}`);
  doc.text(`Jefatura: ${solicitud.solicitante.jefatura?.nombre ?? 'No asignada'}`);
  doc.moveDown(0.5);

  // --- Detalle de las vacaciones ---
  doc.font('Helvetica-Bold').text('Detalle de las vacaciones');
  doc
    .font('Helvetica')
    .text(
      `Tipo: ${solicitud.tipo === TipoVacacion.MEDIO_DIA ? 'Medio Día' : 'Día Completo'}`
    );
  doc.text(`Fecha de inicio: ${formatearFechaVacacion(solicitud.fechaInicio)}`);
  doc.text(`Fecha de fin: ${formatearFechaVacacion(solicitud.fechaFin)}`);

  if (solicitud.tipo === TipoVacacion.MEDIO_DIA) {
    doc.text(`Horas: ${solicitud.horaInicio ?? '—'} a ${solicitud.horaFin ?? '—'}`);
  } else {
    doc.text('Horas: No aplica');
  }

  doc.text(`Días descontados: ${Number(solicitud.diasDescontados)}`);
  doc.moveDown(0.5);

  // --- Estado actual ---
  doc
    .font('Helvetica-Bold')
    .text('Estado actual: ', { continued: true })
    .font('Helvetica')
    .text(ETIQUETAS_ESTADO_VACACION[solicitud.estado]);

  if (solicitud.estado === EstadoSolicitudVacacion.RECHAZADA && solicitud.motivoRechazo) {
    doc.text(`Motivo de rechazo: ${solicitud.motivoRechazo}`);
  }

  // --- Recuadro de firmas (parte inferior de la página) ---
  dibujarRecuadroFirmasVacacion(doc, {
    trabajador: `${solicitud.solicitante.nombres} ${solicitud.solicitante.apellidos}`,
    jefe: nombreCompleto(solicitud.aprobador),
    rrhh: nombreCompleto(solicitud.rrhh),
  });

  doc.end();

  return pdfListo;
}

