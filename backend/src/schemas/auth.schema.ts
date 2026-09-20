// ===========================================================
// Esquemas de validación del módulo de autenticación
// ===========================================================

import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z
      .string({ error: 'El email debe ser un texto' })
      .trim()
      .min(1, 'El email es obligatorio')
      .email('El email no tiene un formato válido'),

    password: z
      .string({ error: 'La contraseña debe ser un texto' })
      .min(1, 'La contraseña es obligatoria'),
  })
  .strict();

export const cambiarPasswordSchema = z
  .object({
    passwordActual: z
      .string({ error: 'La contraseña actual debe ser un texto' })
      .min(1, 'La contraseña actual es obligatoria'),

    nuevaPassword: z
      .string({ error: 'La nueva contraseña debe ser un texto' })
      .min(1, 'La nueva contraseña es obligatoria'),
  })
  .strict();