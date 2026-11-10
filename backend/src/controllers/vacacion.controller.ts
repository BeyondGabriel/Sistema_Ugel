// ===========================================================
// Controlador del módulo de vacaciones
//
// Flujo de una solicitud:
//   PENDIENTE --(VoBo del Jefe)--> CON_VB --(aprobación de RRHH)--> APROBADA
//   Antes de la aprobación final puede pasar a RECHAZADA (Jefe o RRHH).
//
// Las reglas de negocio (saldo, fraccionamiento y bloque principal) viven
// en services/vacacion.service.ts; aquí solo se orquesta la persistencia,
// el descuento de saldo y las notificaciones al solicitante/aprobador.
// ===========================================================

import { Request, Response } from 'express';
import { z } from 'zod';
import { EstadoSolicitudVacacion, TipoVacacion } from '@prisma/client';
import prisma from '../utils/prisma';
import {
  validarReglasNegocio,
  VacacionError,
  obtenerSaldo,
} from '../services/vacacion.service';
import {
  crearSolicitudVacacionSchema,
  rechazarSolicitudVacacionSchema,
  crearSaldoVacacionSchema,
  solicitudVacacionIdParamsSchema,
} from '../schemas/vacacion.schema';
import { notificar } from '../services/notificacion.service';

/** Saldo que descuenta una solicitud de medio día (bloque de 4 horas). */
const DIAS_MEDIO_DIA = 0.5;

/** Saldo que descuenta un día completo de vacaciones. */
const DIAS_DIA_COMPLETO = 1.0;

/**
 * GET /api/vacaciones/mi-saldo?anio=2026
 * Saldo anual de vacaciones del usuario autenticado.
 */
export async function obtenerMiSaldo(req: Request, res: Response): Promise<void> {
  try {
    const anio = req.query.anio ? Number(req.query.anio) : new Date().getFullYear();
    const saldo = await obtenerSaldo(req.usuario!.id, anio);

    res.status(200).json({ saldo });
  } catch (error) {
    if (error instanceof VacacionError) {
      res.status(error.statusCode).json({ mensaje: error.mensaje });
      return;
    }

    console.error('Error al obtener el saldo de vacaciones:', error);
    res.status(500).json({ mensaje: 'Error interno' });
  }
}

/**
 * POST /api/vacaciones
 * Crea la solicitud de vacaciones del usuario autenticado (queda PENDIENTE
 * del VoBo de su jefe inmediato).
 */
export async function crearSolicitud(req: Request, res: Response): Promise<void> {
  try {
    const datos = req.body as z.infer<typeof crearSolicitudVacacionSchema>;
    const usuarioId = req.usuario!.id;

    const fechaInicio = new Date(datos.fechaInicio);
    const fechaFin = new Date(datos.fechaFin);
    const anio = fechaInicio.getFullYear();

    // Días de saldo que consume la solicitud según su tipo. El esquema Zod ya
    // garantiza que MEDIO_DIA cae en un solo día y dura exactamente 4 horas.
    let diasDescontados = DIAS_DIA_COMPLETO;
    if (datos.tipo === TipoVacacion.MEDIO_DIA) {
      diasDescontados = DIAS_MEDIO_DIA;
    } else {
      // DIA_COMPLETO: se descuentan los días calendario del rango solicitado.
      const diff = fechaFin.getTime() - fechaInicio.getTime();
      diasDescontados = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    }

    await validarReglasNegocio(
      usuarioId,
      anio,
      datos.tipo,
      fechaInicio,
      fechaFin,
      diasDescontados
    );

    // El VoBo lo da el jefe inmediato del solicitante (si tiene asignado).
    const solicitante = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    const aprobadorId = solicitante?.jefeId ?? null;

    const solicitud = await prisma.solicitudVacacion.create({
      data: {
        solicitanteId: usuarioId,
        aprobadorId,
        tipo: datos.tipo,
        fechaInicio,
        fechaFin,
        horaInicio: datos.horaInicio ?? null,
        horaFin: datos.horaFin ?? null,
        diasDescontados,
        estado: EstadoSolicitudVacacion.PENDIENTE,
      },
    });

    if (aprobadorId) {
      notificar(
        aprobadorId,
        `Nueva solicitud de vacaciones de ${solicitante?.nombres} ${solicitante?.apellidos}`
      );
    }

    res.status(201).json({ solicitud });
  } catch (error) {
    if (error instanceof VacacionError) {
      res.status(error.statusCode).json({ mensaje: error.mensaje });
      return;
    }

    console.error('Error al crear la solicitud de vacaciones:', error);
    res.status(500).json({ mensaje: 'Error interno' });
  }
}

/**
 * PUT /api/vacaciones/:id/vb
 * VoBo del Jefe (o Directora): PENDIENTE -> CON_VB.
 */
