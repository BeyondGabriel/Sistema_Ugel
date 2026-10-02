// ===========================================================
// Esquemas de validación del módulo de papeletas
// ===========================================================

import { z } from 'zod';
import { EstadoPapeleta, TipoTiempo } from '@prisma/client';
import {
  MOTIVOS_PAPELETA,
  MOTIVO_OTROS,
  type MotivoPapeleta,
} from '../utils/motivosPapeleta';
import { parseFechaLocal } from '../utils/fechas';

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
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(valor),
    'La fecha debe tener el formato YYYY-MM-DD o ISO 8601 UTC',
  )
  .refine(
    (valor) => {
      const fechaParte = valor.slice(0, 10);

      const [anio, mes, dia] = fechaParte.split('-').map(Number);

      const fecha = new Date(Date.UTC(anio, mes - 1, dia));

      return (
        fecha.getUTCFullYear() === anio &&
        fecha.getUTCMonth() === mes - 1 &&
        fecha.getUTCDate() === dia
      );
    },
    'La fecha no es válida',
  )
  .refine(
    (valor) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return true;
      }

      return !Number.isNaN(new Date(valor).getTime());
    },
    'La fecha u hora no es válida',
  );

const fechaHoraSchema = z
  .string({ error: 'La fecha y hora deben ser un texto' })
  .trim()
  .min(1, 'La fecha y hora son obligatorias')
  .refine(
    (valor) => !Number.isNaN(new Date(valor).getTime()),
    'La fecha u hora no es válida',
  );

const textoMotivoOtrosSchema = z
  .string({ error: 'motivoOtros debe ser un texto' })
  .trim()
  .min(1, 'motivoOtros no puede estar vacío')
  .max(500, 'motivoOtros no puede superar los 500 caracteres');

const camposPapeletaBase = {
  tipoTiempo: z.enum(TipoTiempo, {
    error: 'tipoTiempo debe ser DIAS u HORAS',
  }),

  motivo: z.enum(MOTIVOS_PAPELETA, {
    error: 'El motivo especificado no es válido',
  }),

  motivoOtros: textoMotivoOtrosSchema
    .nullable()
    .optional(),
};

/** Campos ya validados y normalizados de una papeleta (salida del esquema). */
interface PapeletaNormalizada {
  tipoTiempo: TipoTiempo;
  motivo: MotivoPapeleta;
  motivoOtros: string | null;
  fechaInicio: Date;
  fechaFin: Date;
  horaSalida: Date | null;
  horaRetorno: Date | null;
}

/**
 * Esquema utilizado para crear y reenviar una papeleta.
 *
 * Además de validar el formato de cada campo, centraliza mediante
 * superRefine() las reglas de negocio condicionales según tipoTiempo
 * (obligatoriedad y coherencia de fechas/horas) y normaliza la salida a
 * Date, de modo que el controlador trabaje directamente con datos tipados.
 */
export const papeletaSchema = z
  .object({
    ...camposPapeletaBase,

    fechaInicio: fechaSchema.optional(),

    fechaFin: fechaSchema.optional(),

    horaSalida: fechaHoraSchema.optional(),

    horaRetorno: fechaHoraSchema.optional(),
  })
  .strict()
  .superRefine((datos, ctx) => {
    if (datos.motivo === MOTIVO_OTROS && !datos.motivoOtros) {
      ctx.addIssue({
        code: 'custom',
        path: ['motivoOtros'],
        message: 'motivoOtros es obligatorio cuando el motivo es "Otros"',
      });
    }

    if (datos.tipoTiempo === TipoTiempo.DIAS) {
      if (datos.fechaInicio === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['fechaInicio'],
          message: 'fechaInicio es obligatorio para papeletas de tipo DIAS',
        });
      }

      if (datos.fechaFin === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['fechaFin'],
          message: 'fechaFin es obligatorio para papeletas de tipo DIAS',
        });
      }

      if (
        datos.fechaInicio !== undefined &&
        datos.fechaFin !== undefined &&
        new Date(datos.fechaFin) < new Date(datos.fechaInicio)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['fechaFin'],
          message: 'fechaFin debe ser mayor o igual a fechaInicio',
        });
      }

      return;
    }

    // tipoTiempo === HORAS
    if (datos.horaSalida === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['horaSalida'],
        message: 'horaSalida es obligatoria para papeletas de tipo HORAS',
      });
    }

    if (datos.horaRetorno === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['horaRetorno'],
        message: 'horaRetorno es obligatoria para papeletas de tipo HORAS',
      });
    }

    if (datos.horaSalida !== undefined && datos.horaRetorno !== undefined) {
      const salida = new Date(datos.horaSalida);
      const retorno = new Date(datos.horaRetorno);

      if (retorno <= salida) {
        ctx.addIssue({
          code: 'custom',
          path: ['horaRetorno'],
          message: 'horaRetorno debe ser posterior a horaSalida',
        });
        return;
      }

      const mismoDia =
        salida.getFullYear() === retorno.getFullYear() &&
        salida.getMonth() === retorno.getMonth() &&
        salida.getDate() === retorno.getDate();

      if (!mismoDia) {
        ctx.addIssue({
          code: 'custom',
          path: ['horaRetorno'],
          message: 'horaSalida y horaRetorno deben ser del mismo día',
        });
      }
    }
  })
  .transform((datos): PapeletaNormalizada => {
    const motivoOtros =
      datos.motivo === MOTIVO_OTROS ? datos.motivoOtros ?? null : null;

    if (datos.tipoTiempo === TipoTiempo.DIAS) {
      return {
        tipoTiempo: datos.tipoTiempo,
        motivo: datos.motivo,
        motivoOtros,
        fechaInicio: new Date(datos.fechaInicio as string),
        fechaFin: new Date(datos.fechaFin as string),
        horaSalida: null,
        horaRetorno: null,
      };
    }

    const horaSalida = new Date(datos.horaSalida as string);
    const horaRetorno = new Date(datos.horaRetorno as string);

    return {
      tipoTiempo: datos.tipoTiempo,
      motivo: datos.motivo,
      motivoOtros,
      fechaInicio: horaSalida,
      fechaFin: horaRetorno,
      horaSalida,
      horaRetorno,
    };
  });

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
  .strict()
  .superRefine((datos, ctx) => {
    if (
      datos.fechaInicio !== undefined &&
      datos.fechaFin !== undefined &&
      parseFechaLocal(datos.fechaFin, true) <
        parseFechaLocal(datos.fechaInicio)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['fechaFin'],
        message: 'fechaFin debe ser mayor o igual a fechaInicio',
      });
    }
  });