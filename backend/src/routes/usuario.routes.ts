// ===========================================================
// Rutas de gestión de usuarios
// ===========================================================

import { Router } from 'express';

import {
  crearUsuario,
  editarUsuario,
  desactivarUsuario,
  listarUsuarios,
  obtenerUsuario,
  asignarJefe,
} from '../controllers/usuario.controller';

import { authJWT } from '../middlewares/authJWT';
import { checkRole } from '../middlewares/checkRole';
import { validate } from '../middlewares/validate';

import {
  crearUsuarioSchema,
  editarUsuarioSchema,
  asignarJefeSchema,
  usuarioIdParamsSchema,
  listarUsuariosQuerySchema,
} from '../schemas/usuario.schema';

const router = Router();

// Crear usuario
router.post(
  '/',
  authJWT,
  checkRole('ADMIN', 'RRHH'),
  validate(crearUsuarioSchema, 'body'),
  crearUsuario,
);

// Asignar jefe
router.post(
  '/asignar-jefe',
  authJWT,
  checkRole('ADMIN'),
  validate(asignarJefeSchema, 'body'),
  asignarJefe,
);

// Listar usuarios
router.get(
  '/',
  authJWT,
  checkRole('ADMIN', 'RRHH', 'VIGILANTE'),
  validate(listarUsuariosQuerySchema, 'query'),
  listarUsuarios,
);

// Obtener usuario
router.get(
  '/:id',
  authJWT,
  checkRole('ADMIN', 'RRHH'),
  validate(usuarioIdParamsSchema, 'params'),
  obtenerUsuario,
);

// Editar usuario
router.put(
  '/:id',
  authJWT,
  checkRole('ADMIN'),
  validate(usuarioIdParamsSchema, 'params'),
  validate(editarUsuarioSchema, 'body'),
  editarUsuario,
);

// Desactivar usuario
router.put(
  '/:id/desactivar',
  authJWT,
  checkRole('ADMIN'),
  validate(usuarioIdParamsSchema, 'params'),
  desactivarUsuario,
);

export default router;