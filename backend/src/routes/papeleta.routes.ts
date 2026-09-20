// ===========================================================
// Rutas del módulo de papeletas
// ===========================================================

import { Router } from 'express';

import {
  crearPapeleta,
  listarPapeletas,
  obtenerPapeleta,
  iniciarRevision,
  aprobarPapeleta,
  rechazarPapeleta,
  observarPapeleta,
  cancelarPapeleta,
  reenviarPapeleta,
} from '../controllers/papeleta.controller';

import {
  anularPapeleta,
  solicitarAnulacion,
  cancelarSolicitudAnulacion,
  verificarToken,
} from '../controllers/anulacion.controller';

import { exportarPapeletas } from '../controllers/reportes.controller';
import { descargarPDF } from '../controllers/pdf.controller';

import { authJWT } from '../middlewares/authJWT';
import { checkRole } from '../middlewares/checkRole';
import { rateLimitVerificarToken } from '../middlewares/rateLimit';
import { validate } from '../middlewares/validate';

import {
  papeletaSchema,
  rechazarPapeletaSchema,
  observarPapeletaSchema,
  anularPapeletaSchema,
  verificarTokenSchema,
  papeletaIdParamsSchema,
  listarPapeletasQuerySchema,
} from '../schemas/papeleta.schema';

const router = Router();

router.post(
  '/',
  authJWT,
  checkRole(
    'ESPECIALISTA',
    'JEFE',
    'VIGILANTE',
    'RRHH',
    'ADMIN',
    'DIRECTORA',
  ),
  validate(papeletaSchema, 'body'),
  crearPapeleta,
);

// Rutas fijas antes de /:id para evitar ambigüedad
router.post(
  '/verificar-token',
  rateLimitVerificarToken,
  authJWT,
  validate(verificarTokenSchema, 'body'),
  verificarToken,
);

router.get(
  '/exportar',
  authJWT,
  exportarPapeletas,
);

router.get(
  '/',
  authJWT,
  validate(listarPapeletasQuerySchema, 'query'),
  listarPapeletas,
);

router.get(
  '/:id',
  authJWT,
  validate(papeletaIdParamsSchema, 'params'),
  obtenerPapeleta,
);

router.get(
  '/:id/pdf',
  authJWT,
  validate(papeletaIdParamsSchema, 'params'),
  descargarPDF,
);

router.put(
  '/:id/revisar',
  authJWT,
  validate(papeletaIdParamsSchema, 'params'),
  iniciarRevision,
);

router.put(
  '/:id/aprobar',
  authJWT,
  validate(papeletaIdParamsSchema, 'params'),
  aprobarPapeleta,
);

router.put(
  '/:id/rechazar',
  authJWT,
  validate(papeletaIdParamsSchema, 'params'),
  validate(rechazarPapeletaSchema, 'body'),
  rechazarPapeleta,
);

router.put(
  '/:id/observar',
  authJWT,
  validate(papeletaIdParamsSchema, 'params'),
  validate(observarPapeletaSchema, 'body'),
  observarPapeleta,
);

router.put(
  '/:id/cancelar',
  authJWT,
  validate(papeletaIdParamsSchema, 'params'),
  cancelarPapeleta,
);

router.put(
  '/:id/reenviar',
  authJWT,
  validate(papeletaIdParamsSchema, 'params'),
  validate(papeletaSchema, 'body'),
  reenviarPapeleta,
);

router.put(
  '/:id/anular',
  authJWT,
  validate(papeletaIdParamsSchema, 'params'),
  validate(anularPapeletaSchema, 'body'),
  anularPapeleta,
);

router.post(
  '/:id/solicitar-anulacion',
  authJWT,
  validate(papeletaIdParamsSchema, 'params'),
  solicitarAnulacion,
);

router.post(
  '/:id/cancelar-solicitud-anulacion',
  authJWT,
  validate(papeletaIdParamsSchema, 'params'),
  cancelarSolicitudAnulacion,
);

export default router;