// ===========================================================
// Rutas de autenticación
// ===========================================================

import { Router } from 'express';
import { login, cambiarPassword, miPerfil } from '../controllers/auth.controller';
import { authJWT } from '../middlewares/authJWT';

const router = Router();

router.post('/login', login);
router.post('/cambiar-password', authJWT, cambiarPassword);
router.get('/mi-perfil', authJWT, miPerfil);

export default router;
