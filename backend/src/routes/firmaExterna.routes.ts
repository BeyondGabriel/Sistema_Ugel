// ===========================================================
// Rutas de firma externa
// ===========================================================

import { Router } from 'express';
import { webhookFirma } from '../controllers/firmaExterna.controller';

const router = Router();

router.post('/webhook', webhookFirma);

export default router;
