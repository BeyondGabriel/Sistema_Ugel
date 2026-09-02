// ===========================================================
// Generador de contraseñas aleatorias seguras
// ===========================================================

import crypto from 'crypto';

/**
 * Genera una contraseña aleatoria segura.
 * Garantiza al menos una mayúscula, una minúscula, un número y un símbolo.
 *
 * @param longitud Cantidad total de caracteres de la contraseña (por defecto 16)
 */
export function generarPasswordSegura(longitud = 16): string {
  const MAYUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I/O para evitar confusión visual
  const MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz';
  const NUMEROS = '23456789';
  const SIMBOLOS = '!@#$%^&*()_+-=[]{}';
  const TODOS = MAYUSCULAS + MINUSCULAS + NUMEROS + SIMBOLOS;

  // Aseguramos al menos un carácter de cada conjunto
  const caracteresObligatorios = [
    MAYUSCULAS[crypto.randomInt(0, MAYUSCULAS.length)],
    MINUSCULAS[crypto.randomInt(0, MINUSCULAS.length)],
    NUMEROS[crypto.randomInt(0, NUMEROS.length)],
    SIMBOLOS[crypto.randomInt(0, SIMBOLOS.length)],
  ];

  const restantes: string[] = [];
  for (let i = caracteresObligatorios.length; i < longitud; i++) {
    restantes.push(TODOS[crypto.randomInt(0, TODOS.length)]);
  }

  const caracteres = [...caracteresObligatorios, ...restantes];

  // Mezcla tipo Fisher-Yates para no dejar siempre el mismo patrón al inicio
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }

  return caracteres.join('');
}