export async function darVistoBueno(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof solicitudVacacionIdParamsSchema>;

    const solicitud = await prisma.solicitudVacacion.findUnique({ where: { id } });

    if (!solicitud) {
      res.status(404).json({ mensaje: 'Solicitud no encontrada' });
      return;
    }

    if (solicitud.estado !== EstadoSolicitudVacacion.PENDIENTE) {
      res.status(409).json({ mensaje: 'La solicitud no está pendiente' });
      return;
    }

    const actualizada = await prisma.solicitudVacacion.update({
      where: { id },
      data: { estado: EstadoSolicitudVacacion.CON_VB },
    });

    notificar(
      solicitud.solicitanteId,
      'Tu solicitud de vacaciones fue aprobada por tu Jefe y está en revisión por RRHH.'
    );

    res.status(200).json({ solicitud: actualizada });
  } catch (error) {
    console.error('Error al dar VoBo a la solicitud de vacaciones:', error);
    res.status(500).json({ mensaje: 'Error interno' });
  }
}

/**
 * PUT /api/vacaciones/:id/aprobar
 * Aprobación final de RRHH: CON_VB -> APROBADA y descuento del saldo.
 * Ambas escrituras se ejecutan en una única transacción.
 */
export async function aprobarSolicitud(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof solicitudVacacionIdParamsSchema>;
    const rrhhId = req.usuario!.id;

    const solicitud = await prisma.solicitudVacacion.findUnique({ where: { id } });

    if (!solicitud) {
      res.status(404).json({ mensaje: 'Solicitud no encontrada' });
      return;
    }

    if (solicitud.estado !== EstadoSolicitudVacacion.CON_VB) {
      res.status(409).json({ mensaje: 'La solicitud requiere VoBo del Jefe primero' });
      return;
    }

    // Transacción para aprobar y descontar saldo de forma atómica.
    const actualizada = await prisma.$transaction(async (tx) => {
      const sol = await tx.solicitudVacacion.update({
        where: { id },
        data: { estado: EstadoSolicitudVacacion.APROBADA, rrhhId },
      });

      const anio = sol.fechaInicio.getFullYear();
      const saldo = await tx.vacacionSaldo.findUnique({
        where: { usuarioId_anio: { usuarioId: sol.solicitanteId, anio } },
      });

      if (saldo) {
        await tx.vacacionSaldo.update({
          where: { id: saldo.id },
          data: { diasUsados: { increment: sol.diasDescontados } },
        });
      }

      return sol;
    });

    notificar(
      solicitud.solicitanteId,
      '¡Tus vacaciones han sido APROBADAS oficialmente por RRHH!'
    );

    res.status(200).json({ solicitud: actualizada });
  } catch (error) {
    console.error('Error al aprobar la solicitud de vacaciones:', error);
    res.status(500).json({ mensaje: 'Error interno' });
  }
}

/**
 * PUT /api/vacaciones/:id/rechazar
 * Rechazo con motivo obligatorio (Jefe, Directora, RRHH o Admin).
 */
export async function rechazarSolicitud(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof solicitudVacacionIdParamsSchema>;
    const { motivoRechazo } = req.body as z.infer<typeof rechazarSolicitudVacacionSchema>;

    const solicitud = await prisma.solicitudVacacion.findUnique({ where: { id } });

    if (!solicitud) {
      res.status(404).json({ mensaje: 'Solicitud no encontrada' });
      return;
    }

    const actualizada = await prisma.solicitudVacacion.update({
      where: { id },
      data: {
        estado: EstadoSolicitudVacacion.RECHAZADA,
        motivoRechazo,
      },
    });

    notificar(
      solicitud.solicitanteId,
      `Tu solicitud de vacaciones fue RECHAZADA. Motivo: ${motivoRechazo}`
    );

    res.status(200).json({ solicitud: actualizada });
  } catch (error) {
    console.error('Error al rechazar la solicitud de vacaciones:', error);
    res.status(500).json({ mensaje: 'Error interno' });
  }
}

/**
 * POST /api/vacaciones/saldos
 * Carga/actualización manual del saldo anual de un trabajador (Admin/RRHH).
 */
export async function crearSaldoManual(req: Request, res: Response): Promise<void> {
  try {
    const { usuarioId, anio, diasGanados } = req.body as z.infer<
      typeof crearSaldoVacacionSchema
    >;

    const saldo = await prisma.vacacionSaldo.upsert({
      where: { usuarioId_anio: { usuarioId, anio } },
      update: { diasGanados },
      create: { usuarioId, anio, diasGanados },
    });

    res.status(200).json({ saldo });
  } catch (error) {
    console.error('Error al registrar el saldo de vacaciones:', error);
    res.status(500).json({ mensaje: 'Error interno' });
  }
}
