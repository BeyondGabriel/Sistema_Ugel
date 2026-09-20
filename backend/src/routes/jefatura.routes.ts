// ===========================================================
// Rutas de jefaturas
// ===========================================================

import { Router } from 'express';

import {
  listarJefaturas,
  crearJefatura,
  editarJefatura,
  eliminarJefatura,
} from '../controllers/jefatura.controller';

import { authJWT } from '../middlewares/authJWT';
import { checkRole } from '../middlewares/checkRole';
import { validate } from '../middlewares/validate';

import {
  crearJefaturaSchema,
  editarJefaturaSchema,
  jefaturaIdParamsSchema,
} from '../schemas/jefatura.schema';

const router = Router();

router.get(
  '/',
  authJWT,
  listarJefaturas,
);

router.post(
  '/',
  authJWT,
  checkRole('ADMIN'),
  validate(crearJefaturaSchema, 'body'),
  crearJefatura,
);

router.put(
  '/:id',
  authJWT,
  checkRole('ADMIN'),
  validate(jefaturaIdParamsSchema, 'params'),
  validate(editarJefaturaSchema, 'body'),
  editarJefatura,
);

router.delete(
  '/:id',
  authJWT,
  checkRole('ADMIN'),
  validate(jefaturaIdParamsSchema, 'params'),
  eliminarJefatura,
);

export default router;