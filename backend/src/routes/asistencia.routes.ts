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

const router = Router();

router.post('/', authJWT, checkRole('VIGILANTE', 'ADMIN'), registrarMovimiento);
// /exportar debe ir antes de /:id para que Express no lo trate como parámetro
router.get('/exportar', authJWT, checkRole('VIGILANTE', 'ADMIN', 'RRHH'), exportarAsistencias);
router.put('/:id', authJWT, checkRole('VIGILANTE', 'ADMIN'), editarMovimiento);
router.get('/', authJWT, listarMovimientos);
router.get('/presencia', authJWT, checkRole('VIGILANTE', 'ADMIN', 'RRHH'), obtenerPresencia);

export default router;
