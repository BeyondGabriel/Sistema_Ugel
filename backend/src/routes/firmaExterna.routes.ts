// ===========================================================
// Rutas de firma externa
// ===========================================================

import { Router } from 'express';

import { webhookFirma } from '../controllers/firmaExterna.controller';

import { rateLimitWebhookFirma } from '../middlewares/rateLimit';
import { validate } from '../middlewares/validate';
import { webhookFirmaSchema } from '../schemas/firmaExterna.schema';

const router = Router();

router.post(
  '/webhook',
  rateLimitWebhookFirma,
  validate(webhookFirmaSchema, 'body'),
  webhookFirma,
);

export default router;