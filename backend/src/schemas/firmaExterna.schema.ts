// ===========================================================
// Esquemas de validación de firma externa
// ===========================================================

import { z } from 'zod';

const idSchema = z
  .coerce
  .number({ error: 'El ID debe ser numérico' })
  .int('El ID debe ser un número entero')
  .positive('El ID debe ser mayor que 0');

export const webhookFirmaSchema = z
  .object({
    papeletaId: idSchema,

    svgUrl: z
      .string({ error: 'svgUrl debe ser un texto' })
      .trim()
      .min(1, 'svgUrl es obligatorio')
      .url('svgUrl debe ser una URL válida')
      .max(2048, 'svgUrl no puede superar los 2048 caracteres'),
  })
  .strict();