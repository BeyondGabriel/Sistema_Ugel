// ===========================================================
// Middleware de autenticación JWT
// ===========================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Rol } from '@prisma/client';

/**
 * Forma del payload firmado en los tokens JWT, tanto en el login normal
 * como en el token temporal de cambio de contraseña.
 */
export interface PayloadJWT {
  id: number;
  email: string;
  rol: Rol;
  /** true únicamente en el token temporal emitido cuando cambioPassword=true */
  requiereCambioPassword?: boolean;
}

// Extiende la interfaz Request de Express para incluir el usuario autenticado
declare global {
  namespace Express {
    interface Request {
      usuario?: PayloadJWT;
    }
  }
}

/**
 * Middleware de autenticación. Extrae el token del header
 * "Authorization: Bearer <token>", lo verifica con JWT_SECRET y,
 * si es válido, adjunta el payload decodificado a req.usuario.
 */
export function authJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ mensaje: 'No se proporcionó un token de autenticación' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token) {
    res.status(401).json({ mensaje: 'No se proporcionó un token de autenticación' });
    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error('JWT_SECRET no está configurado en las variables de entorno');
    res.status(500).json({ mensaje: 'Error de configuración del servidor' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as PayloadJWT;
    req.usuario = payload;
    next();
  } catch (error) {
    res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
}
