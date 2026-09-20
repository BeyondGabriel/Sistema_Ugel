// ===========================================================
// Esquemas de validación del módulo de notificaciones
// ===========================================================

import { z } from 'zod';

const idSchema = z
  .coerce
  .number({ error: 'El ID debe ser numérico' })
  .int('El ID debe ser un número entero')
  .positive('El ID debe ser mayor que 0');

export const notificacionIdParamsSchema = z
  .object({
    id: idSchema,
  })
  .strict();

export const listarNotificacionesQuerySchema = z
  .object({
    soloNoLeidas: z
      .enum(['true', 'false'], {
        error: 'soloNoLeidas debe ser true o false',
      })
      .optional(),
  })
  .strict();