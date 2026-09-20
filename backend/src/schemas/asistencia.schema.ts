// ===========================================================
// Esquemas de validación del módulo de asistencias
// ===========================================================

import { z } from 'zod';
import { TipoMovimiento } from '@prisma/client';

const idSchema = z
  .coerce
  .number({ error: 'El ID debe ser numérico' })
  .int('El ID debe ser un número entero')
  .positive('El ID debe ser mayor que 0');

const tipoMovimientoSchema = z.enum(TipoMovimiento, {
  error: 'El tipo de movimiento debe ser ENTRADA o SALIDA',
});

/**
 * Timestamp utilizado por el frontend.
 * Se acepta una fecha/hora interpretable por JavaScript,
 * manteniendo el formato que actualmente utiliza SIGPER.
 */
const timestampSchema = z
  .string({ error: 'El timestamp debe ser un texto' })
  .trim()
  .min(1, 'El timestamp es obligatorio')
  .refine(
    (valor) => !Number.isNaN(new Date(valor).getTime()),
    'El timestamp no es una fecha válida',
  );

/**
 * Fechas de filtros.
 * Los filtros de asistencia utilizan el formato YYYY-MM-DD.
 */
const fechaFiltroSchema = z
  .string({ error: 'La fecha debe ser un texto' })
  .trim()
  .refine(
    (valor) => /^\d{4}-\d{2}-\d{2}$/.test(valor),
    'La fecha debe tener el formato YYYY-MM-DD',
  )
  .refine(
    (valor) => {
      const [anio, mes, dia] = valor.split('-').map(Number);
      const fecha = new Date(anio, mes - 1, dia);

      return (
        fecha.getFullYear() === anio &&
        fecha.getMonth() === mes - 1 &&
        fecha.getDate() === dia
      );
    },
    'La fecha no es válida',
  );

/**
 * POST /api/asistencias
 */
export const registrarMovimientoSchema = z
  .object({
    usuarioId: idSchema,

    tipo: tipoMovimientoSchema,

    timestamp: timestampSchema,
  })
  .strict();

/**
 * PUT /api/asistencias/:id
 *
 * Debe enviarse al menos uno de los dos campos.
 */
export const editarMovimientoSchema = z
  .object({
    nuevoTimestamp: timestampSchema.optional(),

    nuevoTipo: tipoMovimientoSchema.optional(),
  })
  .strict()
  .refine(
    (datos) =>
      datos.nuevoTimestamp !== undefined ||
      datos.nuevoTipo !== undefined,
    {
      message: 'Debe enviar nuevoTimestamp o nuevoTipo para editar el movimiento',
    },
  );

/**
 * Parámetro :id de las rutas de asistencia.
 */
export const asistenciaIdParamsSchema = z
  .object({
    id: idSchema,
  })
  .strict();

/**
 * GET /api/asistencias
 */
export const listarMovimientosQuerySchema = z
  .object({
    usuarioId: idSchema.optional(),

    fechaInicio: fechaFiltroSchema.optional(),

    fechaFin: fechaFiltroSchema.optional(),

    jefaturaId: idSchema.optional(),
  })
  .strict();

/**
 * GET /api/asistencias/presencia
 */
export const obtenerPresenciaQuerySchema = z
  .object({
    jefaturaId: idSchema.optional(),
  })
  .strict();