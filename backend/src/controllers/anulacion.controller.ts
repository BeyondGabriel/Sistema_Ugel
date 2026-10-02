// ===========================================================
// Controlador de anulación de papeletas y verificación de token
// ===========================================================

import { Request, Response } from 'express';
import { EstadoPapeleta, Rol } from '@prisma/client';
import prisma from '../utils/prisma';
import { puedeAnular } from '../services/anulacion.service';
import { liberarBloqueoPapeleta } from '../services/bloqueos.service';
import { notificar } from '../services/notificacion.service';
import { esAprobadorVigente } from '../services/papeleta.service';
import { usuarioPuedeVerPapeleta } from '../services/visibilidadPapeletas.service';

/**
 * Roles que, por su función operativa (control de puerta), necesitan poder
 * verificar el token de la papeleta de cualquier trabajador. El resto de
 * roles queda limitado por el servicio de visibilidad organizacional.
 */
const ROLES_VERIFICADORES_TOKEN: Rol[] = [Rol.VIGILANTE, Rol.RRHH, Rol.ADMIN];

/**
 * PUT /api/papeletas/:id/anular
 * Solo el aprobador VIGENTE de la papeleta o un Admin. La papeleta debe estar
 * APROBADO o ANULACION_SOLICITADA. Aplica la ventana temporal flexible
 * (salvo para Admin) y exige motivoAnulacion.
 */
