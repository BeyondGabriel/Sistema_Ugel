// ===========================================================
// Controlador del módulo de papeletas
// ===========================================================

import { Request, Response } from 'express';
import { TipoTiempo, EstadoPapeleta, Rol, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import {
  generarNumeroPapeleta,
  generarTokenUnico,
  determinarAprobador,
  AprobadorNoEncontradoError,
  aplicarBloqueos,
  revertirSiExpiro,
} from '../services/papeleta.service';
import { notificar } from '../services/notificacion.service';
import { MOTIVO_OTROS, esMotivoValido } from '../utils/motivosPapeleta';
import { obtenerIdsVisibles, usuarioPuedeVerPapeleta } from '../services/visibilidadPapeletas.service';

interface CamposPapeletaInput {
  tipoTiempo?: TipoTiempo;
  fechaInicio?: string;
  fechaFin?: string;
  horaSalida?: string;
  horaRetorno?: string;
  motivo?: string;
  motivoOtros?: string;
}

interface CamposPapeletaNormalizados {
  tipoTiempo: TipoTiempo;
  fechaInicio: Date;
  fechaFin: Date;
  horaSalida: Date | null;
  horaRetorno: Date | null;
  motivo: string;
  motivoOtros: string | null;
}

type ResultadoValidacion =
  | { ok: true; campos: CamposPapeletaNormalizados }
  | { ok: false; mensaje: string };

/**
 * Convierte una fecha YYYY-MM-DD a un objeto Date local.
 * Si `finDelDia` es true, la hora se fija a 23:59:59.999.
 */
function parseFechaLocal(fecha: string, finDelDia = false): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  if (finDelDia) {
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }
  return new Date(y, m - 1, d);
}

/**
 * Valida y normaliza los campos editables de una papeleta. Se usa tanto al
 * crearla como al reenviarla tras una observación, ya que ambos flujos
 * comparten exactamente las mismas reglas de validación.
 */
function validarCamposPapeleta(input: CamposPapeletaInput): ResultadoValidacion {
  const { tipoTiempo, fechaInicio, fechaFin, horaSalida, horaRetorno, motivo, motivoOtros } = input;

  if (!tipoTiempo || !motivo) {
    return { ok: false, mensaje: 'tipoTiempo y motivo son obligatorios' };
  }

  if (tipoTiempo !== TipoTiempo.DIAS && tipoTiempo !== TipoTiempo.HORAS) {
    return { ok: false, mensaje: 'tipoTiempo debe ser DIAS u HORAS' };
  }

  if (!esMotivoValido(motivo)) {
    return { ok: false, mensaje: 'El motivo especificado no es válido' };
  }

  if (motivo === MOTIVO_OTROS && !motivoOtros) {
    return { ok: false, mensaje: 'motivoOtros es obligatorio cuando el motivo es "Otros"' };
  }

  const motivoOtrosFinal = motivo === MOTIVO_OTROS ? motivoOtros ?? null : null;

  if (tipoTiempo === TipoTiempo.DIAS) {
    if (!fechaInicio || !fechaFin) {
      return { ok: false, mensaje: 'fechaInicio y fechaFin son obligatorios para papeletas de tipo DIAS' };
    }

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
      return { ok: false, mensaje: 'fechaInicio o fechaFin no son fechas válidas' };
    }

    if (fin < inicio) {
      return { ok: false, mensaje: 'fechaFin debe ser mayor o igual a fechaInicio' };
    }

    return {
      ok: true,
      campos: {
        tipoTiempo,
        fechaInicio: inicio,
        fechaFin: fin,
        horaSalida: null,
        horaRetorno: null,
        motivo,
        motivoOtros: motivoOtrosFinal,
      },
    };
  }

  // tipoTiempo === HORAS
  if (!horaSalida || !horaRetorno) {
    return { ok: false, mensaje: 'horaSalida y horaRetorno son obligatorios para papeletas de tipo HORAS' };
  }

  const salida = new Date(horaSalida);
  const retorno = new Date(horaRetorno);

  if (Number.isNaN(salida.getTime()) || Number.isNaN(retorno.getTime())) {
    return { ok: false, mensaje: 'horaSalida o horaRetorno no son fechas/horas válidas' };
  }

  if (retorno <= salida) {
    return { ok: false, mensaje: 'horaRetorno debe ser posterior a horaSalida' };
  }

  const mismoDia =
    salida.getFullYear() === retorno.getFullYear() &&
    salida.getMonth() === retorno.getMonth() &&
    salida.getDate() === retorno.getDate();

  if (!mismoDia) {
    return { ok: false, mensaje: 'horaSalida y horaRetorno deben ser del mismo día' };
  }

  return {
    ok: true,
    campos: {
      tipoTiempo,
      fechaInicio: salida,
      fechaFin: retorno,
      horaSalida: salida,
      horaRetorno: retorno,
      motivo,
      motivoOtros: motivoOtrosFinal,
    },
  };
}

