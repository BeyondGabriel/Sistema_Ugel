// ===========================================================
// Esquemas de validación del módulo de usuarios
// ===========================================================

import { z } from 'zod';
import { Rol } from '@prisma/client';

const idSchema = z
  .coerce
  .number({ error: 'El ID debe ser numérico' })
  .int('El ID debe ser un número entero')
  .positive('El ID debe ser mayor que 0');

const rolSchema = z.enum(Rol, {
  error: 'El rol especificado no es válido',
});

const emailSchema = z
  .string({ error: 'El email debe ser un texto' })
  .trim()
  .min(1, 'El email es obligatorio')
  .email('El email no tiene un formato válido');

const nombresSchema = z
  .string({ error: 'Los nombres deben ser un texto' })
  .trim()
  .min(1, 'Los nombres son obligatorios')
  .max(100, 'Los nombres no pueden superar los 100 caracteres');

const apellidosSchema = z
  .string({ error: 'Los apellidos deben ser un texto' })
  .trim()
  .min(1, 'Los apellidos son obligatorios')
  .max(100, 'Los apellidos no pueden superar los 100 caracteres');

const passwordSchema = z
  .string({ error: 'La contraseña debe ser un texto' })
  .min(8, 'La contraseña debe tener mínimo 8 caracteres');

export const crearUsuarioSchema = z
  .object({
    email: emailSchema,

    password: passwordSchema.optional(),

    rol: rolSchema,

    nombres: nombresSchema,

    apellidos: apellidosSchema,

    jefaturaId: idSchema.optional(),

    jefeId: idSchema.optional(),
  })
  .strict();

export const editarUsuarioSchema = z
  .object({
    email: emailSchema.optional(),

    rol: rolSchema.optional(),

    nombres: nombresSchema.optional(),

    apellidos: apellidosSchema.optional(),

    jefaturaId: idSchema.nullable().optional(),

    jefeId: idSchema.nullable().optional(),

    activo: z.boolean({
      error: 'El campo activo debe ser verdadero o falso',
    }).optional(),
  })
  .strict();

export const asignarJefeSchema = z
  .object({
    usuarioId: idSchema,

    jefeId: idSchema,
  })
  .strict();

export const usuarioIdParamsSchema = z
  .object({
    id: idSchema,
  })
  .strict();

export const listarUsuariosQuerySchema = z
  .object({
    rol: rolSchema.optional(),

    jefaturaId: idSchema.optional(),

    activo: z
      .enum(['true', 'false'], {
        error: 'El campo activo debe ser true o false',
      })
      .optional(),
  })
  .strict();