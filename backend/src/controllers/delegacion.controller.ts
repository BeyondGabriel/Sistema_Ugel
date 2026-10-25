// ===========================================================
// Controlador de delegaciones de aprobación (Bloque A)
//
// Solo el ADMIN gestiona las delegaciones. Mientras una delegación está
// vigente, las papeletas que le corresponderían al titular se asignan al
// encargado (ver services/papeleta.service.ts → resolverAprobadorFinal).
// ===========================================================

import { Request, Response } from 'express';
import { z } from 'zod';
import { Rol } from '@prisma/client';
import prisma from '../utils/prisma';
import { notificar } from '../services/notificacion.service';
import {
  existeSolapeDelegacion,
  validarEncargadoElegible,
} from '../services/delegacion.service';
import {
  crearDelegacionSchema,
  anularDelegacionSchema,
  delegacionIdParamsSchema,
  listarDelegacionesQuerySchema,
} from '../schemas/delegacion.schema';

/** Roles que pueden actuar como titular de una delegación. */
const ROLES_TITULAR: Rol[] = [Rol.JEFE, Rol.DIRECTORA];

/** Longitud máxima del campo Delegacion.motivo (VARCHAR(1000)). */
const MOTIVO_MAX_LENGTH = 1000;

function truncarMotivoDelegacion(
  motivo: string | null | undefined,
): string | null {
  if (!motivo) return null;
  if (motivo.length <= MOTIVO_MAX_LENGTH) return motivo;
  return motivo.slice(0, MOTIVO_MAX_LENGTH - 1) + '…';
}

/** Datos mínimos de usuario incluidos en las respuestas de delegaciones. */
const seleccionUsuario = {
  id: true,
  nombres: true,
  apellidos: true,
  rol: true,
  tituloFormal: true,
  noDisponible: true,
} as const;

/** true si la delegación está activa y la fecha actual cae en su rango. */
function esVigente(delegacion: {
  activo: boolean;
  fechaInicio: Date;
  fechaFin: Date;
}): boolean {
  const ahora = Date.now();
  return (
    delegacion.activo &&
    delegacion.fechaInicio.getTime() <= ahora &&
    delegacion.fechaFin.getTime() >= ahora
  );
}

/** Includes estándar de las respuestas de delegación. */
const incluirRelaciones = {
  titular: { select: seleccionUsuario },
  encargado: { select: seleccionUsuario },
  creadoPor: { select: { id: true, nombres: true, apellidos: true } },
} as const;

/**
 * GET /api/delegaciones
 * Solo Admin. Lista delegaciones con datos de titular, encargado y creador.
 * `soloVigentes=true` limita a las activas y dentro de su rango de fechas.
 */