export async function anularPapeleta(req: Request, res: Response): Promise<void> {
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

    const { motivoAnulacion } = req.body as { motivoAnulacion?: string };
    if (!motivoAnulacion) {
      res.status(400).json({ mensaje: 'motivoAnulacion es obligatorio' });
      return;
    }

    const papeleta = await prisma.papeleta.findUnique({ where: { id } });
    if (!papeleta) {
      res.status(404).json({ mensaje: 'Papeleta no encontrada' });
      return;
    }

    const esAdmin = usuarioToken.rol === Rol.ADMIN;
    const esAprobadorAsignado = papeleta.aprobadorId === usuarioToken.id;

    // Autorización viva (A-04): el aprobador asignado solo puede anular si
    // sigue siendo el aprobador VIGENTE del solicitante según la jerarquía
    // actual. Un aprobador obsoleto (tras cambio de jefe/rol) queda excluido.
    const esAprobador =
      esAprobadorAsignado &&
      (await esAprobadorVigente(papeleta.solicitanteId, usuarioToken.id));

    if (!esAdmin && !esAprobador) {
      res.status(403).json({ mensaje: 'Solo el aprobador vigente de la papeleta o un administrador pueden anularla' });
      return;
    }

    if (papeleta.estado !== EstadoPapeleta.APROBADO && papeleta.estado !== EstadoPapeleta.ANULACION_SOLICITADA) {
      res.status(409).json({
        mensaje: `No se puede anular: la papeleta debe estar APROBADO o ANULACION_SOLICITADA (estado actual: ${papeleta.estado})`,
      });
      return;
    }

    const { permitido, razon } = await puedeAnular(papeleta, esAdmin);
    if (!permitido) {
      res.status(409).json({ mensaje: razon ?? 'La ventana de anulación ya se cerró' });
      return;
    }

    const papeletaActualizada = await prisma.papeleta.update({
      where: { id },
      data: {
        estado: EstadoPapeleta.ANULADO,
        motivoAnulacion,
        fechaAnulacion: new Date(),
        anuladoPorAdmin: esAdmin,
        adminAnuladorId: esAdmin ? usuarioToken.id : null,
      },
    });

    await liberarBloqueoPapeleta(papeletaActualizada.id);

    notificar(
      papeletaActualizada.solicitanteId,
      `Su papeleta ${papeletaActualizada.numero} fue anulada. Motivo: ${motivoAnulacion}`,
    );

    res.status(200).json({ papeleta: papeletaActualizada });
  } catch (error) {
    console.error('Error en anularPapeleta:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * POST /api/papeletas/:id/solicitar-anulacion
 * Solo el solicitante. La papeleta debe estar APROBADO.
 * APROBADO → ANULACION_SOLICITADA. No requiere motivo.
 */
export async function solicitarAnulacion(req: Request, res: Response): Promise<void> {
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

    const papeleta = await prisma.papeleta.findUnique({ where: { id } });
    if (!papeleta) {
      res.status(404).json({ mensaje: 'Papeleta no encontrada' });
      return;
    }

    if (papeleta.solicitanteId !== usuarioToken.id) {
      res.status(403).json({ mensaje: 'Solo el solicitante puede pedir la anulación de esta papeleta' });
      return;
    }

    if (papeleta.estado !== EstadoPapeleta.APROBADO) {
      res.status(409).json({
        mensaje: `No se puede solicitar la anulación: la papeleta debe estar APROBADO (estado actual: ${papeleta.estado})`,
      });
      return;
    }

    const papeletaActualizada = await prisma.papeleta.update({
      where: { id },
      data: { estado: EstadoPapeleta.ANULACION_SOLICITADA },
    });

    if (papeletaActualizada.aprobadorId) {
      notificar(
        papeletaActualizada.aprobadorId,
        `El trabajador solicitó la anulación de la papeleta ${papeletaActualizada.numero}.`,
      );
    }

    res.status(200).json({ papeleta: papeletaActualizada });
  } catch (error) {
    console.error('Error en solicitarAnulacion:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * POST /api/papeletas/:id/cancelar-solicitud-anulacion
 * Solo el solicitante. La papeleta debe estar ANULACION_SOLICITADA.
 * ANULACION_SOLICITADA → APROBADO.
 */
export async function cancelarSolicitudAnulacion(req: Request, res: Response): Promise<void> {
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

    const papeleta = await prisma.papeleta.findUnique({ where: { id } });
    if (!papeleta) {
      res.status(404).json({ mensaje: 'Papeleta no encontrada' });
      return;
    }

    if (papeleta.solicitanteId !== usuarioToken.id) {
      res.status(403).json({ mensaje: 'Solo el solicitante puede cancelar esta solicitud de anulación' });
      return;
    }

    if (papeleta.estado !== EstadoPapeleta.ANULACION_SOLICITADA) {
      res.status(409).json({
        mensaje: `No se puede cancelar la solicitud: la papeleta debe estar ANULACION_SOLICITADA (estado actual: ${papeleta.estado})`,
      });
      return;
    }

    const papeletaActualizada = await prisma.papeleta.update({
      where: { id },
      data: { estado: EstadoPapeleta.APROBADO },
    });

    res.status(200).json({ papeleta: papeletaActualizada });
  } catch (error) {
    console.error('Error en cancelarSolicitudAnulacion:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * POST /api/papeletas/verificar-token
 * Requiere autenticación. Solo puede verificar la papeleta quien esté
 * autorizado a verla: los roles operativos de verificación
 * (VIGILANTE/RRHH/ADMIN) o cualquier rol cuyo alcance de visibilidad
 * organizacional incluya al solicitante. No cambia el estado de la
 * papeleta; solo registra la consulta en TokenVerificacion.
 */
export async function verificarToken(req: Request, res: Response): Promise<void> {
  try {
    const usuarioToken = req.usuario;
    if (!usuarioToken) {
      res.status(401).json({ mensaje: 'No autenticado' });
      return;
    }

    const { token } = req.body as { token?: string };
    if (!token) {
      res.status(400).json({ mensaje: 'token es obligatorio' });
      return;
    }

    const papeleta = await prisma.papeleta.findUnique({
      where: { token },
      include: {
        solicitante: { select: { nombres: true, apellidos: true } },
      },
    });

    if (!papeleta) {
      res.status(200).json({ valido: false, mensaje: 'Token inválido' });
      return;
    }

    // Autorización de lectura (A-01): se aplica el servicio de visibilidad.
    // Los roles con función operativa de verificación (VIGILANTE/RRHH/ADMIN)
    // pueden verificar cualquier papeleta; el resto solo las que ya puede ver.
    const esVerificador = ROLES_VERIFICADORES_TOKEN.includes(usuarioToken.rol);
    const puedeVer =
      esVerificador ||
      (await usuarioPuedeVerPapeleta(usuarioToken, papeleta.solicitanteId));

    if (!puedeVer) {
      res.status(403).json({
        mensaje: 'No tiene permisos para verificar esta papeleta',
      });
      return;
    }

    // Vigencia operativa: los tokens de papeletas ANULADAS o CANCELADAS ya no
    // deben considerarse válidos.
    if (
      papeleta.estado === EstadoPapeleta.ANULADO ||
      papeleta.estado === EstadoPapeleta.CANCELADO
    ) {
      res.status(200).json({
        valido: false,
        mensaje: 'La papeleta ya no está vigente',
      });
      return;
    }

    await prisma.tokenVerificacion.create({
      data: {
        token,
        papeletaId: papeleta.id,
        usuarioConsultanteId: usuarioToken.id,
      },
    });

    res.status(200).json({
      valido: true,
      papeleta: {
        id: papeleta.id,
        numero: papeleta.numero,
        solicitante: papeleta.solicitante,
        tipoTiempo: papeleta.tipoTiempo,
        fechaInicio: papeleta.fechaInicio,
        fechaFin: papeleta.fechaFin,
        horaSalida: papeleta.horaSalida,
        horaRetorno: papeleta.horaRetorno,
        estado: papeleta.estado,
      },
    });
  } catch (error) {
    console.error('Error en verificarToken:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}
