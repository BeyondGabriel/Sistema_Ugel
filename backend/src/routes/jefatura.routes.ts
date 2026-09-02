// ===========================================================
// Rutas de jefaturas
// ===========================================================

import { Router } from 'express';
import { listarJefaturas, crearJefatura, editarJefatura, eliminarJefatura } from '../controllers/jefatura.controller';
import { authJWT } from '../middlewares/authJWT';
import { checkRole } from '../middlewares/checkRole';

const router = Router();

router.get('/', authJWT, listarJefaturas);
router.post('/', authJWT, checkRole('ADMIN'), crearJefatura);
router.put('/:id', authJWT, checkRole('ADMIN'), editarJefatura);
router.delete('/:id', authJWT, checkRole('ADMIN'), eliminarJefatura);

export default router;