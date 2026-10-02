// ===========================================================
// Controlador del módulo de papeletas
// ===========================================================

import { Request, Response } from 'express';
import { z } from 'zod';
import { EstadoPapeleta, Rol, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import {
  generarNumeroPapeleta,
  generarTokenUnico,
  determinarAprobador,
  AprobadorNoEncontradoError,
  aplicarBloqueos,
  revertirSiExpiro,
  esAprobadorVigente,
} from '../services/papeleta.service';
import { notificar } from '../services/notificacion.service';
import { parseFechaLocal } from '../utils/fechas';
import { obtenerIdsVisibles, usuarioPuedeVerPapeleta } from '../services/visibilidadPapeletas.service';
import {
  papeletaSchema,
  rechazarPapeletaSchema,
  observarPapeletaSchema,
  papeletaIdParamsSchema,
  listarPapeletasQuerySchema,
} from '../schemas/papeleta.schema';

/**
 * POST /api/papeletas
 * Roles: ESPECIALISTA, JEFE, VIGILANTE, RRHH, ADMIN, DIRECTORA.
 * Crea una papeleta, calcula su número anual, determina el aprobador
 * según la jerarquía y, si el solicitante es Directora, la auto-aprueba.
 */
export async function crearPapeleta(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const usuarioToken = req.usuario;

    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    // Los datos ya llegan validados y normalizados (Date) por papeletaSchema.
    const campos = req.body as z.infer<typeof papeletaSchema>;

    let aprobadorId: number | null;

    try {
      aprobadorId = await determinarAprobador(usuarioToken.id);
    } catch (error) {
      if (error instanceof AprobadorNoEncontradoError) {
        res.status(400).json({
          mensaje: 'No hay un aprobador disponible para su rol',
        });
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
        estado: esAutoAprobada
          ? EstadoPapeleta.APROBADO
          : EstadoPapeleta.PENDIENTE,
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
export async function listarPapeletas(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const usuarioToken = req.usuario;

    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const { estado, solicitanteId, fechaInicio, fechaFin } =
      req.query as unknown as z.infer<typeof listarPapeletasQuerySchema>;

    const idsVisibles = await obtenerIdsVisibles(usuarioToken);

    const where: Prisma.PapeletaWhereInput = {};

    if (solicitanteId !== undefined) {
      if (idsVisibles !== null && !idsVisibles.includes(solicitanteId)) {
        res.status(403).json({
          mensaje: 'No tiene permisos para ver las papeletas de este usuario',
        });
        return;
      }

      where.solicitanteId = solicitanteId;
    } else if (idsVisibles !== null) {
      where.solicitanteId = { in: idsVisibles };
    }

    if (estado !== undefined) {
      where.estado = estado;
    }

    // Filtro por fecha de creación (no por fecha de inicio). El rango ya fue
    // validado por listarPapeletasQuerySchema.
    if (fechaInicio !== undefined || fechaFin !== undefined) {
      const filtroFecha: Prisma.DateTimeFilter = {};

      if (fechaInicio !== undefined) {
        filtroFecha.gte = parseFechaLocal(fechaInicio);
      }

      if (fechaFin !== undefined) {
        filtroFecha.lte = parseFechaLocal(fechaFin, true);
      }

      where.fechaCreacion = filtroFecha;
    }

    const papeletas = await prisma.papeleta.findMany({
      where,
      include: {
        solicitante: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
          },
        },
        aprobador: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
      orderBy: { fechaCreacion: 'desc' },
    });

    res.status(200).json({ papeletas });
  } catch (error) {
    console.error('Error en listarPapeletas:', error);
    res.status(500).json({
      mensaje: 'Error interno del servidor',
    });
  }
}

/**
 * GET /api/papeletas/:id
 * Obtiene una papeleta por id, validando visibilidad según rol y
 * aplicando el timeout de "En revisión" antes de devolverla.
 */
export async function obtenerPapeleta(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof papeletaIdParamsSchema>;

    const usuarioToken = req.usuario;

    if (!usuarioToken) {
      res.status(401).json({
        mensaje: 'No autenticado',
      });
      return;
    }

    let papeleta = await prisma.papeleta.findUnique({
      where: { id },
      include: {
        solicitante: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
          },
        },
        aprobador: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    if (!papeleta) {
      res.status(404).json({
        mensaje: 'Papeleta no encontrada',
      });
      return;
    }

    const puedeVer = await usuarioPuedeVerPapeleta(
      usuarioToken,
      papeleta.solicitanteId
    );

    if (!puedeVer) {
      res.status(403).json({
        mensaje: 'No tiene permisos para ver esta papeleta',
      });
      return;
    }

    papeleta = await revertirSiExpiro(papeleta);

    res.status(200).json({ papeleta });
  } catch (error) {
    console.error('Error en obtenerPapeleta:', error);
    res.status(500).json({
      mensaje: 'Error interno del servidor',
    });
  }
}

/**
 * PUT /api/papeletas/:id/revisar
 * Solo el aprobador asignado. PENDIENTE → EN_REVISION, fechaRevision = now().
 */
export async function iniciarRevision(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof papeletaIdParamsSchema>;

    const usuarioToken = req.usuario;

    if (!usuarioToken) {
      res.status(401).json({
        mensaje: 'No autenticado',
      });
      return;
    }

    let papeleta = await prisma.papeleta.findUnique({
      where: { id },
    });

    if (!papeleta) {
      res.status(404).json({
        mensaje: 'Papeleta no encontrada',
      });
      return;
    }

    papeleta = await revertirSiExpiro(papeleta);

    // Autorización viva (A-02): el aprobador asignado debe seguir siendo el
    // aprobador VIGENTE del solicitante según la jerarquía actual.
    const esAprobadorAsignado = papeleta.aprobadorId === usuarioToken.id;
    const sigueSiendoAprobador =
      esAprobadorAsignado &&
      (await esAprobadorVigente(papeleta.solicitanteId, usuarioToken.id));

    if (!sigueSiendoAprobador) {
      res.status(403).json({
        mensaje:
          'Solo el aprobador vigente puede iniciar la revisión de esta papeleta',
      });
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
      data: {
        estado: EstadoPapeleta.EN_REVISION,
        fechaRevision: new Date(),
      },
    });

    res.status(200).json({
      papeleta: papeletaActualizada,
    });
  } catch (error) {
    console.error('Error en iniciarRevision:', error);
    res.status(500).json({
      mensaje: 'Error interno del servidor',
    });
  }
}

