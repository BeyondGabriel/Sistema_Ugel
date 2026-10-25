// ===========================================================
// Esquemas de validación del módulo de delegaciones (Bloque A)
// ===========================================================

import { z } from 'zod';

const idSchema = z
  .coerce
  .number({ error: 'El ID debe ser numérico' })
  .int('El ID debe ser un número entero')
  .positive('El ID debe ser mayor que 0');

/**
 * Fecha/hora en formato ISO 8601 (o cualquier cadena interpretable por
 * JavaScript). Se normaliza a Date en el transform del esquema.
 */
const fechaHoraSchema = z
  .string({ error: 'La fecha debe ser un texto' })
  .trim()
  .min(1, 'La fecha es obligatoria')
  .refine(
    (valor) => !Number.isNaN(new Date(valor).getTime()),
    'La fecha u hora no es válida',
  );

const motivoSchema = z
  .string({ error: 'El motivo debe ser un texto' })
  .trim()
  .max(500, 'El motivo no puede superar los 500 caracteres');

const documentoRefSchema = z
  .string({ error: 'La referencia del documento debe ser un texto' })
  .trim()
  .max(500, 'La referencia del documento no puede superar los 500 caracteres');

/**
 * POST /api/delegaciones
 *
 * Una delegación traslada la facultad de aprobar del titular al encargado
 * durante el rango [fechaInicio, fechaFin]. El solape de rangos se valida en
 * el controlador (requiere consultar la base de datos).
 */
export const crearDelegacionSchema = z
  .object({
    titularId: idSchema,

    encargadoId: idSchema,

    fechaInicio: fechaHoraSchema,

    fechaFin: fechaHoraSchema,

    motivo: motivoSchema.nullable().optional(),

    documentoRef: documentoRefSchema.nullable().optional(),
  })
  .strict()
  .superRefine((datos, ctx) => {
    if (datos.titularId === datos.encargadoId) {
      ctx.addIssue({
        code: 'custom',
        path: ['encargadoId'],
        message: 'El encargado no puede ser la misma persona que el titular',
      });
    }

    const inicio = new Date(datos.fechaInicio);
    const fin = new Date(datos.fechaFin);
    const ahora = new Date();

    if (fin <= inicio) {
      ctx.addIssue({
        code: 'custom',
        path: ['fechaFin'],
        message: 'fechaFin debe ser posterior a fechaInicio',
      });
    }

    if (fin <= ahora) {
      ctx.addIssue({
        code: 'custom',
        path: ['fechaFin'],
        message: 'fechaFin debe ser una fecha futura',
      });
    }

    const unDiaAtras = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
    if (inicio < unDiaAtras) {
      ctx.addIssue({
        code: 'custom',
        path: ['fechaInicio'],
        message: 'fechaInicio no puede ser anterior a ayer',
      });
    }
  })
  .transform((datos) => ({
    titularId: datos.titularId,
    encargadoId: datos.encargadoId,
    fechaInicio: new Date(datos.fechaInicio),
    fechaFin: new Date(datos.fechaFin),
    motivo: datos.motivo && datos.motivo.length > 0 ? datos.motivo : null,
    documentoRef:
      datos.documentoRef && datos.documentoRef.length > 0 ? datos.documentoRef : null,
  }));

/**
 * PUT /api/delegaciones/:id/anular
 */
export const anularDelegacionSchema = z
  .object({
    motivo: motivoSchema.optional(),
  })
  .strict();

export const delegacionIdParamsSchema = z
  .object({
    id: idSchema,
  })
  .strict();

/**
 * GET /api/delegaciones
 */
export const listarDelegacionesQuerySchema = z
  .object({
    titularId: idSchema.optional(),

    encargadoId: idSchema.optional(),

    soloVigentes: z
      .enum(['true', 'false'], {
        error: 'soloVigentes debe ser true o false',
      })
      .optional(),
  })
  .strict();
