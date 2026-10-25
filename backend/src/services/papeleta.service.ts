// ===========================================================
// Servicio del módulo de papeletas: numeración, tokens,
// jerarquía de aprobación, bloqueos y timeout de revisión.
// ===========================================================

import { Rol, EstadoPapeleta, Prisma, Papeleta, Usuario } from '@prisma/client';
import prisma from '../utils/prisma';
import { generarToken, generarTokenUnico } from '../utils/tokenGenerator';
import { bloquearRangoPapeleta } from './bloqueos.service';
import { obtenerDelegacionVigente } from './delegacion.service';
import { notificar } from './notificacion.service';
import { emitirCambioPapeleta } from '../sockets/io';

/** Re-exportados para no romper a quienes ya importan estas funciones desde aquí. */
export { generarToken, generarTokenUnico };


/** Minutos que puede permanecer una papeleta EN_REVISION antes de expirar. */
export const MINUTOS_TIMEOUT_REVISION = 20;

/** Cliente de Prisma "normal" o el cliente de una transacción en curso. */
type ClientePrisma = typeof prisma | Prisma.TransactionClient;

/**
 * Calcula el siguiente número consecutivo anual de papeleta, con formato
 * "XXXX-YYYY". El consecutivo es global (no se reinicia por jefatura) y
 * se reinicia automáticamente cada año porque se busca solo entre los
 * números que terminan en "-{año}".
 *
 * Nota sobre concurrencia: esta función puede recibir el cliente de una
 * transacción de Prisma en curso (parámetro `cliente`). Llamarla dentro de
 * la misma transacción que crea la papeleta (ver crearPapeleta) reduce el
 * riesgo de que dos solicitudes simultáneas obtengan el mismo número,
 * aunque no lo elimina por completo a nivel de base de datos; para una
 * empresa de ~50 trabajadores este riesgo es aceptable en esta fase.
 */
export async function generarNumeroPapeleta(año: number, cliente: ClientePrisma = prisma): Promise<string> {
  const sufijo = `-${año}`;

  const papeletasDelAño = await cliente.papeleta.findMany({
    where: { numero: { endsWith: sufijo } },
    select: { numero: true },
  });

  let maxConsecutivo = 0;

  for (const { numero } of papeletasDelAño) {
    const [consecutivoStr] = numero.split('-');
    const consecutivo = Number(consecutivoStr);
    if (!Number.isNaN(consecutivo) && consecutivo > maxConsecutivo) {
      maxConsecutivo = consecutivo;
    }
  }

  const consecutivoFormateado = String(maxConsecutivo + 1).padStart(4, '0');
  return `${consecutivoFormateado}-${año}`;
}

/** Códigos de bloqueo posibles al resolver el aprobador de una papeleta. */
export const CODIGO_BLOQUEO_P1C = 'BLOQUEO_P1C';
export const CODIGO_BLOQUEO_SIN_APROBADOR = 'BLOQUEO_SIN_APROBADOR';

export type CodigoBloqueo =
  | typeof CODIGO_BLOQUEO_P1C
  | typeof CODIGO_BLOQUEO_SIN_APROBADOR;

/** Mensaje de negocio asociado a cada código de bloqueo. */
export const MENSAJES_BLOQUEO: Record<CodigoBloqueo, string> = {
  [CODIGO_BLOQUEO_P1C]:
    'El aprobador asignado se encuentra no disponible (P1C) y no cuenta con una delegación vigente. La papeleta quedó bloqueada para revisión del Administrador.',
  [CODIGO_BLOQUEO_SIN_APROBADOR]:
    'No se pudo determinar un aprobador para el rol del solicitante (jerarquía incompleta o aprobador inactivo). La papeleta quedó bloqueada para revisión del Administrador.',
};

