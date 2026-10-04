// ===========================================================
// Configuración principal de Express
// (sin app.listen: eso vive en server.ts)
// ===========================================================

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes';
import usuarioRoutes from './routes/usuario.routes';
import asistenciaRoutes from './routes/asistencia.routes';
import papeletaRoutes from './routes/papeleta.routes';
import visitaRoutes from './routes/visita.routes';
import firmaExternaRoutes from './routes/firmaExterna.routes';
import notificacionRoutes from './routes/notificacion.routes';
import jefaturaRoutes from './routes/jefatura.routes';

import { authJWT } from './middlewares/authJWT';
import { exigirCambioPassword } from './middlewares/exigirCambioPassword';

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

// H-10: cabeceras de seguridad HTTP.
app.use(helmet());

// H-10: límite explícito del cuerpo JSON para mitigar DoS por payloads grandes.
// Punto 6: se conserva el buffer crudo del webhook en req.rawBody para poder
// verificar la firma HMAC-SHA256 sobre el cuerpo exacto recibido.
app.use(
  express.json({
    limit: '100kb',
    verify: (req: any, _res, buf) => {
      if (req.url?.includes('/webhook')) {
        req.rawBody = buf;
      }
    },
  })
);

// Rutas de autenticación (login público; cambiar-password y mi-perfil ya
// traen authJWT y su validación de entrada).
app.use('/api/auth', authRoutes);

// Webhook de firma externa: se autentica con x-webhook-secret (no con JWT),
// por lo que debe registrarse ANTES del blindaje global por authJWT.
app.use('/api/firmas', firmaExternaRoutes);

// Ruta de verificación simple (útil para chequear que el servidor responde)
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ estado: 'ok' });
});

// Blindaje global de autenticación (authJWT) y del alcance del token temporal
// de cambio de contraseña (H-01). Se aplica a todo el resto del API, después
// de las rutas públicas y del webhook.
app.use('/api', authJWT, exigirCambioPassword);

// Rutas de la aplicación
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/asistencias', asistenciaRoutes);
app.use('/api/papeletas', papeletaRoutes);
app.use('/api/visitas', visitaRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/jefaturas', jefaturaRoutes);

// Middleware de manejo de errores global.
// Debe registrarse al final, después de todas las rutas,
// y con 4 parámetros para que Express lo reconozca
// como middleware de errores.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ mensaje: 'Error interno del servidor' });
});

export default app;

