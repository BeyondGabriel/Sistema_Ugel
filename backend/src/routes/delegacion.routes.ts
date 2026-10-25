// ===========================================================
// Rutas del módulo de delegaciones de aprobación (Bloque A)
// ===========================================================

import { Router } from 'express';

import {
  listarDelegaciones,
  crearDelegacion,
  anularDelegacion,
} from '../controllers/delegacion.controller';

import { authJWT } from '../middlewares/authJWT';
import { checkRole } from '../middlewares/checkRole';
import { validate } from '../middlewares/validate';

import {
  crearDelegacionSchema,
  anularDelegacionSchema,
  delegacionIdParamsSchema,
  listarDelegacionesQuerySchema,
} from '../schemas/delegacion.schema';

const router = Router();

// El listado lo consultan el Administrador y los titulares/encargados
// (JEFE y DIRECTORA) para ver sus propias delegaciones en el dashboard.
// La creación y anulación siguen siendo exclusivas del Administrador.
router.get(
  '/',
  authJWT,
  checkRole('ADMIN', 'JEFE', 'DIRECTORA'),
  validate(listarDelegacionesQuerySchema, 'query'),
  listarDelegaciones,
);

router.post(
  '/',
  authJWT,
  checkRole('ADMIN'),
  validate(crearDelegacionSchema, 'body'),
  crearDelegacion,
);

router.put(
  '/:id/anular',
  authJWT,
  checkRole('ADMIN'),
  validate(delegacionIdParamsSchema, 'params'),
  validate(anularDelegacionSchema, 'body'),
  anularDelegacion,
);

export default router;
