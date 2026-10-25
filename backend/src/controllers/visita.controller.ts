// ===========================================================
// Controlador del módulo de visitas
// ===========================================================

import { Request, Response } from 'express';
import { z } from 'zod';
import { Rol, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { verificarPresencia } from '../services/visita.service';
import { obtenerIdsEquipo } from '../services/visibilidadPapeletas.service';
import { notificar } from '../services/notificacion.service';
import { parseFechaLocal } from '../utils/fechas';
import {
  registrarVisitaSchema,
  visitaIdParamsSchema,
  listarVisitasQuerySchema,
} from '../schemas/visita.schema';

/** Roles que solo pueden ver las visitas que ellos mismos recibieron. */
const ROLES_SOLO_PROPIAS_RECIBIDAS: Rol[] = [Rol.ESPECIALISTA];

/** Alcance solicitado por el cliente para los roles con equipo a cargo. */
type AlcanceConsulta = 'propios' | 'equipo';

/**
 * Resuelve los ids de trabajadores cuyas visitas puede ver el usuario
 * autenticado (Bloque A):
 * - ESPECIALISTA: solo las que él recibió.
 * - JEFE: las de su equipo (él + subordinados) o solo las propias.
 * - DIRECTORA: sin restricción (null) por su alcance institucional; solo las
 *   propias si alcance='propios'.
 * - VIGILANTE, RRHH, ADMIN: null → todas.
 */
async function resolverIdsVisitados(
  usuarioToken: Express.Request['usuario'],
  alcance: AlcanceConsulta | undefined,
): Promise<number[] | null> {
  if (!usuarioToken) {
    return [];
  }

  if (ROLES_SOLO_PROPIAS_RECIBIDAS.includes(usuarioToken.rol)) {
    return [usuarioToken.id];
  }

  if (usuarioToken.rol === Rol.DIRECTORA) {
    if (alcance === 'propios') {
      return [usuarioToken.id];
    }

    return null;
  }

  if (usuarioToken.rol === Rol.JEFE) {
    if (alcance === 'propios') {
      return [usuarioToken.id];
    }

    return obtenerIdsEquipo(usuarioToken);
  }

  return null;
}


/**
 * POST /api/visitas
 * Roles: VIGILANTE, ADMIN.
 * Verifica que el trabajador visitado esté presente antes de registrar.
 */
export async function registrarVisita(req: Request, res: Response): Promise<void> {
  try {
    const usuarioToken = req.usuario;
    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    // Los datos ya llegan validados por registrarVisitaSchema.
    const { visitanteNombre, visitanteDni, trabajadorVisitadoId } =
      req.body as z.infer<typeof registrarVisitaSchema>;

    const trabajador = await prisma.usuario.findUnique({ where: { id: trabajadorVisitadoId } });
    if (!trabajador) {
      res.status(404).json({ mensaje: 'El trabajador a visitar no existe' });
      return;
    }

    const estaPresente = await verificarPresencia(trabajadorVisitadoId);
    if (!estaPresente) {
      res.status(409).json({ mensaje: 'El trabajador no se encuentra en la sede' });
      return;
    }

    const nuevaVisita = await prisma.visita.create({
      data: {
        visitanteNombre,
        visitanteDni,
        trabajadorVisitadoId,
        registradorId: usuarioToken.id,
        horaEntrada: new Date(),
      },
    });

    notificar(
      trabajadorVisitadoId,
      `Tiene una visita esperándolo: ${visitanteNombre} (DNI ${visitanteDni}).`,
    );

    res.status(201).json({ visita: nuevaVisita });
  } catch (error) {
    console.error('Error en registrarVisita:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * PUT /api/visitas/:id/salida
 * Solo el vigilante que registró la visita o un Admin.
 */
export async function registrarSalida(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof visitaIdParamsSchema>;

    const usuarioToken = req.usuario;
    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const visita = await prisma.visita.findUnique({ where: { id } });
    if (!visita) {
      res.status(404).json({ mensaje: 'Visita no encontrada' });
      return;
    }

    const esAdmin = usuarioToken.rol === Rol.ADMIN;
    if (!esAdmin && visita.registradorId !== usuarioToken.id) {
      res.status(403).json({
        mensaje: 'Solo el vigilante que registró la visita o un administrador pueden registrar la salida',
      });
      return;
    }

    if (visita.horaSalida) {
      res.status(400).json({ mensaje: 'Esta visita ya tiene registrada su hora de salida' });
      return;
    }

    const visitaActualizada = await prisma.visita.update({
      where: { id },
      data: { horaSalida: new Date() },
    });

    res.status(200).json({ visita: visitaActualizada });
  } catch (error) {
    console.error('Error en registrarSalida:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * GET /api/visitas
 * Visibilidad:
 * - ESPECIALISTA: solo las visitas que recibió.
 * - JEFE: las de su equipo (o solo las propias con alcance='propios').
 * - DIRECTORA: todas (o solo las propias con alcance='propios').
 * - VIGILANTE, RRHH, ADMIN: todas, con filtros opcionales.
 */
export async function listarVisitas(req: Request, res: Response): Promise<void> {
  try {
    const usuarioToken = req.usuario;
    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const { fechaInicio, fechaFin, trabajadorVisitadoId, registradorId, alcance } =
      req.query as unknown as z.infer<typeof listarVisitasQuerySchema>;

    const where: Prisma.VisitaWhereInput = {};

    const idsPermitidos = await resolverIdsVisitados(usuarioToken, alcance);

    if (idsPermitidos !== null) {
      // El filtro explícito solo se respeta si cae dentro del alcance.
      if (
        trabajadorVisitadoId !== undefined &&
        idsPermitidos.includes(trabajadorVisitadoId)
      ) {
        where.trabajadorVisitadoId = trabajadorVisitadoId;
      } else {
        where.trabajadorVisitadoId = { in: idsPermitidos };
      }
    } else {
      if (trabajadorVisitadoId !== undefined) {
        where.trabajadorVisitadoId = trabajadorVisitadoId;
      }

      if (registradorId !== undefined) {
        where.registradorId = registradorId;
      }
    }

    // Filtro por fecha de entrada. El rango y el formato ya fueron validados
    // por listarVisitasQuerySchema.
    if (fechaInicio !== undefined || fechaFin !== undefined) {
      const filtroFecha: Prisma.DateTimeFilter = {};

      if (fechaInicio !== undefined) {
        // Inicio del día en hora local (ej: 11 de julio a las 00:00:00 en Perú)
        filtroFecha.gte = parseFechaLocal(fechaInicio);
      }

      if (fechaFin !== undefined) {
        // Fin del día en hora local (ej: 11 de julio a las 23:59:59.999 en Perú)
        filtroFecha.lte = parseFechaLocal(fechaFin, true);
      }

      where.horaEntrada = filtroFecha;
    }

    const visitas = await prisma.visita.findMany({
      where,
      include: {
        trabajadorVisitado: {
          select: { id: true, nombres: true, apellidos: true, jefatura: { select: { id: true, nombre: true } } },
        },
        registrador: { select: { id: true, nombres: true, apellidos: true } },
      },
      orderBy: { horaEntrada: 'desc' },
    });

    res.status(200).json({ visitas });
  } catch (error) {
    console.error('Error en listarVisitas:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * GET /api/visitas/:id
 * Misma regla de visibilidad que listarVisitas.
 */
export async function obtenerVisita(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof visitaIdParamsSchema>;

    const usuarioToken = req.usuario;
    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const visita = await prisma.visita.findUnique({
      where: { id },
      include: {
        trabajadorVisitado: {
          select: { id: true, nombres: true, apellidos: true, jefatura: { select: { id: true, nombre: true } } },
        },
        registrador: { select: { id: true, nombres: true, apellidos: true } },
      },
    });

    if (!visita) {
      res.status(404).json({ mensaje: 'Visita no encontrada' });
      return;
    }

    const idsPermitidos = await resolverIdsVisitados(usuarioToken, undefined);

    if (
      idsPermitidos !== null &&
      !idsPermitidos.includes(visita.trabajadorVisitadoId)
    ) {
      res.status(403).json({ mensaje: 'No tiene permisos para ver esta visita' });
      return;
    }

    res.status(200).json({ visita });
  } catch (error) {
    console.error('Error en obtenerVisita:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}