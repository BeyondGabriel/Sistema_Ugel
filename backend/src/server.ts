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
import { cerrarSolicitudesExpiradas, verificarYNotificarVentanaAnulacion } from './services/anulacion.service';
import { PayloadJWT } from './middlewares/authJWT';

dotenv.config();

// Convertir a número para que coincida con la firma de server.listen
const PORT = Number(process.env.PORT) || 3001;

const server = http.createServer(app);

// ─────────────────────────────────────────────────────────────
// Socket.IO
// ─────────────────────────────────────────────────────────────

export const io = new SocketIOServer(server, {
  cors: { origin: '*' }, // TODO: restringir al dominio del frontend en producción
});

/**
 * Middleware de autenticación para Socket.IO.
 * El cliente debe enviar su JWT en socket.handshake.auth.token.
 * Si el token es válido, el payload decodificado queda en socket.data.usuario.
 */
io.use((socket: Socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  const secret = process.env.JWT_SECRET;

  if (!token) {
    return next(new Error('Token de autenticación no proporcionado'));
  }

  if (!secret) {
    return next(new Error('Configuración de servidor incompleta'));
  }

  try {
    const payload = jwt.verify(token, secret) as PayloadJWT;
    socket.data.usuario = payload;
    next();
  } catch {
    next(new Error('Token inválido o expirado'));
  }
});

io.on('connection', (socket: Socket) => {
  const usuario = socket.data.usuario as PayloadJWT;
  const sala = `usuario:${usuario.id}`;

  socket.join(sala);
  console.log(`Socket conectado: usuario ${usuario.id} (${usuario.email}) → sala ${sala}`);

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
    console.error('Error al verificar/notificar la ventana de anulación:', error);
  });
}, 60 * 1000);

export default server;