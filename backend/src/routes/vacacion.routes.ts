// ===========================================================
// Rutas del módulo de vacaciones
//
// Flujo de aprobación:
//   GET    /api/vacaciones                  → listado según rol (propios/subordinados/todos)
//   POST   /api/vacaciones                  → solicitud del usuario (PENDIENTE)
//   PUT    /api/vacaciones/:id/vb           → VoBo del Jefe/Directora
//   PUT    /api/vacaciones/:id/aprobar      → aprobación final de RRHH/Admin
//   PUT    /api/vacaciones/:id/rechazar     → rechazo motivado
//   POST   /api/vacaciones/saldos           → carga manual de saldos
// ===========================================================

import { Router } from 'express';

import {
  obtenerMiSaldo,
  listarSolicitudes,
  crearSolicitud,
  darVistoBueno,
  aprobarSolicitud,
  rechazarSolicitud,
  crearSaldoManual,
  descargarPDF,
} from '../controllers/vacacion.controller';

import { exportarVacaciones } from '../controllers/reportes.controller';

import { authJWT } from '../middlewares/authJWT';
import { checkRole } from '../middlewares/checkRole';
import { validate } from '../middlewares/validate';

import {
  crearSolicitudVacacionSchema,
  listarSolicitudesQuerySchema,
  rechazarSolicitudVacacionSchema,
  crearSaldoVacacionSchema,
  solicitudVacacionIdParamsSchema,
} from '../schemas/vacacion.schema';

const router = Router();

router.get('/mi-saldo', authJWT, obtenerMiSaldo);

router.get(
  '/',
  authJWT,
  validate(listarSolicitudesQuerySchema, 'query'),
  listarSolicitudes,
);

router.post(
  '/',
  authJWT,
  validate(crearSolicitudVacacionSchema, 'body'),
  crearSolicitud,
);

// Rutas fijas antes de las rutas con /:id
router.post(
  '/saldos',
  authJWT,
  checkRole('ADMIN', 'RRHH'),
  validate(crearSaldoVacacionSchema, 'body'),
  crearSaldoManual,
);

// Exportación a Excel: debe registrarse ANTES de /:id/... para que
// "exportar" no sea interpretado como un id por las rutas con parámetros.
router.get('/exportar', authJWT, checkRole('RRHH', 'ADMIN'), exportarVacaciones);

router.get(
  '/:id/pdf',
  authJWT,
  validate(solicitudVacacionIdParamsSchema, 'params'),
  descargarPDF,
);

router.put(
  '/:id/vb',
  authJWT,
  checkRole('JEFE', 'DIRECTORA'),
  validate(solicitudVacacionIdParamsSchema, 'params'),
  darVistoBueno,
);

router.put(
  '/:id/aprobar',
  authJWT,
  checkRole('RRHH', 'ADMIN'),
  validate(solicitudVacacionIdParamsSchema, 'params'),
  aprobarSolicitud,
);

router.put(
  '/:id/rechazar',
  authJWT,
  checkRole('JEFE', 'DIRECTORA', 'RRHH', 'ADMIN'),
  validate(solicitudVacacionIdParamsSchema, 'params'),
  validate(rechazarSolicitudVacacionSchema, 'body'),
  rechazarSolicitud,
);

export default router;
