// ===========================================================
// Middleware de autorización por rol
// ===========================================================

import { Request, Response, NextFunction } from 'express';

/** Nombres de rol válidos como literales de cadena (p.ej. 'ADMIN', 'RRHH') */
type NombreRol = NonNullable<Request['usuario']>['rol'];

/**
 * Middleware de autorización.
 *
 * Recibe uno o más roles permitidos y verifica que el usuario
 * autenticado (adjuntado previamente por authJWT) tenga alguno
 * de ellos.
 *
 * Importante:
 * - authJWT valida que el JWT sea válido.
 * - authJWT consulta el usuario actual en la BD.
 * - Por tanto, usuario.rol representa el rol ACTUAL del usuario.
 *
 * Uso:
 * router.post('/', authJWT, checkRole('ADMIN', 'RRHH'), controlador);
 */
export function checkRole(...rolesPermitidos: NombreRol[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const usuario = req.usuario;

    if (!usuario) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    if (!rolesPermitidos.includes(usuario.rol)) {
      res.status(403).json({
        mensaje: 'No tiene permisos para realizar esta acción',
      });
      return;
    }

    next();
  };
}
