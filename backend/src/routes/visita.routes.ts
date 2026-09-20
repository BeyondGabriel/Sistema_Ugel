// ===========================================================
// Rutas del módulo de visitas
// ===========================================================

import { Router } from 'express';

import {
  registrarVisita,
  registrarSalida,
  marcarGafete,
  listarVisitas,
  obtenerVisita,
} from '../controllers/visita.controller';

import { exportarVisitas } from '../controllers/reportes.controller';

import { authJWT } from '../middlewares/authJWT';
import { checkRole } from '../middlewares/checkRole';
import { validate } from '../middlewares/validate';

import {
  registrarVisitaSchema,
  visitaIdParamsSchema,
  listarVisitasQuerySchema,
} from '../schemas/visita.schema';

const router = Router();

router.post(
  '/',
  authJWT,
  checkRole('VIGILANTE', 'ADMIN'),
  validate(registrarVisitaSchema, 'body'),
  registrarVisita,
);

// /exportar debe ir antes de /:id
router.get('/exportar', authJWT, exportarVisitas);

router.get(
  '/',
  authJWT,
  validate(listarVisitasQuerySchema, 'query'),
  listarVisitas,
);

router.get(
  '/:id',
  authJWT,
  validate(visitaIdParamsSchema, 'params'),
  obtenerVisita,
);

router.put(
  '/:id/salida',
  authJWT,
  checkRole('VIGILANTE', 'ADMIN'),
  validate(visitaIdParamsSchema, 'params'),
  registrarSalida,
);

router.put(
  '/:id/gafete',
  authJWT,
  checkRole('VIGILANTE', 'ADMIN'),
  validate(visitaIdParamsSchema, 'params'),
  marcarGafete,
);

export default router;