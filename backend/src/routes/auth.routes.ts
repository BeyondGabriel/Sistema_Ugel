// ===========================================================
// Rutas de autenticación
// ===========================================================

import { Router } from 'express';

import {
  login,
  cambiarPassword,
  miPerfil,
} from '../controllers/auth.controller';

import { authJWT } from '../middlewares/authJWT';
import { rateLimitLogin } from '../middlewares/rateLimit';
import { validate } from '../middlewares/validate';

import {
  loginSchema,
  cambiarPasswordSchema,
} from '../schemas/auth.schema';

const router = Router();

router.post(
  '/login',
  rateLimitLogin,
  validate(loginSchema, 'body'),
  login,
);

router.post(
  '/cambiar-password',
  authJWT,
  validate(cambiarPasswordSchema, 'body'),
  cambiarPassword,
);

router.get('/mi-perfil', authJWT, miPerfil);

export default router;