/**
 * PUT /api/papeletas/:id/aprobar
 * Solo el aprobador asignado. EN_REVISION → APROBADO, genera token,
 * aplica bloqueos de asistencia y notifica al solicitante.
 */
export async function aprobarPapeleta(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof papeletaIdParamsSchema>;

    const usuarioToken = req.usuario;

    if (!usuarioToken) {
      res.status(401).json({
        mensaje: 'No autenticado',
      });
      return;
    }

    let papeleta = await prisma.papeleta.findUnique({
      where: { id },
    });

    if (!papeleta) {
      res.status(404).json({
        mensaje: 'Papeleta no encontrada',
      });
      return;
    }

    papeleta = await revertirSiExpiro(papeleta);

    // Autorización viva (A-02): además de ser el aprobador asignado, el usuario
    // debe seguir siendo el aprobador VIGENTE del solicitante según la
    // jerarquía actual en la base de datos.
    const esAprobadorAsignado = papeleta.aprobadorId === usuarioToken.id;
    const sigueSiendoAprobador =
      esAprobadorAsignado &&
      (await esAprobadorVigente(papeleta.solicitanteId, usuarioToken.id));

    if (!sigueSiendoAprobador) {
      res.status(403).json({
        mensaje: 'Solo el aprobador vigente puede aprobar esta papeleta',
      });
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
      `Su papeleta ${papeletaActualizada.numero} fue aprobada. Token de verificación: ${token}`
    );

    res.status(200).json({
      papeleta: papeletaActualizada,
    });
  } catch (error) {
    console.error('Error en aprobarPapeleta:', error);
    res.status(500).json({
      mensaje: 'Error interno del servidor',
    });
  }
}

/**
 * PUT /api/papeletas/:id/rechazar
 * Solo el aprobador asignado. EN_REVISION → RECHAZADO. Requiere motivoRechazo.
 */
export async function rechazarPapeleta(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof papeletaIdParamsSchema>;

    const usuarioToken = req.usuario;

    if (!usuarioToken) {
      res.status(401).json({
        mensaje: 'No autenticado',
      });
      return;
    }

    const { motivoRechazo } = req.body as z.infer<typeof rechazarPapeletaSchema>;

    let papeleta = await prisma.papeleta.findUnique({
      where: { id },
    });

    if (!papeleta) {
      res.status(404).json({
        mensaje: 'Papeleta no encontrada',
      });
      return;
    }

    papeleta = await revertirSiExpiro(papeleta);

    // Autorización viva (A-02): el aprobador asignado debe seguir siendo el
    // aprobador vigente del solicitante.
    const esAprobadorAsignado = papeleta.aprobadorId === usuarioToken.id;
    const sigueSiendoAprobador =
      esAprobadorAsignado &&
      (await esAprobadorVigente(papeleta.solicitanteId, usuarioToken.id));

    if (!sigueSiendoAprobador) {
      res.status(403).json({
        mensaje: 'Solo el aprobador vigente puede rechazar esta papeleta',
      });
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
      data: {
        estado: EstadoPapeleta.RECHAZADO,
        motivoRechazo,
      },
    });

    notificar(
      papeletaActualizada.solicitanteId,
      `Su papeleta ${papeletaActualizada.numero} fue rechazada. Motivo: ${motivoRechazo}`
    );

    res.status(200).json({
      papeleta: papeletaActualizada,
    });
  } catch (error) {
    console.error('Error en rechazarPapeleta:', error);
    res.status(500).json({
      mensaje: 'Error interno del servidor',
    });
  }
}