/**
 * Resultado de resolver la cadena de aprobación de una papeleta.
 *
 * - AUTO_APROBACION: el solicitante es la Directora (regla previa del sistema:
 *   firma sus propias papeletas y no requiere aprobador).
 * - OK: hay aprobador. `esRespaldoRRHH` indica que se usó el respaldo de RRHH
 *   y `esReemplazo` que aprueba por una delegación vigente del titular.
 * - BLOQUEO_P1C / BLOQUEO_SIN_APROBADOR: no hay aprobador válido; la papeleta
 *   se crea marcada con `requiereAprobadorEspecial` para el Administrador.
 */
export type ResolucionAprobador =
  | { tipo: 'AUTO_APROBACION' }
  | {
      tipo: 'OK';
      aprobadorId: number;
      esRespaldoRRHH: boolean;
      esReemplazo: boolean;
    }
  | { tipo: 'BLOQUEO_P1C'; mensaje: string }
  | { tipo: 'BLOQUEO_SIN_APROBADOR'; mensaje: string };

/** Directora activa de la UGEL (máxima autoridad de la jerarquía). */
async function buscarDirectoraActiva(): Promise<{ id: number } | null> {
  return prisma.usuario.findFirst({
    where: { rol: Rol.DIRECTORA, activo: true },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
}

/** Primer usuario de RRHH activo y disponible: aprobador de respaldo. */
async function buscarRespaldoRRHH(): Promise<number | null> {
  const rrhh = await prisma.usuario.findFirst({
    where: { rol: Rol.RRHH, activo: true, noDisponible: false },
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  return rrhh?.id ?? null;
}

/**
 * Determina el aprobador NATURAL (titular de la aprobación) según el rol del
 * solicitante, antes de aplicar delegaciones:
 * - ESPECIALISTA / VIGILANTE: su jefe inmediato (`jefeId`).
 * - JEFE: la Directora activa.
 * - RRHH / ADMIN: su jefe inmediato; si no tiene, la Directora activa.
 * - DIRECTORA: null (firma sus propias papeletas, ver resolverAprobadorFinal).
 *
 * Devuelve null cuando la jerarquía no permite identificar a nadie.
 */
export async function determinarAprobador(solicitante: Usuario): Promise<number | null> {
  switch (solicitante.rol) {
    case Rol.ESPECIALISTA:
    case Rol.VIGILANTE:
      return solicitante.jefeId;

    case Rol.JEFE: {
      const directora = await buscarDirectoraActiva();
      return directora?.id ?? null;
    }

    case Rol.RRHH:
    case Rol.ADMIN: {
      if (solicitante.jefeId !== null) {
        return solicitante.jefeId;
      }

      const directora = await buscarDirectoraActiva();
      return directora?.id ?? null;
    }

    default:
      return null;
  }
}
/** Resultado de bloqueo con el mensaje de negocio asociado al código. */
function bloqueo(codigo: CodigoBloqueo): ResolucionAprobador {
  return { tipo: codigo, mensaje: MENSAJES_BLOQUEO[codigo] };
}

/**
 * Respaldo de RRHH: se usa cuando no existe (o no está disponible) el
 * aprobador natural del solicitante y este no es JEFE. Si tampoco hay RRHH
 * activo y disponible, la papeleta queda bloqueada sin aprobador.
 */
async function resolverRespaldoRRHH(): Promise<ResolucionAprobador> {
  const rrhhId = await buscarRespaldoRRHH();

  if (rrhhId === null) {
    return bloqueo(CODIGO_BLOQUEO_SIN_APROBADOR);
  }

  return {
    tipo: 'OK',
    aprobadorId: rrhhId,
    esRespaldoRRHH: true,
    esReemplazo: false,
  };
}

/**
 * Resuelve el aprobador FINAL de una papeleta aplicando, en orden:
 *
 * 1. Auto-aprobación de la Directora (regla previa del sistema).
 * 2. Aprobador natural según la jerarquía del rol del solicitante.
 * 3. Sin aprobador natural: JEFE → BLOQUEO_P1C; resto → respaldo de RRHH.
 * 4. Delegación vigente del aprobador natural → aprueba el encargado.
 * 5. Aprobador natural inactivo o no disponible: JEFE → BLOQUEO_P1C;
 *    resto → respaldo de RRHH.
 *
 * Nunca lanza por falta de aprobador: devuelve un resultado de bloqueo para
 * que el controlador cree la papeleta marcada como `requiereAprobadorEspecial`
 * y avise al Administrador.
 */
export async function resolverAprobadorFinal(
  solicitante: Usuario,
  fecha: Date = new Date(),
): Promise<ResolucionAprobador> {
  // Regla previa del sistema: la Directora firma sus propias papeletas.
  if (solicitante.rol === Rol.DIRECTORA) {
    return { tipo: 'AUTO_APROBACION' };
  }

  const aprobadorNaturalId = await determinarAprobador(solicitante);

  if (aprobadorNaturalId === null || aprobadorNaturalId === solicitante.id) {
    if (solicitante.rol === Rol.JEFE) {
      return bloqueo(CODIGO_BLOQUEO_P1C);
    }

    return resolverRespaldoRRHH();
  }

  // Delegación vigente: el encargado reemplaza al titular.
  const delegacion = await obtenerDelegacionVigente(aprobadorNaturalId, fecha);

  if (delegacion) {
    return {
      tipo: 'OK',
      aprobadorId: delegacion.encargadoId,
      esRespaldoRRHH: false,
      esReemplazo: true,
    };
  }

  const titular = await prisma.usuario.findUnique({
    where: { id: aprobadorNaturalId },
    select: { id: true, activo: true, noDisponible: true },
  });

  if (!titular || !titular.activo || titular.noDisponible) {
    if (solicitante.rol === Rol.JEFE) {
      return bloqueo(CODIGO_BLOQUEO_P1C);
    }

    return resolverRespaldoRRHH();
  }

  return {
    tipo: 'OK',
    aprobadorId: titular.id,
    esRespaldoRRHH: false,
    esReemplazo: false,
  };
}
/**
 * Comprueba si `usuarioId` es el aprobador VIGENTE del solicitante según la
 * jerarquía y las delegaciones actuales. Incluye el caso de auto-aprobación
 * (la Directora actuando sobre su propia papeleta) y el respaldo de RRHH,
 * que puede ser ejercido por cualquier usuario de RRHH activo.
 *
 * `papeletaContext` habilita la excepción del desbloqueo administrativo: si el
 * Administrador reasignó el aprobador (`reasignadoPorId` no nulo), el usuario
 * asignado queda habilitado aunque no sea el aprobador natural de la
 * jerarquía, siempre que siga activo.
 */
export async function esAprobadorVigente(
  solicitanteId: number,
  usuarioId: number,
  papeletaContext?: { aprobadorId: number | null; reasignadoPorId: number | null },
): Promise<boolean> {
  // Desbloqueo administrativo: el aprobador asignado manualmente por el ADMIN
  // queda habilitado aunque no coincida con la jerarquía natural.
  if (
    papeletaContext &&
    papeletaContext.reasignadoPorId !== null &&
    papeletaContext.aprobadorId === usuarioId
  ) {
    const u = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { activo: true },
    });
    if (u?.activo) return true;
  }

  const solicitante = await prisma.usuario.findUnique({
    where: { id: solicitanteId },
  });

  if (!solicitante) {
    return false;
  }

  const resultado = await resolverAprobadorFinal(solicitante);

  if (resultado.tipo === 'AUTO_APROBACION') {
    return usuarioId === solicitanteId;
  }

  if (resultado.tipo !== 'OK') {
    return false;
  }

  if (resultado.aprobadorId === usuarioId) {
    return true;
  }

  if (!resultado.esRespaldoRRHH) {
    return false;
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { rol: true, activo: true },
  });

  return usuario?.rol === Rol.RRHH && usuario.activo;
}

/**
 * Placeholder de aplicación de bloqueos de asistencia al aprobar una
 * papeleta. El bloqueo real ya es efectivo en cuanto la papeleta queda
 * APROBADA (ver services/bloqueos.service.ts → verificarBloqueo, que
 * consulta directamente las papeletas aprobadas), así que aquí solo se
 * deja constancia explícita de este paso dentro del flujo de aprobación.
 */
export async function aplicarBloqueos(papeletaId: number): Promise<void> {
  await bloquearRangoPapeleta(papeletaId);
  console.log(`Bloqueos aplicados para papeleta ${papeletaId}`);
}

/** true si una papeleta EN_REVISION ya superó los 20 minutos desde fechaRevision. */
export function haExpiradoRevision(papeleta: {
  estado: EstadoPapeleta;
  fechaRevision: Date | null;
}): boolean {
  if (papeleta.estado !== EstadoPapeleta.EN_REVISION || !papeleta.fechaRevision) {
    return false;
  }
  const minutosTranscurridos = (Date.now() - papeleta.fechaRevision.getTime()) / (1000 * 60);
  return minutosTranscurridos > MINUTOS_TIMEOUT_REVISION;
}

/**
 * Destinatarios de un evento de cambio de estado de papeleta: el solicitante
 * y, si existe, el aprobador asignado. Se descartan los nulos para que el
 * helper de Socket.IO reciba solo ids reales.
 */
export function destinatariosCambioPapeleta(papeleta: {
  solicitanteId: number;
  aprobadorId: number | null;
}): number[] {
  return [papeleta.solicitanteId, papeleta.aprobadorId].filter(
    (id): id is number => id !== null
  );
}

/**
 * Si la papeleta dada tiene su revisión expirada, la revierte a PENDIENTE
 * de inmediato (limpiando fechaRevision) y notifica al solicitante.
 * Devuelve la papeleta actualizada (o la misma, sin cambios, si no había
 * expirado). Es genérica para poder usarse tanto con una Papeleta simple
 * como con una que incluya relaciones (solicitante, aprobador, etc.).
 */
export async function revertirSiExpiro<T extends Papeleta>(papeleta: T): Promise<T> {
  if (!haExpiradoRevision(papeleta)) {
    return papeleta;
  }

  const papeletaActualizada = await prisma.papeleta.update({
    where: { id: papeleta.id },
    data: { estado: EstadoPapeleta.PENDIENTE, fechaRevision: null },
  });

  // Aviso en vivo: la papeleta vuelve a la cola de revisión.
  emitirCambioPapeleta(
    destinatariosCambioPapeleta(papeletaActualizada),
    papeletaActualizada.id,
    papeletaActualizada.estado
  );

  notificar(
    papeleta.solicitanteId,
    `Su papeleta ${papeleta.numero} volvió a estado PENDIENTE porque el tiempo de revisión expiró.`,
  );

  // También se notifica al aprobador para que sepa que la papeleta volvió a cola
  if (papeleta.aprobadorId) {
    notificar(
      papeleta.aprobadorId,
      `La revisión de la papeleta ${papeleta.numero} expiró y volvió a estado PENDIENTE.`,
    );
  }

  return {
    ...papeleta,
    estado: papeletaActualizada.estado,
    fechaRevision: papeletaActualizada.fechaRevision,
  } as T;
}

/**
 * Job periódico: busca todas las papeletas EN_REVISION cuya fechaRevision
 * superó los 20 minutos y las revierte a PENDIENTE. Pensado para llamarse
 * cada 60 segundos desde un setInterval en server.ts.
 */
export async function revertirRevisionesExpiradas(): Promise<void> {
  const limite = new Date(Date.now() - MINUTOS_TIMEOUT_REVISION * 60 * 1000);

  const papeletasExpiradas = await prisma.papeleta.findMany({
    where: {
      estado: EstadoPapeleta.EN_REVISION,
      fechaRevision: { lte: limite },
    },
  });

  for (const papeleta of papeletasExpiradas) {
    await revertirSiExpiro(papeleta);
  }
}
