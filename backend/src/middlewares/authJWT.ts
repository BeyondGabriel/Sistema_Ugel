// ===========================================================
// Middleware de autenticación JWT
// ===========================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Rol } from '@prisma/client';
import prisma from '../utils/prisma';

/**
 * Forma mínima del payload firmado en los tokens JWT.
 *
 * El JWT identifica al usuario mediante su ID. El rol y demás
 * datos actuales del usuario se obtienen desde la base de datos
 * en cada petición autenticada.
 */
export interface PayloadJWT {
  id: number;
  /** true únicamente en el token temporal de cambio de contraseña */
  requiereCambioPassword?: boolean;
}

/**
 * Forma del usuario autenticado que queda disponible en req.usuario.
 *
 * Estos datos representan el estado ACTUAL del usuario en la base
 * de datos, no la información que pudiera haber quedado almacenada
 * en un JWT emitido anteriormente.
 */
export interface UsuarioAutenticado {
  id: number;
  email: string;
  rol: Rol;
  requiereCambioPassword?: boolean;
}

// Extiende la interfaz Request de Express para incluir el usuario autenticado
declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
    }
  }
}

/**
 * Middleware de autenticación.
 *
 * Flujo:
 * 1. Extrae el token del header Authorization.
 * 2. Verifica la firma y expiración del JWT.
 * 3. Obtiene el ID del usuario desde el payload.
 * 4. Consulta el usuario actual en la base de datos.
 * 5. Verifica que exista y continúe activo.
 * 6. Coloca en req.usuario los datos actuales de la BD.
 *
 * De esta forma, un JWT todavía válido deja de ser suficiente si:
 * - la cuenta fue desactivada;
 * - el usuario ya no existe;
 * - el rol actual fue modificado.
 */
export async function authJWT(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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

    // Validación básica adicional del payload antes de consultar la BD.
    if (!payload || !Number.isInteger(payload.id) || payload.id <= 0) {
      res.status(401).json({ mensaje: 'Token inválido o expirado' });
      return;
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        rol: true,
        activo: true,
        cambioPassword: true,
      },
    });

    // El JWT puede seguir sin expirar, pero la cuenta ya no debe tener acceso.
    if (!usuario) {
      res.status(401).json({ mensaje: 'Usuario no encontrado' });
      return;
    }

    if (!usuario.activo) {
      res.status(401).json({ mensaje: 'La cuenta del usuario está desactivada' });
      return;
    }

    /**
     * El rol y el email provienen de la BD, no del JWT.
     *
     * `requiereCambioPassword` se conserva únicamente cuando el token
     * contiene explícitamente esa marca. Para el token temporal, esto
     * permite mantener la lógica actual del flujo de cambio inicial.
     */
    req.usuario = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      ...(payload.requiereCambioPassword === true
        ? { requiereCambioPassword: true }
        : {}),
    };

    next();
  } catch (error) {
    // Los errores de jwt.verify (firma inválida, token expirado, etc.)
    // y errores inesperados no deben exponer detalles internos al cliente.
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ mensaje: 'Token expirado' });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ mensaje: 'Token inválido o expirado' });
      return;
    }

    console.error('Error en middleware de autenticación JWT:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

