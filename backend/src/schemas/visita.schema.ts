// ===========================================================
// Esquemas de validación del módulo de visitas
// ===========================================================

import { z } from 'zod';

const idSchema = z
  .coerce
  .number({ error: 'El ID debe ser numérico' })
  .int('El ID debe ser un número entero')
  .positive('El ID debe ser mayor que 0');

const textoNombreSchema = z
  .string({ error: 'El nombre del visitante debe ser un texto' })
  .trim()
  .min(1, 'El nombre del visitante es obligatorio')
  .max(150, 'El nombre del visitante no puede superar los 150 caracteres');

const dniSchema = z
  .string({ error: 'El DNI debe ser un texto' })
  .trim()
  .min(1, 'El DNI es obligatorio')
  .regex(/^\d{8}$/, 'El DNI debe contener exactamente 8 dígitos');

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

export const registrarVisitaSchema = z
  .object({
    visitanteNombre: textoNombreSchema,

    visitanteDni: dniSchema,

    trabajadorVisitadoId: idSchema,

    gafeteEntregado: z
      .boolean({
        error: 'gafeteEntregado debe ser verdadero o falso',
      })
      .optional(),
  })
  .strict();

export const visitaIdParamsSchema = z
  .object({
    id: idSchema,
  })
  .strict();

export const listarVisitasQuerySchema = z
  .object({
    fechaInicio: fechaFiltroSchema.optional(),

    fechaFin: fechaFiltroSchema.optional(),

    trabajadorVisitadoId: idSchema.optional(),

    registradorId: idSchema.optional(),
  })
  .strict();