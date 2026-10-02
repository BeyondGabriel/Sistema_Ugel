// ===========================================================
// Middleware: alcance restringido del token temporal de cambio
// de contraseña (hallazgo H-01)
// ===========================================================

import { Request, Response, NextFunction } from 'express';

/**
 * Rutas que siguen permitidas mientras el usuario tiene una contraseña
 * pendiente de cambio (token temporal):
 * - POST /api/auth/cambiar-password  → para completar el cambio.
 * - GET  /api/auth/mi-perfil         → para rehidratar la sesión.
 *
 * Se comparan ruta y método sobre el path (sin query string) para que
 * variantes con slash final o parámetros no eludan la comprobación.
 */
function esRutaPermitida(req: Request): boolean {
  const ruta = req.originalUrl.split('?')[0].replace(/\/+$/, '');

  if (ruta === '/api/auth/cambiar-password') {
    return req.method === 'POST';
  }

  if (ruta === '/api/auth/mi-perfil') {
    return req.method === 'GET';
  }

  return false;
}

/**
 * Bloquea con HTTP 403 el acceso al resto de la API cuando el usuario
 * autenticado debe cambiar su contraseña (`req.usuario.cambioPassword === true`).
 *
 * Debe ejecutarse SIEMPRE después de `authJWT`, que es quien coloca en
 * `req.usuario` el estado ACTUAL del usuario leído de la base de datos.
 *
 * De esta forma, el token temporal de primer ingreso queda limitado al cambio
 * de contraseña y a la consulta del propio perfil, sin permitir operar con el
 * resto del sistema hasta completar el cambio.
 */
export function exigirCambioPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const usuario = req.usuario;

  if (usuario && usuario.cambioPassword === true && !esRutaPermitida(req)) {
    res.status(403).json({
      mensaje:
        'Debe cambiar su contraseña antes de continuar con esta operación',
    });
    return;
  }

  next();
}