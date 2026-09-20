// ===========================================================
// Rate limiting para endpoints sensibles
// ===========================================================

import rateLimit from 'express-rate-limit';

/**
 * Limita los intentos de autenticación.
 *
 * 5 intentos por cada 15 minutos desde una misma IP.
 *
 * Cuando se alcanza el límite:
 * - responde HTTP 429;
 * - no llega al controlador de login.
 */
export const rateLimitLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    mensaje:
      'Demasiados intentos de inicio de sesión. Intente nuevamente más tarde.',
  },
});

/**
 * Limita las consultas de tokens de verificación de papeletas.
 *
 * 10 solicitudes por cada 10 minutos desde una misma IP.
 *
 * Esta ruta ya requiere JWT mediante authJWT.
 * Este middleware añade una segunda capa de protección
 * contra intentos repetitivos de adivinación de tokens.
 */
export const rateLimitVerificarToken = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    mensaje:
      'Demasiados intentos de verificación. Intente nuevamente más tarde.',
  },
});