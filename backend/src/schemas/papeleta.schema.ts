// ===========================================================
// Esquemas de validación del módulo de papeletas
// ===========================================================

import { z } from 'zod';
import { EstadoPapeleta, TipoTiempo } from '@prisma/client';

const idSchema = z
  .coerce
  .number({ error: 'El ID debe ser numérico' })
  .int('El ID debe ser un número entero')
  .positive('El ID debe ser mayor que 0');

const fechaSchema = z
  .string({ error: 'La fecha debe ser un texto' })
  .trim()
  .min(1, 'La fecha es obligatoria')
  .refine(
    (valor) =>
      /^\d{4}-\d{2}-\d{2}$/.test(valor) ||
      !Number.isNaN(new Date(valor).getTime()),
    'La fecha no es válida',
  );

const fechaHoraSchema = z
  .string({ error: 'La fecha y hora deben ser un texto' })
  .trim()
  .min(1, 'La fecha y hora son obligatorias')
  .refine(
    (valor) => !Number.isNaN(new Date(valor).getTime()),
    'La fecha u hora no es válida',
  );

const textoMotivoSchema = z
  .string({ error: 'El motivo debe ser un texto' })
  .trim()
  .min(1, 'El motivo es obligatorio')
  .max(500, 'El motivo no puede superar los 500 caracteres');

const textoMotivoOtrosSchema = z
  .string({ error: 'motivoOtros debe ser un texto' })
  .trim()
  .min(1, 'motivoOtros no puede estar vacío')
  .max(500, 'motivoOtros no puede superar los 500 caracteres');

const camposPapeletaBase = {
  tipoTiempo: z.enum(TipoTiempo, {
    error: 'tipoTiempo debe ser DIAS u HORAS',
  }),

  motivo: textoMotivoSchema,

  motivoOtros: textoMotivoOtrosSchema
    .nullable()
    .optional(),
};

/**
 * Esquema utilizado para crear y reenviar una papeleta.
 *
 * Las reglas que dependen de la combinación de campos, como qué
 * fechas/horas son obligatorias según tipoTiempo, permanecen
 * en validarCamposPapeleta() del controlador.
 */
export const papeletaSchema = z
  .object({
    ...camposPapeletaBase,

    fechaInicio: fechaSchema.optional(),

    fechaFin: fechaSchema.optional(),

    horaSalida: fechaHoraSchema.optional(),

    horaRetorno: fechaHoraSchema.optional(),
  })
  .strict();

export const rechazarPapeletaSchema = z
  .object({
    motivoRechazo: z
      .string({ error: 'motivoRechazo debe ser un texto' })
      .trim()
      .min(1, 'motivoRechazo es obligatorio')
      .max(500, 'motivoRechazo no puede superar los 500 caracteres'),
  })
  .strict();

export const observarPapeletaSchema = z
  .object({
    comentario: z
      .string({ error: 'comentario debe ser un texto' })
      .trim()
      .min(1, 'comentario es obligatorio')
      .max(500, 'comentario no puede superar los 500 caracteres'),
  })
  .strict();

export const anularPapeletaSchema = z
  .object({
    motivoAnulacion: z
      .string({ error: 'motivoAnulacion debe ser un texto' })
      .trim()
      .min(1, 'motivoAnulacion es obligatorio')
      .max(500, 'motivoAnulacion no puede superar los 500 caracteres'),
  })
  .strict();

export const verificarTokenSchema = z
  .object({
    token: z
      .string({ error: 'El token debe ser un texto' })
      .trim()
      .regex(
        /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/,
        'El token debe tener exactamente 6 caracteres válidos',
      ),
  })
  .strict();

export const papeletaIdParamsSchema = z
  .object({
    id: idSchema,
  })
  .strict();

export const listarPapeletasQuerySchema = z
  .object({
    estado: z
      .enum(EstadoPapeleta, {
        error: 'El estado especificado no es válido',
      })
      .optional(),

    solicitanteId: idSchema.optional(),

    fechaInicio: fechaSchema.optional(),

    fechaFin: fechaSchema.optional(),
  })
  .strict();