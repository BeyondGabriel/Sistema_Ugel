// ===========================================================
// Controlador de autenticación: login, cambio de contraseña
// obligatorio en primer ingreso, y perfil del usuario actual.
// ===========================================================

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { validarPassword } from '../utils/validarPassword';
import { PayloadJWT } from '../middlewares/authJWT';

const EXPIRACION_TOKEN_TEMPORAL = '15m';
const EXPIRACION_TOKEN_NORMAL = '8h';

/** Lee JWT_SECRET del entorno o lanza un error si no está configurado. */
function obtenerJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no está configurado en las variables de entorno');
  }
  return secret;
}

/**
 * POST /api/auth/login
 *
 * Autentica a un usuario por email y contraseña. Si el usuario tiene
 * cambioPassword=true, se emite un token temporal de corta duración
 * (15 min) pensado únicamente para completar el cambio de contraseña.
 * En caso contrario, se emite un token normal de sesión (8 horas).
 *
 * El JWT contiene únicamente el ID del usuario y, en el caso del token
 * temporal, la marca requiereCambioPassword. El email y el rol no se
 * almacenan en el token porque se obtienen desde la base de datos en
 * cada petición autenticada mediante authJWT.
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      res.status(400).json({ mensaje: 'Email y contraseña son obligatorios' });
      return;
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      res.status(401).json({ mensaje: 'Credenciales inválidas' });
      return;
    }

    if (!usuario.activo) {
      res.status(403).json({
        mensaje: 'El usuario está desactivado. Contacte con el administrador.',
      });
      return;
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      res.status(401).json({ mensaje: 'Credenciales inválidas' });
      return;
    }

    const secret = obtenerJwtSecret();

    /**
     * Estos datos siguen formando parte de la respuesta del login
     * para que el frontend pueda inicializar la sesión.
     *
     * No se incluyen dentro del JWT.
     */
    const datosBasicos = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      nombres: usuario.nombres,
      cambioPassword: usuario.cambioPassword,
    };

    if (usuario.cambioPassword) {
      /**
       * Token temporal:
       * - identifica al usuario mediante su ID;
       * - marca que se trata de un token para cambio de contraseña;
       * - expira después de 15 minutos.
       */
      const payload: PayloadJWT = {
        id: usuario.id,
        requiereCambioPassword: true,
      };

      const tokenTemporal = jwt.sign(payload, secret, {
        expiresIn: EXPIRACION_TOKEN_TEMPORAL,
      });

      res.status(200).json({
        requiereCambioPassword: true,
        token: tokenTemporal,
        usuario: datosBasicos,
      });

      return;
    }

    /**
     * Token normal de sesión:
     * contiene únicamente el ID del usuario.
     *
     * El email y el rol actuales se obtendrán desde la BD mediante
     * authJWT en cada petición autenticada.
     */
    const payload: PayloadJWT = {
      id: usuario.id,
    };

    const token = jwt.sign(payload, secret, {
      expiresIn: EXPIRACION_TOKEN_NORMAL,
    });

    res.status(200).json({
      requiereCambioPassword: false,
      token,
      usuario: datosBasicos,
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * POST /api/auth/cambiar-password
 *
 * Requiere autenticación (authJWT). Verifica la contraseña actual,
 * valida la política de la nueva contraseña, la actualiza y desactiva
 * el flag cambioPassword.
 */
export async function cambiarPassword(req: Request, res: Response): Promise<void> {
  try {
    const usuarioToken = req.usuario;

    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const { passwordActual, nuevaPassword } = req.body as {
      passwordActual?: string;
      nuevaPassword?: string;
    };

    if (!passwordActual || !nuevaPassword) {
      res.status(400).json({
        mensaje: 'passwordActual y nuevaPassword son obligatorios',
      });
      return;
    }

    if (!validarPassword(nuevaPassword)) {
      res.status(400).json({
        mensaje:
          'La nueva contraseña debe tener mínimo 8 caracteres, al menos un número y un símbolo',
      });
      return;
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioToken.id },
    });

    if (!usuario) {
      res.status(404).json({ mensaje: 'Usuario no encontrado' });
      return;
    }

    const passwordActualEsCorrecta = await bcrypt.compare(
      passwordActual,
      usuario.password
    );

    if (!passwordActualEsCorrecta) {
      res.status(401).json({
        mensaje: 'La contraseña actual no es correcta',
      });
      return;
    }

    const nuevaPasswordHasheada = await bcrypt.hash(nuevaPassword, 10);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        password: nuevaPasswordHasheada,
        cambioPassword: false,
      },
    });

    res.status(200).json({
      mensaje: 'Contraseña actualizada correctamente',
    });
  } catch (error) {
    console.error('Error en cambiarPassword:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * GET /api/auth/mi-perfil
 *
 * Requiere autenticación (authJWT). Devuelve los datos completos del
 * usuario autenticado, incluyendo su jefatura y jefe inmediato, para
 * que el frontend pueda rehidratar la sesión al recargar la página.
 */
export async function miPerfil(req: Request, res: Response): Promise<void> {
  try {
    const usuarioToken = req.usuario;

    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioToken.id },
      include: {
        jefatura: true,
        jefe: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            rol: true,
          },
        },
      },
    });

    if (!usuario) {
      res.status(404).json({ mensaje: 'Usuario no encontrado' });
      return;
    }

    const { password, ...usuarioSinPassword } = usuario;

    res.status(200).json({
      usuario: usuarioSinPassword,
    });
  } catch (error) {
    console.error('Error en miPerfil:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}
