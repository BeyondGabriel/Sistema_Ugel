// ===========================================================
// Lista predefinida de motivos para solicitar una papeleta
// ===========================================================

export const MOTIVOS_PAPELETA = [
  'Descanso médico',
  'Atención médica',
  'Asunto particular',
  'Comisión de servicio',
  'Docencia',
  'Onomástico',
  'Vacaciones',
  'Omisión de marcado entrada/salida',
  'Autorización de ingreso fuera de tolerancia',
  'Compensación de horas trabajadas',
  'Otros',
] as const;

export type MotivoPapeleta = (typeof MOTIVOS_PAPELETA)[number];

/** Valor exacto que activa el campo libre motivoOtros. */
export const MOTIVO_OTROS: MotivoPapeleta = 'Otros';

/** Type guard: verifica que un string sea uno de los motivos predefinidos. */
export function esMotivoValido(motivo: string): motivo is MotivoPapeleta {
  return (MOTIVOS_PAPELETA as readonly string[]).includes(motivo);
}