/**
 * POST /api/papeletas
 * Roles: ESPECIALISTA, JEFE, VIGILANTE, RRHH, ADMIN, DIRECTORA.
 * Crea una papeleta, calcula su número anual, determina el aprobador
 * según la jerarquía y, si el solicitante es Directora, la auto-aprueba.
 */
export async function crearPapeleta(req: Request, res: Response): Promise<void> {
  try {
    const usuarioToken = req.usuario;
    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const resultado = validarCamposPapeleta(req.body as CamposPapeletaInput);
    if (!resultado.ok) {
      res.status(400).json({ mensaje: resultado.mensaje });
      return;
    }

    const { campos } = resultado;

    let aprobadorId: number | null;
    try {
      aprobadorId = await determinarAprobador(usuarioToken.id);
    } catch (error) {
      if (error instanceof AprobadorNoEncontradoError) {
        res.status(400).json({ mensaje: 'No hay un aprobador disponible para su rol' });
        return;
      }
      throw error;
    }

    const esAutoAprobada = usuarioToken.rol === Rol.DIRECTORA;
    const año = campos.fechaInicio.getFullYear();

    const nuevaPapeleta = await prisma.$transaction(async (tx) => {
      const numero = await generarNumeroPapeleta(año, tx);

      const datos: Prisma.PapeletaCreateInput = {
        numero,
        tipoTiempo: campos.tipoTiempo,
        fechaInicio: campos.fechaInicio,
        fechaFin: campos.fechaFin,
        horaSalida: campos.horaSalida,
        horaRetorno: campos.horaRetorno,
        motivo: campos.motivo,
        motivoOtros: campos.motivoOtros,
        estado: esAutoAprobada ? EstadoPapeleta.APROBADO : EstadoPapeleta.PENDIENTE,
        solicitante: { connect: { id: usuarioToken.id } },
      };

      if (esAutoAprobada) {
        datos.token = await generarTokenUnico();
      } else if (aprobadorId !== null) {
        datos.aprobador = { connect: { id: aprobadorId } };
      }

      return tx.papeleta.create({ data: datos });
    });

    res.status(201).json({ papeleta: nuevaPapeleta });
  } catch (error) {
    console.error('Error en crearPapeleta:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * GET /api/papeletas
 * Lista papeletas con visibilidad y filtros según el rol del usuario.
 * Los filtros de fecha se aplican a la fecha de creación de la papeleta.
 */
export async function listarPapeletas(req: Request, res: Response): Promise<void> {
  try {
    const usuarioToken = req.usuario;
    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const { estado, solicitanteId, fechaInicio, fechaFin } = req.query as {
      estado?: EstadoPapeleta;
      solicitanteId?: string;
      fechaInicio?: string;
      fechaFin?: string;
    };

    const idsVisibles = await obtenerIdsVisibles(usuarioToken);

    const where: Prisma.PapeletaWhereInput = {};

    if (solicitanteId !== undefined) {
      const solicitanteIdNum = Number(solicitanteId);
      if (Number.isNaN(solicitanteIdNum)) {
        res.status(400).json({ mensaje: 'solicitanteId debe ser numérico' });
        return;
      }

      if (idsVisibles !== null && !idsVisibles.includes(solicitanteIdNum)) {
        res.status(403).json({ mensaje: 'No tiene permisos para ver las papeletas de este usuario' });
        return;
      }

      where.solicitanteId = solicitanteIdNum;
    } else if (idsVisibles !== null) {
      where.solicitanteId = { in: idsVisibles };
    }

    if (estado !== undefined) {
      if (!Object.values(EstadoPapeleta).includes(estado)) {
        res.status(400).json({ mensaje: 'El estado especificado no es válido' });
        return;
      }
      where.estado = estado;
    }

    // Filtro por fecha de creación (no por fecha de inicio)
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
      // Si ya existe un filtro de fechaCreacion, lo conservamos
      where.fechaCreacion = {
        ...(where.fechaCreacion as Prisma.DateTimeFilter),
        lte: fecha,
      };
    }

    const papeletas = await prisma.papeleta.findMany({
      where,
      include: {
        solicitante: { select: { id: true, nombres: true, apellidos: true } },
        aprobador: { select: { id: true, nombres: true, apellidos: true } },
      },
      orderBy: { fechaCreacion: 'desc' },
    });

    res.status(200).json({ papeletas });
  } catch (error) {
    console.error('Error en listarPapeletas:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * GET /api/papeletas/:id
 * Obtiene una papeleta por id, validando visibilidad según rol y
 * aplicando el timeout de "En revisión" antes de devolverla.
 */
export async function obtenerPapeleta(req: Request, res: Response): Promise<void> {
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

    let papeleta = await prisma.papeleta.findUnique({
      where: { id },
      include: {
        solicitante: { select: { id: true, nombres: true, apellidos: true } },
        aprobador: { select: { id: true, nombres: true, apellidos: true } },
      },
    });

    if (!papeleta) {
      res.status(404).json({ mensaje: 'Papeleta no encontrada' });
      return;
    }

    const puedeVer = await usuarioPuedeVerPapeleta(usuarioToken, papeleta.solicitanteId);
    if (!puedeVer) {
      res.status(403).json({ mensaje: 'No tiene permisos para ver esta papeleta' });
      return;
    }

    papeleta = await revertirSiExpiro(papeleta);

    res.status(200).json({ papeleta });
  } catch (error) {
    console.error('Error en obtenerPapeleta:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * PUT /api/papeletas/:id/revisar
 * Solo el aprobador asignado. PENDIENTE → EN_REVISION, fechaRevision = now().
 */
export async function iniciarRevision(req: Request, res: Response): Promise<void> {
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

    let papeleta = await prisma.papeleta.findUnique({ where: { id } });
    if (!papeleta) {
      res.status(404).json({ mensaje: 'Papeleta no encontrada' });
      return;
    }

    papeleta = await revertirSiExpiro(papeleta);

    if (papeleta.aprobadorId !== usuarioToken.id) {
      res.status(403).json({ mensaje: 'Solo el aprobador asignado puede iniciar la revisión de esta papeleta' });
      return;
    }

    if (papeleta.estado !== EstadoPapeleta.PENDIENTE) {
      res.status(409).json({
        mensaje: `No se puede iniciar la revisión: la papeleta está en estado ${papeleta.estado}`,
      });
      return;
    }

    const papeletaActualizada = await prisma.papeleta.update({
      where: { id },
      data: { estado: EstadoPapeleta.EN_REVISION, fechaRevision: new Date() },
    });

    res.status(200).json({ papeleta: papeletaActualizada });
  } catch (error) {
    console.error('Error en iniciarRevision:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * PUT /api/papeletas/:id/aprobar
 * Solo el aprobador asignado. EN_REVISION → APROBADO, genera token,
 * aplica bloqueos de asistencia y notifica al solicitante.
 */
export async function aprobarPapeleta(req: Request, res: Response): Promise<void> {
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

    let papeleta = await prisma.papeleta.findUnique({ where: { id } });
    if (!papeleta) {
      res.status(404).json({ mensaje: 'Papeleta no encontrada' });
      return;
    }

    papeleta = await revertirSiExpiro(papeleta);

    if (papeleta.aprobadorId !== usuarioToken.id) {
      res.status(403).json({ mensaje: 'Solo el aprobador asignado puede aprobar esta papeleta' });
      return;
    }

    if (papeleta.estado !== EstadoPapeleta.EN_REVISION) {
      res.status(409).json({
        mensaje: `No se puede aprobar: la papeleta debe estar EN_REVISION (estado actual: ${papeleta.estado})`,
      });
      return;
    }

    const token = await generarTokenUnico();

    const papeletaActualizada = await prisma.papeleta.update({
      where: { id },
      data: {
        estado: EstadoPapeleta.APROBADO,
        token,
        aprobadorId: papeleta.aprobadorId ?? usuarioToken.id,
      },
    });

    await aplicarBloqueos(papeletaActualizada.id);

    notificar(
      papeletaActualizada.solicitanteId,
      `Su papeleta ${papeletaActualizada.numero} fue aprobada. Token de verificación: ${token}`,
    );

    res.status(200).json({ papeleta: papeletaActualizada });
  } catch (error) {
    console.error('Error en aprobarPapeleta:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * PUT /api/papeletas/:id/rechazar
 * Solo el aprobador asignado. EN_REVISION → RECHAZADO. Requiere motivoRechazo.
 */
export async function rechazarPapeleta(req: Request, res: Response): Promise<void> {
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

    const { motivoRechazo } = req.body as { motivoRechazo?: string };
    if (!motivoRechazo) {
      res.status(400).json({ mensaje: 'motivoRechazo es obligatorio' });
      return;
    }

    let papeleta = await prisma.papeleta.findUnique({ where: { id } });
    if (!papeleta) {
      res.status(404).json({ mensaje: 'Papeleta no encontrada' });
      return;
    }

    papeleta = await revertirSiExpiro(papeleta);

    if (papeleta.aprobadorId !== usuarioToken.id) {
      res.status(403).json({ mensaje: 'Solo el aprobador asignado puede rechazar esta papeleta' });
      return;
    }

    if (papeleta.estado !== EstadoPapeleta.EN_REVISION) {
      res.status(409).json({
        mensaje: `No se puede rechazar: la papeleta debe estar EN_REVISION (estado actual: ${papeleta.estado})`,
      });
      return;
    }

    const papeletaActualizada = await prisma.papeleta.update({
      where: { id },
      data: { estado: EstadoPapeleta.RECHAZADO, motivoRechazo },
    });

    notificar(
      papeletaActualizada.solicitanteId,
      `Su papeleta ${papeletaActualizada.numero} fue rechazada. Motivo: ${motivoRechazo}`,
    );

    res.status(200).json({ papeleta: papeletaActualizada });
  } catch (error) {
    console.error('Error en rechazarPapeleta:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * PUT /api/papeletas/:id/observar
 * Solo el aprobador asignado. EN_REVISION → OBSERVADO. Requiere comentario,
 * que se guarda temporalmente en motivoRechazo.
 */
export async function observarPapeleta(req: Request, res: Response): Promise<void> {
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

    const { comentario } = req.body as { comentario?: string };
    if (!comentario) {
      res.status(400).json({ mensaje: 'comentario es obligatorio' });
      return;
    }

    let papeleta = await prisma.papeleta.findUnique({ where: { id } });
    if (!papeleta) {
      res.status(404).json({ mensaje: 'Papeleta no encontrada' });
      return;
    }

    papeleta = await revertirSiExpiro(papeleta);

    if (papeleta.aprobadorId !== usuarioToken.id) {
      res.status(403).json({ mensaje: 'Solo el aprobador asignado puede observar esta papeleta' });
      return;
    }

    if (papeleta.estado !== EstadoPapeleta.EN_REVISION) {
      res.status(409).json({
        mensaje: `No se puede observar: la papeleta debe estar EN_REVISION (estado actual: ${papeleta.estado})`,
      });
      return;
    }

    const papeletaActualizada = await prisma.papeleta.update({
      where: { id },
      data: { estado: EstadoPapeleta.OBSERVADO, motivoRechazo: comentario },
    });

    notificar(
      papeletaActualizada.solicitanteId,
      `Su papeleta ${papeletaActualizada.numero} fue observada. Comentario: ${comentario}`,
    );

    res.status(200).json({ papeleta: papeletaActualizada });
  } catch (error) {
    console.error('Error en observarPapeleta:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * PUT /api/papeletas/:id/cancelar
 * Solo el solicitante. Permitido desde PENDIENTE u OBSERVADO → CANCELADO.
 */
export async function cancelarPapeleta(req: Request, res: Response): Promise<void> {
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

    let papeleta = await prisma.papeleta.findUnique({ where: { id } });
    if (!papeleta) {
      res.status(404).json({ mensaje: 'Papeleta no encontrada' });
      return;
    }

    papeleta = await revertirSiExpiro(papeleta);

    if (papeleta.solicitanteId !== usuarioToken.id) {
      res.status(403).json({ mensaje: 'Solo el solicitante puede cancelar esta papeleta' });
      return;
    }

    if (papeleta.estado !== EstadoPapeleta.PENDIENTE && papeleta.estado !== EstadoPapeleta.OBSERVADO) {
      res.status(409).json({ mensaje: `No se puede cancelar: la papeleta está en estado ${papeleta.estado}` });
      return;
    }

    const papeletaActualizada = await prisma.papeleta.update({
      where: { id },
      data: { estado: EstadoPapeleta.CANCELADO },
    });

    res.status(200).json({ papeleta: papeletaActualizada });
  } catch (error) {
    console.error('Error en cancelarPapeleta:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * PUT /api/papeletas/:id/reenviar
 * Solo el solicitante, cuando el estado es OBSERVADO. Actualiza los campos
 * editables, vuelve a PENDIENTE y mantiene el mismo número.
 */
export async function reenviarPapeleta(req: Request, res: Response): Promise<void> {
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

    let papeleta = await prisma.papeleta.findUnique({ where: { id } });
    if (!papeleta) {
      res.status(404).json({ mensaje: 'Papeleta no encontrada' });
      return;
    }

    papeleta = await revertirSiExpiro(papeleta);

    if (papeleta.solicitanteId !== usuarioToken.id) {
      res.status(403).json({ mensaje: 'Solo el solicitante puede reenviar esta papeleta' });
      return;
    }

    if (papeleta.estado !== EstadoPapeleta.OBSERVADO) {
      res.status(409).json({
        mensaje: `No se puede reenviar: la papeleta debe estar OBSERVADO (estado actual: ${papeleta.estado})`,
      });
      return;
    }

    const resultado = validarCamposPapeleta(req.body as CamposPapeletaInput);
    if (!resultado.ok) {
      res.status(400).json({ mensaje: resultado.mensaje });
      return;
    }

    const { campos } = resultado;

    const papeletaActualizada = await prisma.papeleta.update({
      where: { id },
      data: {
        tipoTiempo: campos.tipoTiempo,
        fechaInicio: campos.fechaInicio,
        fechaFin: campos.fechaFin,
        horaSalida: campos.horaSalida,
        horaRetorno: campos.horaRetorno,
        motivo: campos.motivo,
        motivoOtros: campos.motivoOtros,
        estado: EstadoPapeleta.PENDIENTE,
        motivoRechazo: null,
      },
    });

    res.status(200).json({ papeleta: papeletaActualizada });
  } catch (error) {
    console.error('Error en reenviarPapeleta:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}