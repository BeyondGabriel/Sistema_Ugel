// ===========================================================
// Rutas de firma externa
// ===========================================================

import { Router } from 'express';

import { webhookFirma } from '../controllers/firmaExterna.controller';

import { validate } from '../middlewares/validate';
import { webhookFirmaSchema } from '../schemas/firmaExterna.schema';

const router = Router();

router.post(
  '/webhook',
  validate(webhookFirmaSchema, 'body'),
  webhookFirma,
);

export default router;