// ===========================================================
// Esquemas de validación del módulo de jefaturas
// ===========================================================

import { z } from 'zod';

const idSchema = z
  .coerce
  .number({ error: 'El ID debe ser numérico' })
  .int('El ID debe ser un número entero')
  .positive('El ID debe ser mayor que 0');

const nombreJefaturaSchema = z
  .string({ error: 'El nombre de la jefatura debe ser un texto' })
  .trim()
  .min(1, 'El nombre de la jefatura es obligatorio')
  .max(150, 'El nombre de la jefatura no puede superar los 150 caracteres');

const descripcionSchema = z
  .string({ error: 'La descripción debe ser un texto' })
  .trim()
  .max(500, 'La descripción no puede superar los 500 caracteres');

export const crearJefaturaSchema = z
  .object({
    nombre: nombreJefaturaSchema,

    descripcion: descripcionSchema
      .nullable()
      .optional(),
  })
  .strict();

export const editarJefaturaSchema = z
  .object({
    nombre: nombreJefaturaSchema.optional(),

    descripcion: descripcionSchema
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (datos) =>
      datos.nombre !== undefined ||
      datos.descripcion !== undefined,
    {
      message: 'Debe enviar nombre o descripcion para editar la jefatura',
    },
  );

export const jefaturaIdParamsSchema = z
  .object({
    id: idSchema,
  })
  .strict();