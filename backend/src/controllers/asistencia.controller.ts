// ===========================================================
// Controlador del módulo de asistencias
// ===========================================================

import { Request, Response } from 'express';
import { TipoMovimiento, Rol, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { verificarBloqueo } from '../services/bloqueos.service';
import { obtenerRangoDelDia } from '../utils/fechas';

/** Roles que, en este módulo, solo pueden consultar sus propios movimientos. */
const ROLES_SOLO_PROPIOS: Rol[] = [Rol.ESPECIALISTA, Rol.JEFE, Rol.DIRECTORA];

/**
 * Cuenta los ciclos ENTRADA→SALIDA completos que ya tiene un usuario en el
 * día calendario de `fecha`. Un ciclo se completa cuando, en orden
 * cronológico, aparece una ENTRADA seguida de una SALIDA.
 *
 * @param idExcluir id de un movimiento a excluir del conteo (usado al editar,
 * para no contar el propio movimiento que se está modificando).
 */
async function contarCiclosCompletosDelDia(
  usuarioId: number,
  fecha: Date,
  idExcluir?: number,
): Promise<number> {
  const { inicio, fin } = obtenerRangoDelDia(fecha);

  const movimientosDelDia = await prisma.movimiento.findMany({
    where: {
      usuarioId,
      timestamp: { gte: inicio, lte: fin },
      ...(idExcluir !== undefined ? { id: { not: idExcluir } } : {}),
    },
    orderBy: { timestamp: 'asc' },
  });

  let ciclosCompletos = 0;
  let entradaAbierta = false;

  for (const movimiento of movimientosDelDia) {
    if (movimiento.tipo === TipoMovimiento.ENTRADA) {
      entradaAbierta = true;
    } else if (movimiento.tipo === TipoMovimiento.SALIDA && entradaAbierta) {
      ciclosCompletos += 1;
      entradaAbierta = false;
    }
  }

  return ciclosCompletos;
}

/**
 * Notifica (vía Socket.IO) que cambió el estado de presencia de un usuario.
 *
 * Placeholder intencional: la instancia de Socket.IO se crea en server.ts,
 * y server.ts a su vez importa app.ts (que monta estas rutas/controllers).
 * Importar esa instancia directamente aquí generaría una dependencia
 * circular. La conexión real (io.emit('presencia:cambio', ...)) se
 * completará en la fase de sockets, probablemente mediante un pequeño
 * registro/inyección de la instancia de `io` en src/sockets/.
 */
function emitirCambioPresencia(usuarioId: number): void {
  // TODO (fase de sockets): emitir evento 'presencia:cambio' con { usuarioId }
}

/**
 * POST /api/asistencias
 * Roles: VIGILANTE, ADMIN.
 * Registra un nuevo movimiento (ENTRADA o SALIDA) de un trabajador.
 */
export async function registrarMovimiento(req: Request, res: Response): Promise<void> {
  try {
    const { usuarioId, tipo, timestamp } = req.body as {
      usuarioId?: number;
      tipo?: TipoMovimiento;
      timestamp?: string;
    };

    if (!usuarioId || !tipo || !timestamp) {
      res.status(400).json({ mensaje: 'usuarioId, tipo y timestamp son obligatorios' });
      return;
    }

    if (tipo !== TipoMovimiento.ENTRADA && tipo !== TipoMovimiento.SALIDA) {
      res.status(400).json({ mensaje: 'tipo debe ser ENTRADA o SALIDA' });
      return;
    }

    const fechaMovimiento = new Date(timestamp);
    if (Number.isNaN(fechaMovimiento.getTime())) {
      res.status(400).json({ mensaje: 'timestamp no es una fecha válida' });
      return;
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });

    if (!usuario) {
      res.status(404).json({ mensaje: 'Usuario no encontrado' });
      return;
    }

    if (!usuario.activo) {
      res.status(400).json({ mensaje: 'No se pueden registrar movimientos de un usuario desactivado' });
      return;
    }

    // Bloqueo por papeleta aprobada (día completo o rango de horas)
    const estaBloqueado = await verificarBloqueo(usuarioId, fechaMovimiento);
    if (estaBloqueado) {
      res.status(409).json({ mensaje: 'El registro está bloqueado por una papeleta activa' });
      return;
    }

    // Límite de 4 ciclos completos de entrada/salida por día.
    // Solo se valida al registrar una ENTRADA (una SALIDA nunca abre un ciclo nuevo).
    if (tipo === TipoMovimiento.ENTRADA) {
      const ciclosCompletos = await contarCiclosCompletosDelDia(usuarioId, fechaMovimiento);
      if (ciclosCompletos >= 4) {
        res.status(409).json({
          mensaje: 'Se alcanzó el límite de 4 ciclos de entrada/salida para este día',
        });
        return;
      }
    }

    // Nota: si tipo es SALIDA y no existe una ENTRADA previa sin SALIDA ese
    // día, se permite igualmente (el trabajador pudo haber olvidado marcar
    // su entrada); no se bloquea por esta razón.

    const nuevoMovimiento = await prisma.movimiento.create({
      data: {
        usuarioId,
        tipo,
        timestamp: fechaMovimiento,
      },
    });

    emitirCambioPresencia(usuarioId);

    res.status(201).json({ movimiento: nuevoMovimiento });
  } catch (error) {
    console.error('Error en registrarMovimiento:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * PUT /api/asistencias/:id
 * Roles: VIGILANTE, ADMIN.
 * Edita la hora y/o el tipo de un movimiento existente.
 * El VIGILANTE solo puede editar movimientos de hasta 7 días de antigüedad;
 * el ADMIN no tiene esa restricción.
 */
export async function editarMovimiento(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      res.status(400).json({ mensaje: 'El id proporcionado no es válido' });
      return;
    }

    const usuarioToken = req.usuario;
    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const { nuevoTimestamp, nuevoTipo } = req.body as {
      nuevoTimestamp?: string;
      nuevoTipo?: TipoMovimiento;
    };

    if (nuevoTimestamp === undefined && nuevoTipo === undefined) {
      res.status(400).json({ mensaje: 'Debe enviar nuevoTimestamp o nuevoTipo para editar el movimiento' });
      return;
    }

    const movimiento = await prisma.movimiento.findUnique({ where: { id } });

    if (!movimiento) {
      res.status(404).json({ mensaje: 'Movimiento no encontrado' });
      return;
    }

    // Regla de los 7 días: solo aplica a VIGILANTE. ADMIN no tiene límite.
    if (usuarioToken.rol === Rol.VIGILANTE) {
      const diasTranscurridos = (Date.now() - movimiento.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      if (diasTranscurridos > 7) {
        res.status(403).json({
          mensaje: 'El movimiento ya no puede editarse: pasaron más de 7 días desde su registro',
        });
        return;
      }
    }

    let nuevaFecha = movimiento.timestamp;
    if (nuevoTimestamp !== undefined) {
      nuevaFecha = new Date(nuevoTimestamp);
      if (Number.isNaN(nuevaFecha.getTime())) {
        res.status(400).json({ mensaje: 'nuevoTimestamp no es una fecha válida' });
        return;
      }
    }

    let nuevoTipoFinal = movimiento.tipo;
    if (nuevoTipo !== undefined) {
      if (nuevoTipo !== TipoMovimiento.ENTRADA && nuevoTipo !== TipoMovimiento.SALIDA) {
        res.status(400).json({ mensaje: 'nuevoTipo debe ser ENTRADA o SALIDA' });
        return;
      }
      nuevoTipoFinal = nuevoTipo;
    }

    // Verifica que el nuevo timestamp no caiga en un rango bloqueado por papeleta
    const estaBloqueado = await verificarBloqueo(movimiento.usuarioId, nuevaFecha);
    if (estaBloqueado) {
      res.status(409).json({ mensaje: 'El registro está bloqueado por una papeleta activa' });
      return;
    }

    // Verifica que la edición no haga que el día exceda los 4 ciclos completos
    // (excluyendo el propio movimiento que se está editando del conteo).
    if (nuevoTipoFinal === TipoMovimiento.ENTRADA) {
      const ciclosCompletos = await contarCiclosCompletosDelDia(movimiento.usuarioId, nuevaFecha, id);
      if (ciclosCompletos >= 4) {
        res.status(409).json({
          mensaje: 'Se alcanzó el límite de 4 ciclos de entrada/salida para este día',
        });
        return;
      }
    }

    const movimientoActualizado = await prisma.movimiento.update({
      where: { id },
      data: {
        timestamp: nuevaFecha,
        tipo: nuevoTipoFinal,
      },
    });

    res.status(200).json({ movimiento: movimientoActualizado });
  } catch (error) {
    console.error('Error en editarMovimiento:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * GET /api/asistencias
 * Todos los roles autenticados, pero con alcance distinto:
 * - ESPECIALISTA, JEFE, DIRECTORA: solo sus propios movimientos.
 * - VIGILANTE, RRHH, ADMIN: pueden consultar todos, con filtros opcionales.
 */
export async function listarMovimientos(req: Request, res: Response): Promise<void> {
  try {
    const usuarioToken = req.usuario;
    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const { usuarioId, fechaInicio, fechaFin, jefaturaId } = req.query as {
      usuarioId?: string;
      fechaInicio?: string;
      fechaFin?: string;
      jefaturaId?: string;
    };

    const where: Prisma.MovimientoWhereInput = {};

    if (ROLES_SOLO_PROPIOS.includes(usuarioToken.rol)) {
      // Estos roles solo pueden ver sus propios movimientos,
      // sin importar lo que se haya enviado en usuarioId.
      where.usuarioId = usuarioToken.id;
    } else if (usuarioId !== undefined) {
      const usuarioIdNum = Number(usuarioId);
      if (Number.isNaN(usuarioIdNum)) {
        res.status(400).json({ mensaje: 'usuarioId debe ser numérico' });
        return;
      }
      where.usuarioId = usuarioIdNum;
    }

    if (fechaInicio !== undefined || fechaFin !== undefined) {
      const filtroFecha: Prisma.DateTimeFilter = {};

      if (fechaInicio !== undefined) {
        const fecha = new Date(fechaInicio);
        if (Number.isNaN(fecha.getTime())) {
          res.status(400).json({ mensaje: 'fechaInicio no es una fecha válida' });
          return;
        }
        filtroFecha.gte = fecha;
      }

      if (fechaFin !== undefined) {
        const fecha = new Date(fechaFin);
        if (Number.isNaN(fecha.getTime())) {
          res.status(400).json({ mensaje: 'fechaFin no es una fecha válida' });
          return;
        }
        filtroFecha.lte = fecha;
      }

      where.timestamp = filtroFecha;
    }

    // jefaturaId filtra por la jefatura del usuario dueño del movimiento.
    // Solo tiene sentido para quienes pueden ver más de sus propios datos.
    if (jefaturaId !== undefined && !ROLES_SOLO_PROPIOS.includes(usuarioToken.rol)) {
      const jefaturaIdNum = Number(jefaturaId);
      if (Number.isNaN(jefaturaIdNum)) {
        res.status(400).json({ mensaje: 'jefaturaId debe ser numérico' });
        return;
      }
      where.usuario = { jefaturaId: jefaturaIdNum };
    }

    const movimientos = await prisma.movimiento.findMany({
      where,
      include: {
        usuario: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            jefatura: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Campo calculado "jefatura" a nivel raíz de cada movimiento, para
    // facilitar la agrupación visual por jefatura en el frontend.
    const movimientosConJefatura = movimientos.map((movimiento) => ({
      ...movimiento,
      jefatura: movimiento.usuario.jefatura,
    }));

    res.status(200).json({ movimientos: movimientosConJefatura });
  } catch (error) {
    console.error('Error en listarMovimientos:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * GET /api/asistencias/presencia
 * Roles: VIGILANTE, ADMIN, RRHH.
 * Devuelve, para cada usuario activo (opcionalmente filtrado por
 * jefaturaId), su estado actual: PRESENTE si su último movimiento de
 * hoy es ENTRADA; AUSENTE en cualquier otro caso (incluido "sin
 * movimientos hoy").
 */
export async function obtenerPresencia(req: Request, res: Response): Promise<void> {
  try {
    const { jefaturaId } = req.query as { jefaturaId?: string };

    const whereUsuario: Prisma.UsuarioWhereInput = { activo: true };

    if (jefaturaId !== undefined) {
      const jefaturaIdNum = Number(jefaturaId);
      if (Number.isNaN(jefaturaIdNum)) {
        res.status(400).json({ mensaje: 'jefaturaId debe ser numérico' });
        return;
      }
      whereUsuario.jefaturaId = jefaturaIdNum;
    }

    const usuarios = await prisma.usuario.findMany({
      where: whereUsuario,
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        jefatura: { select: { id: true, nombre: true } },
      },
      orderBy: { apellidos: 'asc' },
    });

    const { inicio, fin } = obtenerRangoDelDia(new Date());

    // Para cada usuario se busca su último movimiento de hoy.
    // Con ~50 trabajadores, N+1 consultas es aceptable en esta fase;
    // se puede optimizar más adelante si el volumen de usuarios crece.
    const presencia = await Promise.all(
      usuarios.map(async (usuario) => {
        const ultimoMovimiento = await prisma.movimiento.findFirst({
          where: {
            usuarioId: usuario.id,
            timestamp: { gte: inicio, lte: fin },
          },
          orderBy: { timestamp: 'desc' },
        });

        const estado = ultimoMovimiento?.tipo === TipoMovimiento.ENTRADA ? 'PRESENTE' : 'AUSENTE';

        return {
          usuarioId: usuario.id,
          nombres: usuario.nombres,
          apellidos: usuario.apellidos,
          jefatura: usuario.jefatura,
          estado,
          ultimoMovimiento: ultimoMovimiento?.timestamp ?? null,
        };
      }),
    );

    res.status(200).json({ presencia });
  } catch (error) {
    console.error('Error en obtenerPresencia:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}