export async function listarDelegaciones(req: Request, res: Response): Promise<void> {
  try {
    const { titularId, encargadoId, soloVigentes } =
      req.query as unknown as z.infer<typeof listarDelegacionesQuerySchema>;

    const ahora = new Date();

    const delegaciones = await prisma.delegacion.findMany({
      where: {
        ...(titularId !== undefined ? { titularId } : {}),
        ...(encargadoId !== undefined ? { encargadoId } : {}),
        ...(soloVigentes === 'true'
          ? {
              activo: true,
              fechaInicio: { lte: ahora },
              fechaFin: { gte: ahora },
            }
          : {}),
      },
      include: incluirRelaciones,
      orderBy: [{ activo: 'desc' }, { fechaInicio: 'desc' }],
    });

    res.status(200).json({
      delegaciones: delegaciones.map((delegacion) => ({
        ...delegacion,
        vigente: esVigente(delegacion),
      })),
    });
  } catch (error) {
    console.error('Error en listarDelegaciones:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}


/**
 * POST /api/delegaciones
 * Solo Admin. Crea una delegación validando:
 * - el titular es JEFE o DIRECTORA y está activo;
 * - el encargado está activo, disponible y es elegible según la jerarquía
 *   (JEFE → ESPECIALISTA de su área; DIRECTORA → JEFE);
 * - no existen solapes con otra delegación activa del mismo titular.
 */
export async function crearDelegacion(req: Request, res: Response): Promise<void> {
  try {
    const { titularId, encargadoId, fechaInicio, fechaFin, motivo, documentoRef } =
      req.body as z.infer<typeof crearDelegacionSchema>;

    const titular = await prisma.usuario.findUnique({ where: { id: titularId } });

    if (!titular || !titular.activo) {
      res.status(404).json({ mensaje: 'El titular indicado no existe o está inactivo' });
      return;
    }

    if (!ROLES_TITULAR.includes(titular.rol)) {
      res.status(400).json({
        mensaje: 'Solo un jefe de área o la Directora pueden delegar la aprobación',
      });
      return;
    }

    const encargado = await prisma.usuario.findUnique({ where: { id: encargadoId } });

    if (!encargado || !encargado.activo) {
      res.status(404).json({ mensaje: 'El encargado indicado no existe o está inactivo' });
      return;
    }

    const errorElegibilidad = validarEncargadoElegible(titular, encargado);

    if (errorElegibilidad) {
      res.status(400).json({ mensaje: errorElegibilidad });
      return;
    }

    if (encargado.noDisponible) {
      res.status(409).json({
        mensaje: 'El encargado indicado está marcado como no disponible (P1C)',
      });
      return;
    }

    if (await existeSolapeDelegacion(titularId, fechaInicio, fechaFin)) {
      res.status(409).json({
        mensaje: 'Ya existe una delegación vigente que se solapa con el rango solicitado',
      });
      return;
    }

    const delegacion = await prisma.delegacion.create({
      data: {
        titularId,
        encargadoId,
        fechaInicio,
        fechaFin,
        motivo,
        documentoRef,
        activo: true,
        creadoPorId: req.usuario?.id ?? null,
      },
      include: incluirRelaciones,
    });

    notificar(
      encargadoId,
      `Se le delegó la aprobación de papeletas de ${titular.nombres} ${titular.apellidos} del ${fechaInicio.toLocaleDateString('es-PE')} al ${fechaFin.toLocaleDateString('es-PE')}.`
    );

    notificar(
      titularId,
      `Su facultad de aprobación fue delegada a ${encargado.nombres} ${encargado.apellidos} del ${fechaInicio.toLocaleDateString('es-PE')} al ${fechaFin.toLocaleDateString('es-PE')}.`
    );

    res.status(201).json({ delegacion: { ...delegacion, vigente: esVigente(delegacion) } });
  } catch (error) {
    console.error('Error en crearDelegacion:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * PUT /api/delegaciones/:id/anular
 * Solo Admin. Desactiva una delegación (no se elimina el registro, para
 * conservar la trazabilidad de quién aprobó cada papeleta).
 */
export async function anularDelegacion(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as unknown as z.infer<typeof delegacionIdParamsSchema>;
    const { motivo } = req.body as z.infer<typeof anularDelegacionSchema>;

    const delegacion = await prisma.delegacion.findUnique({ where: { id } });

    if (!delegacion) {
      res.status(404).json({ mensaje: 'Delegación no encontrada' });
      return;
    }

    if (!delegacion.activo) {
      res.status(409).json({ mensaje: 'La delegación ya está anulada' });
      return;
    }

    const motivoFinal = truncarMotivoDelegacion(
      motivo && motivo.length > 0
        ? `${delegacion.motivo ? `${delegacion.motivo} | ` : ''}Anulada: ${motivo}`
        : delegacion.motivo,
    );

    const delegacionAnulada = await prisma.delegacion.update({
      where: { id },
      data: { activo: false, motivo: motivoFinal },
      include: incluirRelaciones,
    });

    notificar(
      delegacion.encargadoId,
      `La delegación de aprobación de ${delegacionAnulada.titular.nombres} ${delegacionAnulada.titular.apellidos} fue anulada por el Administrador.`
    );

    notificar(
      delegacion.titularId,
      `Su delegación de aprobación a ${delegacionAnulada.encargado.nombres} ${delegacionAnulada.encargado.apellidos} fue anulada por el Administrador.`
    );

    res.status(200).json({
      delegacion: { ...delegacionAnulada, vigente: esVigente(delegacionAnulada) },
    });
  } catch (error) {
    console.error('Error en anularDelegacion:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

