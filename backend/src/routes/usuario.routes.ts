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

const router = Router();

router.post('/', authJWT, checkRole('ADMIN', 'RRHH'), crearUsuario);
router.post('/asignar-jefe', authJWT, checkRole('ADMIN'), asignarJefe);
router.get('/', authJWT, checkRole('ADMIN', 'RRHH', 'VIGILANTE'), listarUsuarios);
router.get('/:id', authJWT, checkRole('ADMIN', 'RRHH'), obtenerUsuario);
router.put('/:id', authJWT, checkRole('ADMIN'), editarUsuario);
router.put('/:id/desactivar', authJWT, checkRole('ADMIN'), desactivarUsuario);

export default router;