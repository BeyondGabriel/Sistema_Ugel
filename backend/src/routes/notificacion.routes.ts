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

const router = Router();

// IMPORTANTE: la ruta fija /leer-todas debe ir ANTES de /:id/leer,
// para que Express no intente parsear "leer-todas" como un :id.
router.put('/leer-todas', authJWT, marcarTodasLeidas);
router.get('/', authJWT, listarNotificaciones);
router.put('/:id/leer', authJWT, marcarLeida);

export default router;
