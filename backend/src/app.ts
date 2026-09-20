// ===========================================================
// Configuración principal de Express
// (sin app.listen: eso vive en server.ts)
// ===========================================================

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes';
import usuarioRoutes from './routes/usuario.routes';
import asistenciaRoutes from './routes/asistencia.routes';
import papeletaRoutes from './routes/papeleta.routes';
import visitaRoutes from './routes/visita.routes';
import firmaExternaRoutes from './routes/firmaExterna.routes';
import notificacionRoutes from './routes/notificacion.routes';
import jefaturaRoutes from './routes/jefatura.routes';

dotenv.config();

const app = express();

const frontendOrigin = process.env.FRONTEND_ORIGIN;

if (!frontendOrigin) {
  throw new Error(
    'FRONTEND_ORIGIN no está configurado en las variables de entorno'
  );
}

app.use(
  cors({
    origin: frontendOrigin,
  })
);

app.use(express.json());

// Rutas de la aplicación
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/asistencias', asistenciaRoutes);
app.use('/api/papeletas', papeletaRoutes);
app.use('/api/visitas', visitaRoutes);
app.use('/api/firmas', firmaExternaRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/jefaturas', jefaturaRoutes);

// Ruta de verificación simple (útil para chequear que el servidor responde)
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ estado: 'ok' });
});

// Middleware de manejo de errores global.
// Debe registrarse al final, después de todas las rutas,
// y con 4 parámetros para que Express lo reconozca
// como middleware de errores.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ mensaje: 'Error interno del servidor' });
});

export default app;

