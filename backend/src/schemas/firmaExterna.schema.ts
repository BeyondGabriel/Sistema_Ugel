// ===========================================================
// Esquemas de validación de firma externa
// ===========================================================

import { z } from 'zod';

const idSchema = z
  .coerce
  .number({ error: 'El ID debe ser numérico' })
  .int('El ID debe ser un número entero')
  .positive('El ID debe ser mayor que 0');

/**
 * Devuelve el host de almacenamiento permitido a partir de SUPABASE_URL.
 *
 * Se lee en tiempo de ejecución (no al importar el módulo) para asegurar
 * que dotenv ya haya cargado las variables de entorno. Si la variable no
 * está configurada o no es una URL válida, devuelve null y la restricción
 * de host no se aplica.
 */
function obtenerHostAlmacenamiento(): string | null {
  const supabaseUrl = process.env.SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  try {
    return new URL(supabaseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Valida el CONTENIDO de svgUrl (Punto 4):
 * - El protocolo debe ser estrictamente `https` (se rechazan esquemas
 *   inseguros como `javascript:`, `data:` o `file:`).
 * - Si hay un dominio de almacenamiento configurado (SUPABASE_URL), el
 *   host de la URL debe coincidir con él o ser un subdominio suyo.
 */
function validarContenidoSvgUrl(valor: string): boolean {
  let url: URL;

  try {
    url = new URL(valor);
  } catch {
    return false;
  }

  // 1. Solo se admite https.
  if (url.protocol !== 'https:') {
    return false;
  }

  // 2. Restringir el host al dominio de almacenamiento, si está configurado.
  const hostAlmacenamiento = obtenerHostAlmacenamiento();

  if (hostAlmacenamiento) {
    const host = url.hostname.toLowerCase();
    const esHostPermitido =
      host === hostAlmacenamiento || host.endsWith(`.${hostAlmacenamiento}`);

    if (!esHostPermitido) {
      return false;
    }
  }

  return true;
}

export const webhookFirmaSchema = z
  .object({
    papeletaId: idSchema,

    svgUrl: z
      .string({ error: 'svgUrl debe ser un texto' })
      .trim()
      .min(1, 'svgUrl es obligatorio')
      .url('svgUrl debe ser una URL válida')
      .max(2048, 'svgUrl no puede superar los 2048 caracteres')
      .refine(
        validarContenidoSvgUrl,
        'svgUrl debe ser una URL https del dominio de almacenamiento permitido',
      ),
  })
  .strict();