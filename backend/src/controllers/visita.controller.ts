// ===========================================================
// Controlador del módulo de visitas
// ===========================================================

import { Request, Response } from 'express';
import { Rol, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { verificarPresencia } from '../services/visita.service';
import { notificar } from '../services/notificacion.service';

/** Roles que solo pueden ver las visitas que ellos mismos recibieron. */
const ROLES_SOLO_PROPIAS_RECIBIDAS: Rol[] = [Rol.ESPECIALISTA, Rol.JEFE, Rol.DIRECTORA];

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

    const { visitanteNombre, visitanteDni, trabajadorVisitadoId, gafeteEntregado } = req.body as {
      visitanteNombre?: string;
      visitanteDni?: string;
      trabajadorVisitadoId?: number;
      gafeteEntregado?: boolean;
    };

    if (!visitanteNombre || !visitanteDni || !trabajadorVisitadoId) {
      res.status(400).json({ mensaje: 'visitanteNombre, visitanteDni y trabajadorVisitadoId son obligatorios' });
      return;
    }

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
        gafeteEntregado: gafeteEntregado ?? false,
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
 * PUT /api/visitas/:id/gafete
 * Roles: VIGILANTE, ADMIN. Idempotente: si ya estaba en true, lo deja igual.
 */
export async function marcarGafete(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ mensaje: 'El id proporcionado no es válido' });
      return;
    }

    const visita = await prisma.visita.findUnique({ where: { id } });
    if (!visita) {
      res.status(404).json({ mensaje: 'Visita no encontrada' });
      return;
    }

    const visitaActualizada = await prisma.visita.update({
      where: { id },
      data: { gafeteEntregado: true },
    });

    res.status(200).json({ visita: visitaActualizada });
  } catch (error) {
    console.error('Error en marcarGafete:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * GET /api/visitas
 * Visibilidad:
 * - ESPECIALISTA, JEFE, DIRECTORA: solo las visitas que ellos recibieron.
 * - VIGILANTE, RRHH, ADMIN: todas, con filtros opcionales.
 */
export async function listarVisitas(req: Request, res: Response): Promise<void> {
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

    if (ROLES_SOLO_PROPIAS_RECIBIDAS.includes(usuarioToken.rol)) {
      where.trabajadorVisitadoId = usuarioToken.id;
    } else {
      if (trabajadorVisitadoId !== undefined) {
        const num = Number(trabajadorVisitadoId);
        if (Number.isNaN(num)) {
          res.status(400).json({ mensaje: 'trabajadorVisitadoId debe ser numérico' });
          return;
        }
        where.trabajadorVisitadoId = num;
      }

      if (registradorId !== undefined) {
        const num = Number(registradorId);
        if (Number.isNaN(num)) {
          res.status(400).json({ mensaje: 'registradorId debe ser numérico' });
          return;
        }
        where.registradorId = num;
      }
    }

    if (fechaInicio !== undefined || fechaFin !== undefined) {
      const filtroFecha: Prisma.DateTimeFilter = {};

      if (fechaInicio !== undefined) {
        const partes = fechaInicio.split('-');
        if (partes.length !== 3) {
          res.status(400).json({ mensaje: 'fechaInicio no es una fecha válida' });
          return;
        }
        const [y, m, d] = partes.map(Number);
        // Inicio del día en hora local (ej: 11 de julio a las 00:00:00 en Perú)
        filtroFecha.gte = new Date(y, m - 1, d);
      }

      if (fechaFin !== undefined) {
        const partes = fechaFin.split('-');
        if (partes.length !== 3) {
          res.status(400).json({ mensaje: 'fechaFin no es una fecha válida' });
          return;
        }
        const [y, m, d] = partes.map(Number);
        // Fin del día en hora local (ej: 11 de julio a las 23:59:59.999 en Perú)
        filtroFecha.lte = new Date(y, m - 1, d, 23, 59, 59, 999);
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

    if (ROLES_SOLO_PROPIAS_RECIBIDAS.includes(usuarioToken.rol) && visita.trabajadorVisitadoId !== usuarioToken.id) {
      res.status(403).json({ mensaje: 'No tiene permisos para ver esta visita' });
      return;
    }

    res.status(200).json({ visita });
  } catch (error) {
    console.error('Error en obtenerVisita:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}