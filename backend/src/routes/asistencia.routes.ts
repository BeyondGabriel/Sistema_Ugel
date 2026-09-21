// ===========================================================
// Rutas del módulo de asistencias
// ===========================================================

import { Router } from 'express';

import {
  registrarMovimiento,
  editarMovimiento,
  listarMovimientos,
  obtenerPresencia,
} from '../controllers/asistencia.controller';

import { exportarAsistencias } from '../controllers/reportes.controller';

import { authJWT } from '../middlewares/authJWT';
import { checkRole } from '../middlewares/checkRole';
import { validate } from '../middlewares/validate';

import {
  registrarMovimientoSchema,
  editarMovimientoSchema,
  asistenciaIdParamsSchema,
  listarMovimientosQuerySchema,
  obtenerPresenciaQuerySchema,
} from '../schemas/asistencia.schema';

const router = Router();

router.post(
  '/',
  authJWT,
  checkRole('VIGILANTE', 'ADMIN'),
  validate(registrarMovimientoSchema, 'body'),
  registrarMovimiento,
);

router.get(
  '/exportar',
  authJWT,
  checkRole('VIGILANTE', 'ADMIN', 'RRHH'),
  validate(listarMovimientosQuerySchema, 'query'),
  exportarAsistencias,
);

router.put(
  '/:id',
  authJWT,
  checkRole('VIGILANTE', 'ADMIN'),
  validate(asistenciaIdParamsSchema, 'params'),
  validate(editarMovimientoSchema, 'body'),
  editarMovimiento,
);

router.get(
  '/',
  authJWT,
  validate(listarMovimientosQuerySchema, 'query'),
  listarMovimientos,
);

router.get(
  '/presencia',
  authJWT,
  checkRole('VIGILANTE', 'ADMIN', 'RRHH'),
  validate(obtenerPresenciaQuerySchema, 'query'),
  obtenerPresencia,
);

export default router;