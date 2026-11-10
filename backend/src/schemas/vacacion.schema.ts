// ===========================================================
// Esquemas de validación del módulo de vacaciones
// ===========================================================
//
// Estos esquemas solo validan la ESTRUCTURA del payload. Las reglas de
// negocio que requieren consultar la base de datos (saldo disponible,
// límite de 7 días hábiles del rol vacacional, solape con otras
// solicitudes, etc.) se resuelven en el controlador.
//
// Se usa `z.enum(EnumDePrisma)` (forma recomendada en Zod 4) en lugar del
// obsoleto `z.nativeEnum`, siguiendo el patrón del resto de esquemas.

import { z } from 'zod';
import { EstadoSolicitudVacacion, TipoVacacion } from '@prisma/client';

const idSchema = z
  .coerce
  .number({ error: 'El ID debe ser numérico' })
  .int('El ID debe ser un número entero')
  .positive('El ID debe ser mayor que 0');

/** Fecha en formato ISO 8601 con offset (ej. 2026-03-16T00:00:00-05:00). */
const fechaIsoSchema = z
  .string({ error: 'La fecha debe ser un texto' })
  .datetime({ offset: true, error: 'Fecha inválida' });

/** Hora del día en formato HH:mm (00:00 a 23:59). */
const horaSchema = z
  .string({ error: 'La hora debe ser un texto' })
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:mm');

/**
 * POST /api/vacaciones
 *
 * Registra una solicitud de vacaciones del usuario autenticado.
 * - DIA_COMPLETO: no admite horas; el rango [fechaInicio, fechaFin] son días.
 * - MEDIO_DIA: exige horaInicio/horaFin, el bloque debe durar exactamente
 *   4 horas y la solicitud debe caer en una sola fecha.
 */
export const crearSolicitudVacacionSchema = z
  .object({
    fechaInicio: fechaIsoSchema,

    fechaFin: fechaIsoSchema,

    tipo: z.enum(TipoVacacion, {
      error: 'tipo debe ser DIA_COMPLETO o MEDIO_DIA',
    }),

    horaInicio: horaSchema.nullable().optional(),

    horaFin: horaSchema.nullable().optional(),
  })
  .strict()
  .superRefine((datos, ctx) => {
    const inicio = new Date(datos.fechaInicio);
    const fin = new Date(datos.fechaFin);

    if (fin < inicio) {
      ctx.addIssue({
        code: 'custom',
        path: ['fechaFin'],
        message: 'La fecha fin no puede ser anterior a la de inicio',
      });
    }

    if (datos.tipo === TipoVacacion.DIA_COMPLETO) {
      if (datos.horaInicio || datos.horaFin) {
        ctx.addIssue({
          code: 'custom',
          path: ['horaInicio'],
          message: 'Las horas no aplican para días completos',
        });
      }
    }

    if (datos.tipo === TipoVacacion.MEDIO_DIA) {
      if (!datos.horaInicio || !datos.horaFin) {
        ctx.addIssue({
          code: 'custom',
          path: ['horaInicio'],
          message: 'Debe indicar hora de inicio y fin para medio día',
        });
      } else {
        // El bloque de medio día debe ser EXACTAMENTE de 4 horas.
        const [hInicio, mInicio] = datos.horaInicio.split(':').map(Number);
        const [hFin, mFin] = datos.horaFin.split(':').map(Number);

        const minutosInicio = hInicio * 60 + mInicio;
        const minutosFin = hFin * 60 + mFin;
        const diferenciaMinutos = minutosFin - minutosInicio;

        if (diferenciaMinutos !== 240) {
          ctx.addIssue({
            code: 'custom',
            path: ['horaFin'],
            message: 'El bloque de medio día debe ser exactamente de 4 horas',
          });
        }
      }

      // Para medio día, fechaInicio y fechaFin deben ser el mismo día.
      if (inicio.toDateString() !== fin.toDateString()) {
        ctx.addIssue({
          code: 'custom',
          path: ['fechaFin'],
          message: 'Las vacaciones de medio día deben ser en una sola fecha',
        });
      }
    }
  });

/**
 * PUT /api/vacaciones/:id/rechazar
 */
export const rechazarSolicitudVacacionSchema = z
  .object({
    motivoRechazo: z
      .string({ error: 'motivoRechazo debe ser un texto' })
      .trim()
      .min(1, 'El motivo es obligatorio')
      .max(255, 'El motivo no puede superar los 255 caracteres'),
  })
  .strict();

/**
 * POST /api/vacaciones/saldos
 * Registro del saldo anual de vacaciones de un usuario.
 */
export const crearSaldoVacacionSchema = z
  .object({
    usuarioId: idSchema,

    anio: z
      .number({ error: 'El año debe ser numérico' })
      .int('El año debe ser un número entero')
      .min(2020, 'El año debe ser mayor o igual a 2020')
      .max(2100, 'El año debe ser menor o igual a 2100'),

    diasGanados: z
      .number({ error: 'Los días ganados deben ser numéricos' })
      .min(0, 'Los días ganados no pueden ser negativos')
      .max(365, 'Los días ganados no pueden superar 365'),
  })
  .strict();

export const solicitudVacacionIdParamsSchema = z
  .object({
    id: idSchema,
  })
  .strict();

/**
 * GET /api/vacaciones
 */
export const listarSolicitudesQuerySchema = z
  .object({
    estado: z
      .enum(EstadoSolicitudVacacion, {
        error: 'El estado especificado no es válido',
      })
      .optional(),

    usuarioId: idSchema.optional(),
  })
  .strict();