/**
 * PUT /api/papeletas/:id/observar
 * Solo el aprobador asignado. EN_REVISION → OBSERVADO. Requiere comentario,
 * que se guarda temporalmente en motivoRechazo.
 */
export async function observarPapeleta(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof papeletaIdParamsSchema>;

    const usuarioToken = req.usuario;

    if (!usuarioToken) {
      res.status(401).json({
        mensaje: 'No autenticado',
      });
      return;
    }

    const { comentario } = req.body as z.infer<typeof observarPapeletaSchema>;

    let papeleta = await prisma.papeleta.findUnique({
      where: { id },
    });

    if (!papeleta) {
      res.status(404).json({
        mensaje: 'Papeleta no encontrada',
      });
      return;
    }

    papeleta = await revertirSiExpiro(papeleta);

    // Autorización viva (A-02): el aprobador asignado debe seguir siendo el
    // aprobador vigente del solicitante.
    const esAprobadorAsignado = papeleta.aprobadorId === usuarioToken.id;
    const sigueSiendoAprobador =
      esAprobadorAsignado &&
      (await esAprobadorVigente(papeleta.solicitanteId, usuarioToken.id));

    if (!sigueSiendoAprobador) {
      res.status(403).json({
        mensaje: 'Solo el aprobador vigente puede observar esta papeleta',
      });
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
      data: {
        estado: EstadoPapeleta.OBSERVADO,
        motivoRechazo: comentario,
      },
    });

    notificar(
      papeletaActualizada.solicitanteId,
      `Su papeleta ${papeletaActualizada.numero} fue observada. Comentario: ${comentario}`
    );

    res.status(200).json({
      papeleta: papeletaActualizada,
    });
  } catch (error) {
    console.error('Error en observarPapeleta:', error);
    res.status(500).json({
      mensaje: 'Error interno del servidor',
    });
  }
}

/**
 * PUT /api/papeletas/:id/cancelar
 * Solo el solicitante. Permitido desde PENDIENTE u OBSERVADO → CANCELADO.
 */
export async function cancelarPapeleta(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof papeletaIdParamsSchema>;

    const usuarioToken = req.usuario;

    if (!usuarioToken) {
      res.status(401).json({
        mensaje: 'No autenticado',
      });
      return;
    }

    let papeleta = await prisma.papeleta.findUnique({
      where: { id },
    });

    if (!papeleta) {
      res.status(404).json({
        mensaje: 'Papeleta no encontrada',
      });
      return;
    }

    papeleta = await revertirSiExpiro(papeleta);

    if (papeleta.solicitanteId !== usuarioToken.id) {
      res.status(403).json({
        mensaje: 'Solo el solicitante puede cancelar esta papeleta',
      });
      return;
    }

    if (
      papeleta.estado !== EstadoPapeleta.PENDIENTE &&
      papeleta.estado !== EstadoPapeleta.OBSERVADO
    ) {
      res.status(409).json({
        mensaje: `No se puede cancelar: la papeleta está en estado ${papeleta.estado}`,
      });
      return;
    }

    const papeletaActualizada = await prisma.papeleta.update({
      where: { id },
      data: { estado: EstadoPapeleta.CANCELADO },
    });

    res.status(200).json({
      papeleta: papeletaActualizada,
    });
  } catch (error) {
    console.error('Error en cancelarPapeleta:', error);
    res.status(500).json({
      mensaje: 'Error interno del servidor',
    });
  }
}

/**
 * PUT /api/papeletas/:id/reenviar
 * Solo el solicitante, cuando el estado es OBSERVADO. Actualiza los campos
 * editables, vuelve a PENDIENTE y mantiene el mismo número.
 */
export async function reenviarPapeleta(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof papeletaIdParamsSchema>;

    const usuarioToken = req.usuario;

    if (!usuarioToken) {
      res.status(401).json({
        mensaje: 'No autenticado',
      });
      return;
    }

    let papeleta = await prisma.papeleta.findUnique({
      where: { id },
    });

    if (!papeleta) {
      res.status(404).json({
        mensaje: 'Papeleta no encontrada',
      });
      return;
    }

    papeleta = await revertirSiExpiro(papeleta);

    if (papeleta.solicitanteId !== usuarioToken.id) {
      res.status(403).json({
        mensaje: 'Solo el solicitante puede reenviar esta papeleta',
      });
      return;
    }

    if (papeleta.estado !== EstadoPapeleta.OBSERVADO) {
      res.status(409).json({
        mensaje:
          `No se puede reenviar: la papeleta debe estar OBSERVADO (estado actual: ${papeleta.estado})`,
      });
      return;
    }

    // Los datos ya llegan validados y normalizados (Date) por papeletaSchema.
    const campos = req.body as z.infer<typeof papeletaSchema>;

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

    res.status(200).json({
      papeleta: papeletaActualizada,
    });
  } catch (error) {
    console.error('Error en reenviarPapeleta:', error);
    res.status(500).json({
      mensaje: 'Error interno del servidor',
    });
  }
}