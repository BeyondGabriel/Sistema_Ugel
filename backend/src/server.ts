// ===========================================================
// Punto de entrada del servidor: HTTP + Socket.IO + jobs periódicos
// ===========================================================

import http from 'http';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { Server as SocketIOServer, Socket } from 'socket.io';
import app from './app';
import { inicializarSocket } from './sockets/io';
import { revertirRevisionesExpiradas } from './services/papeleta.service';
import {
  cerrarSolicitudesExpiradas,
  verificarYNotificarVentanaAnulacion,
} from './services/anulacion.service';
import prisma from './utils/prisma';
import {
  PayloadJWT,
  UsuarioAutenticado,
} from './middlewares/authJWT';

dotenv.config();

// Verificar configuración necesaria antes de iniciar el servidor.
const frontendOrigin = process.env.FRONTEND_ORIGIN;

if (!frontendOrigin) {
  throw new Error(
    'FRONTEND_ORIGIN no está configurado en las variables de entorno'
  );
}

// Convertir a número para que coincida con la firma de server.listen
const PORT = Number(process.env.PORT) || 3001;

const server = http.createServer(app);

// ─────────────────────────────────────────────────────────────
// Socket.IO
// ─────────────────────────────────────────────────────────────

export const io = new SocketIOServer(server, {
  cors: {
    origin: frontendOrigin,
  },
});

/**
 * Middleware de autenticación para Socket.IO.
 *
 * El cliente debe enviar su JWT en:
 * socket.handshake.auth.token
 *
 * Flujo:
 * 1. Verificar la firma y expiración del JWT.
 * 2. Obtener el ID del usuario desde el token.
 * 3. Consultar el usuario actual en la base de datos.
 * 4. Verificar que la cuenta exista y esté activa.
 * 5. Guardar en socket.data.usuario la información actual del usuario.
 *
 * El rol y el email NO se obtienen del JWT.
 */
io.use(async (socket: Socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  const secret = process.env.JWT_SECRET;

  if (!token) {
    return next(new Error('Token de autenticación no proporcionado'));
  }

  if (!secret) {
    console.error('JWT_SECRET no está configurado en las variables de entorno');
    return next(new Error('Configuración de servidor incompleta'));
  }

  try {
    const payload = jwt.verify(token, secret) as PayloadJWT;

    // Validación básica del payload antes de consultar la BD.
    if (!payload || !Number.isInteger(payload.id) || payload.id <= 0) {
      return next(new Error('Token inválido o expirado'));
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

    // El token puede seguir siendo válido, pero la cuenta puede haber
    // sido eliminada o desactivada posteriormente.
    if (!usuario) {
      return next(new Error('Usuario no encontrado'));
    }

    if (!usuario.activo) {
      return next(new Error('La cuenta del usuario está desactivada'));
    }

    const usuarioAutenticado: UsuarioAutenticado = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      ...(payload.requiereCambioPassword === true
        ? { requiereCambioPassword: true }
        : {}),
    };

    socket.data.usuario = usuarioAutenticado;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new Error('Token expirado'));
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error('Token inválido o expirado'));
    }

    console.error('Error en autenticación de Socket.IO:', error);
    return next(new Error('Error interno de autenticación'));
  }
});

io.on('connection', (socket: Socket) => {
  const usuario = socket.data.usuario as UsuarioAutenticado;
  const sala = `usuario:${usuario.id}`;

  socket.join(sala);

  console.log(
    `Socket conectado: usuario ${usuario.id} (${usuario.email}) → sala ${sala}`
  );

  socket.on('disconnect', () => {
    console.log(`Socket desconectado: usuario ${usuario.id}`);
  });
});

// Registrar la instancia de io en el módulo compartido para que los
// servicios (notificacion.service.ts) puedan emitir eventos.
inicializarSocket(io);

console.log('Socket.IO inicializado y escuchando conexiones autenticadas');

// ─────────────────────────────────────────────────────────────
// Servidor HTTP
// ─────────────────────────────────────────────────────────────

// Escuchar en todas las interfaces IPv4 para evitar problemas con proxies (Vite)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});

// ─────────────────────────────────────────────────────────────
// Jobs periódicos (cada 60 segundos)
// ─────────────────────────────────────────────────────────────

setInterval(() => {
  // 1. Revisar papeletas EN_REVISION con timeout de 20 min (Fase 3)
  revertirRevisionesExpiradas().catch((error) => {
    console.error('Error al revertir revisiones expiradas:', error);
  });

  // 2. Cerrar solicitudes de anulación cuya ventana venció (Fase 4)
  cerrarSolicitudesExpiradas().catch((error) => {
    console.error('Error al cerrar solicitudes de anulación expiradas:', error);
  });

  // 3. Alertar cuando queda 1 h o menos para el cierre de ventana (Fase 4)
  verificarYNotificarVentanaAnulacion().catch((error) => {
    console.error(
      'Error al verificar/notificar la ventana de anulación:',
      error
    );
  });
}, 60 * 1000);

export default server;
