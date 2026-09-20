// ===========================================================
// Middleware de validación de entradas mediante Zod
// ===========================================================

import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';

/**
 * Valida una parte de la petición antes de ejecutar el controlador.
 *
 * Si los datos son válidos, continúa hacia el siguiente middleware.
 * Si no son válidos, responde con HTTP 400 y los errores encontrados.
 */
export function validate<T extends ZodType>(
  schema: T,
  fuente: 'body' | 'params' | 'query' = 'body',
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const resultado = schema.safeParse(req[fuente]);

    if (!resultado.success) {
      const errores: Record<string, string> = {};

      for (const issue of resultado.error.issues) {
        const campo = issue.path.length > 0
          ? issue.path.join('.')
          : 'entrada';

        if (!errores[campo]) {
          errores[campo] = issue.message;
        }
      }

      res.status(400).json({
        mensaje: 'Los datos enviados no son válidos',
        errores,
      });

      return;
    }

    // Sustituye los datos originales por los datos ya validados
    // y transformados por el esquema.
    req[fuente] = resultado.data;

    next();
  };
}