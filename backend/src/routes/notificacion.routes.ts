// ===========================================================
// Rutas de notificaciones del usuario
// ===========================================================

import { Router } from 'express';

import {
  listarNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
} from '../controllers/notificacion.controller';

import { authJWT } from '../middlewares/authJWT';
import { validate } from '../middlewares/validate';

import {
  notificacionIdParamsSchema,
  listarNotificacionesQuerySchema,
} from '../schemas/notificacion.schema';

const router = Router();

// IMPORTANTE: la ruta fija /leer-todas debe ir ANTES de /:id/leer,
// para que Express no intente parsear "leer-todas" como un :id.

router.put(
  '/leer-todas',
  authJWT,
  marcarTodasLeidas,
);

router.get(
  '/',
  authJWT,
  validate(listarNotificacionesQuerySchema, 'query'),
  listarNotificaciones,
);

router.put(
  '/:id/leer',
  authJWT,
  validate(notificacionIdParamsSchema, 'params'),
  marcarLeida,
);

export default router;