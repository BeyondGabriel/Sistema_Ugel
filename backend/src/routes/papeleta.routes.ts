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

const router = Router();

router.post(
  '/',
  authJWT,
  checkRole('ESPECIALISTA', 'JEFE', 'VIGILANTE', 'RRHH', 'ADMIN', 'DIRECTORA'),
  crearPapeleta,
);
// Rutas fijas antes de /:id para evitar ambigüedad
router.post('/verificar-token', authJWT, verificarToken);
router.get('/exportar', authJWT, exportarPapeletas);
router.get('/', authJWT, listarPapeletas);
router.get('/:id', authJWT, obtenerPapeleta);
router.get('/:id/pdf', authJWT, descargarPDF);
router.put('/:id/revisar', authJWT, iniciarRevision);
router.put('/:id/aprobar', authJWT, aprobarPapeleta);
router.put('/:id/rechazar', authJWT, rechazarPapeleta);
router.put('/:id/observar', authJWT, observarPapeleta);
router.put('/:id/cancelar', authJWT, cancelarPapeleta);
router.put('/:id/reenviar', authJWT, reenviarPapeleta);
router.put('/:id/anular', authJWT, anularPapeleta);
router.post('/:id/solicitar-anulacion', authJWT, solicitarAnulacion);
router.post('/:id/cancelar-solicitud-anulacion', authJWT, cancelarSolicitudAnulacion);

export default router;
