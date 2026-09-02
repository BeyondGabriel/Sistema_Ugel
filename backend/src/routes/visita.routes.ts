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

const router = Router();

router.post('/', authJWT, checkRole('VIGILANTE', 'ADMIN'), registrarVisita);
// /exportar debe ir antes de /:id
router.get('/exportar', authJWT, exportarVisitas);
router.get('/', authJWT, listarVisitas);
router.get('/:id', authJWT, obtenerVisita);
router.put('/:id/salida', authJWT, checkRole('VIGILANTE', 'ADMIN'), registrarSalida);
router.put('/:id/gafete', authJWT, checkRole('VIGILANTE', 'ADMIN'), marcarGafete);

export default router;
