// ===========================================================
// Controlador de reportes / exportaciones a Excel (.xlsx)
// Usa ExcelJS para generar los archivos en memoria y devolverlos
// como respuesta binaria (sin guardar nada en disco).
// ===========================================================

import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { Rol, EstadoPapeleta, TipoTiempo, TipoMovimiento, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { obtenerRangoDelDia } from '../utils/fechas';
import { obtenerIdsVisibles } from '../services/visibilidadPapeletas.service';

// ─────────────────────────────────────────────────────────────
// Helpers de formato
// ─────────────────────────────────────────────────────────────

const CONTENT_TYPE_EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Convierte una fecha YYYY-MM-DD a un Date local. Si finDelDia=true, hora 23:59:59.999 */
function parseFechaLocal(fecha: string, finDelDia = false): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  if (finDelDia) {
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }
  return new Date(y, m - 1, d);
}

async function enviarExcel(res: Response, workbook: ExcelJS.Workbook, nombreArchivo: string): Promise<void> {
  res.setHeader('Content-Type', CONTENT_TYPE_EXCEL);
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
  const buffer = await workbook.xlsx.writeBuffer();
  res.send(buffer);
}

function formatearFecha(fecha: Date | null | undefined): string {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-PE');
}

function formatearHora(fecha: Date | null | undefined): string {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Aplica estilo de encabezado (negrita, fondo gris claro) a una fila. */
function estilizarCabecera(fila: ExcelJS.Row, numColumnas: number): void {
  fila.font = { bold: true };
  fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  fila.alignment = { vertical: 'middle' };
  fila.height = 20;
  // Agregar borde solo si la fila tiene celdas
  for (let i = 1; i <= numColumnas; i++) {
    const cell = fila.getCell(i);
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/asistencias/exportar
// ─────────────────────────────────────────────────────────────

const ROLES_VEN_TODOS_ASISTENCIAS: Rol[] = [Rol.VIGILANTE, Rol.ADMIN, Rol.RRHH];

export async function exportarAsistencias(req: Request, res: Response): Promise<void> {
  try {
    const usuarioToken = req.usuario;
    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const { fechaInicio, fechaFin, usuarioId, jefaturaId } = req.query as {
      fechaInicio?: string;
      fechaFin?: string;
      usuarioId?: string;
      jefaturaId?: string;
    };

    const where: Prisma.MovimientoWhereInput = {};

    const puedeVerTodos = ROLES_VEN_TODOS_ASISTENCIAS.includes(usuarioToken.rol);

    if (!puedeVerTodos) {
      where.usuarioId = usuarioToken.id;
    } else {
      if (usuarioId !== undefined) {
        where.usuarioId = Number(usuarioId);
      }
      if (jefaturaId !== undefined) {
        where.usuario = { jefaturaId: Number(jefaturaId) };
      }
    }

    if (fechaInicio || fechaFin) {
      const filtro: Prisma.DateTimeFilter = {};
      if (fechaInicio) filtro.gte = parseFechaLocal(fechaInicio);
      if (fechaFin) filtro.lte = parseFechaLocal(fechaFin, true);
      where.timestamp = filtro;
    }

    const movimientos = await prisma.movimiento.findMany({
      where,
      include: {
        usuario: {
          include: { jefatura: { select: { nombre: true } } },
        },
      },
      orderBy: [{ usuarioId: 'asc' }, { timestamp: 'asc' }],
    });

    // Agrupar por usuario → día
    type DiaKey = string;
    type UsuarioKey = number;

    const grupos = new Map<UsuarioKey, Map<DiaKey, typeof movimientos>>();

    for (const mov of movimientos) {
      const diaKey = mov.timestamp.toISOString().slice(0, 10);
      if (!grupos.has(mov.usuarioId)) {
        grupos.set(mov.usuarioId, new Map());
      }
      const porDia = grupos.get(mov.usuarioId)!;
      if (!porDia.has(diaKey)) {
        porDia.set(diaKey, []);
      }
      porDia.get(diaKey)!.push(mov);
    }

    // Buscar papeletas aprobadas en el rango para calcular el estado "Justificado"
    const papeletasAprobadas = await prisma.papeleta.findMany({
      where: {
        estado: EstadoPapeleta.APROBADO,
        ...(fechaInicio ? { fechaInicio: { gte: parseFechaLocal(fechaInicio) } } : {}),
        ...(fechaFin ? { fechaFin: { lte: parseFechaLocal(fechaFin, true) } } : {}),
      },
    });

    function estaJustificado(usuarioId: number, dia: Date): boolean {
      const { inicio, fin } = obtenerRangoDelDia(dia);
      return papeletasAprobadas.some((p) => {
        if (p.solicitanteId !== usuarioId) return false;
        if (p.tipoTiempo === TipoTiempo.DIAS) {
          const { inicio: pInicio } = obtenerRangoDelDia(p.fechaInicio);
          const { fin: pFin } = obtenerRangoDelDia(p.fechaFin);
          return inicio >= pInicio && fin <= pFin;
        }
        return false;
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIGPER - UGEL Talara';
    const hoja = workbook.addWorksheet('Asistencias');

    hoja.columns = [
      { header: 'Nombre', key: 'nombre', width: 20 },
      { header: 'Apellidos', key: 'apellidos', width: 22 },
      { header: 'Jefatura', key: 'jefatura', width: 22 },
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Hora Entrada', key: 'horaEntrada', width: 14 },
      { header: 'Hora Salida', key: 'horaSalida', width: 14 },
      { header: 'Estado', key: 'estado', width: 16 },
    ];

    estilizarCabecera(hoja.getRow(1), hoja.columns.length);

    for (const [, porDia] of grupos) {
      for (const [diaKey, movsDelDia] of porDia) {
        const primero = movsDelDia[0];
        const usuario = primero.usuario;

        const entradas = movsDelDia.filter((m) => m.tipo === TipoMovimiento.ENTRADA);
        const salidas = movsDelDia.filter((m) => m.tipo === TipoMovimiento.SALIDA);

        const primeraEntrada = entradas[0];
        const ultimaSalida = salidas[salidas.length - 1];

        const dia = new Date(diaKey + 'T00:00:00');
        const estado = estaJustificado(usuario.id, dia) ? 'Justificado' : 'Presente';

        hoja.addRow({
          nombre: usuario.nombres,
          apellidos: usuario.apellidos,
          jefatura: usuario.jefatura?.nombre ?? '—',
          fecha: formatearFecha(dia),
          horaEntrada: primeraEntrada ? formatearHora(primeraEntrada.timestamp) : '—',
          horaSalida: ultimaSalida ? formatearHora(ultimaSalida.timestamp) : '—',
          estado,
        });
      }
    }

    await enviarExcel(res, workbook, `asistencias-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    console.error('Error en exportarAsistencias:', error);
    if (!res.headersSent) {
      res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/visitas/exportar
// ─────────────────────────────────────────────────────────────

const ROLES_SOLO_PROPIAS_VISITAS: Rol[] = [Rol.ESPECIALISTA, Rol.JEFE, Rol.DIRECTORA];

export async function exportarVisitas(req: Request, res: Response): Promise<void> {
  try {
    const usuarioToken = req.usuario;
    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const { fechaInicio, fechaFin, trabajadorVisitadoId, registradorId } = req.query as {
      fechaInicio?: string;
      fechaFin?: string;
      trabajadorVisitadoId?: string;
      registradorId?: string;
    };

    const where: Prisma.VisitaWhereInput = {};

    if (ROLES_SOLO_PROPIAS_VISITAS.includes(usuarioToken.rol)) {
      where.trabajadorVisitadoId = usuarioToken.id;
    } else {
      if (trabajadorVisitadoId !== undefined) {
        where.trabajadorVisitadoId = Number(trabajadorVisitadoId);
      }
      if (registradorId !== undefined) {
        where.registradorId = Number(registradorId);
      }
    }

    if (fechaInicio || fechaFin) {
      const filtro: Prisma.DateTimeFilter = {};
      if (fechaInicio) filtro.gte = parseFechaLocal(fechaInicio);
      if (fechaFin) filtro.lte = parseFechaLocal(fechaFin, true);
      where.horaEntrada = filtro;
    }

    const visitas = await prisma.visita.findMany({
      where,
      include: {
        trabajadorVisitado: { include: { jefatura: { select: { nombre: true } } } },
        registrador: { select: { nombres: true, apellidos: true } },
      },
      orderBy: { horaEntrada: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIGPER - UGEL Talara';
    const hoja = workbook.addWorksheet('Visitas');

    hoja.columns = [
      { header: 'Visitante', key: 'visitante', width: 28 },
      { header: 'DNI', key: 'dni', width: 12 },
      { header: 'Trabajador visitado', key: 'trabajador', width: 28 },
      { header: 'Jefatura', key: 'jefatura', width: 22 },
      { header: 'Hora entrada', key: 'horaEntrada', width: 20 },
      { header: 'Hora salida', key: 'horaSalida', width: 20 },
      { header: 'Gafete entregado', key: 'gafete', width: 18 },
    ];

    estilizarCabecera(hoja.getRow(1), hoja.columns.length);

    for (const visita of visitas) {
      hoja.addRow({
        visitante: visita.visitanteNombre,
        dni: visita.visitanteDni,
        trabajador: `${visita.trabajadorVisitado.nombres} ${visita.trabajadorVisitado.apellidos}`,
        jefatura: visita.trabajadorVisitado.jefatura?.nombre ?? '—',
        horaEntrada: formatearHora(visita.horaEntrada),
        horaSalida: formatearHora(visita.horaSalida),
        gafete: visita.gafeteEntregado ? 'Sí' : 'No',
      });
    }

    await enviarExcel(res, workbook, `visitas-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    console.error('Error en exportarVisitas:', error);
    if (!res.headersSent) {
      res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/papeletas/exportar
// ─────────────────────────────────────────────────────────────

const ETIQUETA_TIPO: Record<TipoTiempo, string> = { DIAS: 'Días', HORAS: 'Horas' };

const ETIQUETA_ESTADO: Record<EstadoPapeleta, string> = {
  PENDIENTE: 'Pendiente',
  EN_REVISION: 'En revisión',
  OBSERVADO: 'Observado',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  CANCELADO: 'Cancelado',
  ANULADO: 'Anulado',
  ANULACION_SOLICITADA: 'Anulación solicitada',
};

export async function exportarPapeletas(req: Request, res: Response): Promise<void> {
  try {
    const usuarioToken = req.usuario;
    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const { fechaInicio, fechaFin, estado, solicitanteId } = req.query as {
      fechaInicio?: string;
      fechaFin?: string;
      estado?: EstadoPapeleta;
      solicitanteId?: string;
    };

    const idsVisibles = await obtenerIdsVisibles(usuarioToken);

    const where: Prisma.PapeletaWhereInput = {};

    if (solicitanteId !== undefined) {
      const num = Number(solicitanteId);
      if (idsVisibles !== null && !idsVisibles.includes(num)) {
        res.status(403).json({ mensaje: 'No tiene permisos para ver las papeletas de este usuario' });
        return;
      }
      where.solicitanteId = num;
    } else if (idsVisibles !== null) {
      where.solicitanteId = { in: idsVisibles };
    }

    if (estado) where.estado = estado;

    // Filtro por fecha de creación (coherente con listado de papeletas)
    if (fechaInicio !== undefined) {
      const fecha = parseFechaLocal(fechaInicio);
      if (Number.isNaN(fecha.getTime())) {
        res.status(400).json({ mensaje: 'fechaInicio no es una fecha válida' });
        return;
      }
      where.fechaCreacion = { gte: fecha };
    }

    if (fechaFin !== undefined) {
      const fecha = parseFechaLocal(fechaFin, true);
      if (Number.isNaN(fecha.getTime())) {
        res.status(400).json({ mensaje: 'fechaFin no es una fecha válida' });
        return;
      }
      where.fechaCreacion = {
        ...(where.fechaCreacion as Prisma.DateTimeFilter),
        lte: fecha,
      };
    }

    const papeletas = await prisma.papeleta.findMany({
      where,
      include: {
        solicitante: { include: { jefatura: { select: { nombre: true } } } },
        aprobador: { select: { nombres: true, apellidos: true } },
      },
      orderBy: { fechaCreacion: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIGPER - UGEL Talara';
    const hoja = workbook.addWorksheet('Papeletas');

    hoja.columns = [
      { header: 'N° Papeleta', key: 'numero', width: 14 },
      { header: 'Solicitante', key: 'solicitante', width: 28 },
      { header: 'Jefatura', key: 'jefatura', width: 22 },
      { header: 'Tipo', key: 'tipo', width: 8 },
      { header: 'Fecha inicio', key: 'fechaInicio', width: 14 },
      { header: 'Fecha fin', key: 'fechaFin', width: 14 },
      { header: 'Hora salida', key: 'horaSalida', width: 12 },
      { header: 'Hora retorno', key: 'horaRetorno', width: 14 },
      { header: 'Motivo', key: 'motivo', width: 30 },
      { header: 'Estado', key: 'estado', width: 20 },
      { header: 'Aprobador', key: 'aprobador', width: 28 },
      { header: 'Fecha creación', key: 'fechaCreacion', width: 16 },
    ];

    estilizarCabecera(hoja.getRow(1), hoja.columns.length);

    for (const papeleta of papeletas) {
      const motivo =
        papeleta.motivo === 'Otros' && papeleta.motivoOtros
          ? `Otros: ${papeleta.motivoOtros}`
          : papeleta.motivo;

      hoja.addRow({
        numero: papeleta.numero,
        solicitante: `${papeleta.solicitante.nombres} ${papeleta.solicitante.apellidos}`,
        jefatura: papeleta.solicitante.jefatura?.nombre ?? '—',
        tipo: ETIQUETA_TIPO[papeleta.tipoTiempo],
        fechaInicio: formatearFecha(papeleta.fechaInicio),
        fechaFin: formatearFecha(papeleta.fechaFin),
        horaSalida: formatearHora(papeleta.horaSalida),
        horaRetorno: formatearHora(papeleta.horaRetorno),
        motivo,
        estado: ETIQUETA_ESTADO[papeleta.estado],
        aprobador: papeleta.aprobador
          ? `${papeleta.aprobador.nombres} ${papeleta.aprobador.apellidos}`
          : '—',
        fechaCreacion: formatearFecha(papeleta.fechaCreacion),
      });
    }

    await enviarExcel(res, workbook, `papeletas-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    console.error('Error en exportarPapeletas:', error);
    if (!res.headersSent) {
      res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
  }
}