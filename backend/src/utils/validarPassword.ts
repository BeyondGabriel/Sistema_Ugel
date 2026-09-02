// ===========================================================
// Validación de política de contraseñas
// ===========================================================

/**
 * Valida que una contraseña cumpla la política mínima de seguridad:
 * al menos 8 caracteres, un número y un símbolo.
 */
export function validarPassword(password: string): boolean {
  if (typeof password !== 'string') {
    return false;
  }

  const tieneLongitudMinima = password.length >= 8;
  const tieneNumero = /[0-9]/.test(password);
  const tieneSimbolo = /[^A-Za-z0-9]/.test(password);

  return tieneLongitudMinima && tieneNumero && tieneSimbolo;
}
