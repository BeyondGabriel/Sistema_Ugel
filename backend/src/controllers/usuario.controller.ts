// ===========================================================
// Controlador de gestión de usuarios (Admin y RRHH)
// ===========================================================

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Rol, Prisma, Usuario } from '@prisma/client';
import prisma from '../utils/prisma';
import { validarPassword } from '../utils/validarPassword';
import { generarPasswordSegura } from '../utils/generarPassword';

/** Roles que solo pueden tener un usuario activo a la vez. */
const ROLES_UNICOS: Rol[] = [Rol.DIRECTORA, Rol.RRHH, Rol.ADMIN];

function esRolUnico(rol: Rol): boolean {
  return ROLES_UNICOS.includes(rol);
}

/** Busca un usuario activo con el rol dado, excluyendo opcionalmente un id. */
async function buscarActivoConRol(rol: Rol, idExcluir?: number) {
  return prisma.usuario.findFirst({
    where: {
      rol,
      activo: true,
      ...(idExcluir !== undefined ? { id: { not: idExcluir } } : {}),
    },
  });
}

/** Quita el campo password de un objeto Usuario antes de devolverlo al cliente. */
function omitirPassword<T extends { password: string }>(usuario: T): Omit<T, 'password'> {
  const { password, ...resto } = usuario;
  return resto;
}

/**
 * POST /api/usuarios
 * Solo Admin o RRHH. Crea un nuevo usuario.
 */
export async function crearUsuario(req: Request, res: Response): Promise<void> {
  try {
    const {
      email,
      password,
      rol,
      nombres,
      apellidos,
      jefaturaId,
      jefeId,
    } = req.body as {
      email?: string;
      password?: string;
      rol?: Rol;
      nombres?: string;
      apellidos?: string;
      jefaturaId?: number;
      jefeId?: number;
    };

    if (!email || !rol || !nombres || !apellidos) {
      res.status(400).json({ mensaje: 'email, rol, nombres y apellidos son obligatorios' });
      return;
    }

    if (!Object.values(Rol).includes(rol)) {
      res.status(400).json({ mensaje: 'El rol especificado no es válido' });
      return;
    }

    const emailExistente = await prisma.usuario.findUnique({ where: { email } });
    if (emailExistente) {
      res.status(409).json({ mensaje: 'Ya existe un usuario registrado con ese correo electrónico' });
      return;
    }

    if (jefeId !== undefined && jefeId !== null) {
      const jefe = await prisma.usuario.findUnique({ where: { id: jefeId } });
      if (!jefe || (jefe.rol !== Rol.JEFE && jefe.rol !== Rol.DIRECTORA)) {
        res.status(400).json({ mensaje: 'El jefe asignado debe ser un usuario con rol JEFE o DIRECTORA' });
        return;
      }
    }

    if (jefaturaId !== undefined && jefaturaId !== null) {
      const jefatura = await prisma.jefatura.findUnique({ where: { id: jefaturaId } });
      if (!jefatura) {
        res.status(404).json({ mensaje: 'La jefatura especificada no existe' });
        return;
      }
    }

    let passwordFinal = password;
    let passwordFueGenerada = false;

    if (passwordFinal) {
      if (!validarPassword(passwordFinal)) {
        res.status(400).json({
          mensaje: 'La contraseña debe tener mínimo 8 caracteres, al menos un número y un símbolo',
        });
        return;
      }
    } else {
      passwordFinal = generarPasswordSegura(16);
      passwordFueGenerada = true;
    }

    // Regla de roles únicos activos (DIRECTORA, RRHH, ADMIN)
    let activo = true;
    let advertencia: string | undefined;

    if (esRolUnico(rol)) {
      const usuarioActivoConRol = await buscarActivoConRol(rol);
      if (usuarioActivoConRol) {
        activo = false;
        advertencia = `Ya existe un usuario activo con el rol ${rol}. El nuevo usuario se creó inactivo; desactive al usuario actual para poder activar a este.`;
      }
    }

    const passwordHasheada = await bcrypt.hash(passwordFinal, 10);

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        email,
        password: passwordHasheada,
        rol,
        nombres,
        apellidos,
        activo,
        cambioPassword: true,
        jefaturaId: jefaturaId ?? null,
        jefeId: jefeId ?? null,
      },
    });

    const respuesta: Record<string, unknown> = {
      usuario: omitirPassword(nuevoUsuario),
    };

    // La contraseña generada automáticamente solo se devuelve en este momento,
    // para que el Admin/RRHH pueda comunicarla al trabajador.
    if (passwordFueGenerada) {
      respuesta.passwordGenerada = passwordFinal;
    }

    if (advertencia) {
      respuesta.advertencia = advertencia;
    }

    res.status(201).json(respuesta);
  } catch (error) {
    console.error('Error en crearUsuario:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * PUT /api/usuarios/:id
 * Solo Admin. Edita cualquier campo del usuario excepto la contraseña.
 */
export async function editarUsuario(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      res.status(400).json({ mensaje: 'El id proporcionado no es válido' });
      return;
    }

    const usuarioActual = await prisma.usuario.findUnique({ where: { id } });

    if (!usuarioActual) {
      res.status(404).json({ mensaje: 'Usuario no encontrado' });
      return;
    }

    const {
      email,
      rol,
      nombres,
      apellidos,
      jefaturaId,
      jefeId,
      activo,
    } = req.body as {
      email?: string;
      rol?: Rol;
      nombres?: string;
      apellidos?: string;
      jefaturaId?: number | null;
      jefeId?: number | null;
      activo?: boolean;
    };

    if (rol !== undefined && !Object.values(Rol).includes(rol)) {
      res.status(400).json({ mensaje: 'El rol especificado no es válido' });
      return;
    }

    if (email !== undefined && email !== usuarioActual.email) {
      const emailExistente = await prisma.usuario.findUnique({ where: { email } });
      if (emailExistente) {
        res.status(409).json({ mensaje: 'Ya existe un usuario registrado con ese correo electrónico' });
        return;
      }
    }

    if (jefeId !== undefined && jefeId !== null) {
      const jefe = await prisma.usuario.findUnique({ where: { id: jefeId } });
      if (!jefe || (jefe.rol !== Rol.JEFE && jefe.rol !== Rol.DIRECTORA)) {
        res.status(400).json({ mensaje: 'El jefe asignado debe ser un usuario con rol JEFE o DIRECTORA' });
        return;
      }
    }

    if (jefaturaId !== undefined && jefaturaId !== null) {
      const jefatura = await prisma.jefatura.findUnique({ where: { id: jefaturaId } });
      if (!jefatura) {
        res.status(404).json({ mensaje: 'La jefatura especificada no existe' });
        return;
      }
    }

    const rolFinal = rol ?? usuarioActual.rol;
    const activoFinal = activo ?? usuarioActual.activo;

    // Regla de roles únicos: si tras la edición el usuario queda activo con un
    // rol único, no debe existir ya otro usuario activo con ese mismo rol.
    if (activoFinal && esRolUnico(rolFinal)) {
      const conflicto = await buscarActivoConRol(rolFinal, id);
      if (conflicto) {
        res.status(409).json({
          mensaje: `Ya existe un usuario activo con el rol ${rolFinal}`,
        });
        return;
      }
    }

const datosActualizacion: Prisma.UsuarioUpdateInput = {};

if (email !== undefined) datosActualizacion.email = email;
if (rol !== undefined) datosActualizacion.rol = rol;
if (nombres !== undefined) datosActualizacion.nombres = nombres;
if (apellidos !== undefined) datosActualizacion.apellidos = apellidos;

// Relación con jefatura
if (jefaturaId !== undefined) {
  if (jefaturaId === null) {
    datosActualizacion.jefatura = { disconnect: true };
  } else {
    datosActualizacion.jefatura = { connect: { id: jefaturaId } };
  }
}

// Relación con jefe inmediato
if (jefeId !== undefined) {
  if (jefeId === null) {
    datosActualizacion.jefe = { disconnect: true };
  } else {
    datosActualizacion.jefe = { connect: { id: jefeId } };
  }
}

if (activo !== undefined) datosActualizacion.activo = activo;

    const usuarioActualizado = await prisma.usuario.update({
      where: { id },
      data: datosActualizacion,
    });

    res.status(200).json({ usuario: omitirPassword(usuarioActualizado) });
  } catch (error) {
    console.error('Error en editarUsuario:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * PUT /api/usuarios/:id/desactivar
 * Solo Admin. Desactiva un usuario (nunca se eliminan registros).
 */
export async function desactivarUsuario(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      res.status(400).json({ mensaje: 'El id proporcionado no es válido' });
      return;
    }

    const usuario = await prisma.usuario.findUnique({ where: { id } });

    if (!usuario) {
      res.status(404).json({ mensaje: 'Usuario no encontrado' });
      return;
    }

    if (!usuario.activo) {
      res.status(400).json({ mensaje: 'El usuario ya se encuentra desactivado' });
      return;
    }

    // Evita que el sistema quede sin ningún Admin (activo o inactivo)
    if (usuario.rol === Rol.ADMIN) {
      const otrosAdmins = await prisma.usuario.count({
        where: { rol: Rol.ADMIN, id: { not: id } },
      });

      if (otrosAdmins === 0) {
        res.status(409).json({
          mensaje:
            'No es posible desactivar al único administrador del sistema. Cree otro administrador antes de continuar.',
        });
        return;
      }
    }

    const usuarioDesactivado = await prisma.usuario.update({
      where: { id },
      data: { activo: false },
    });

    // Si el usuario desactivado era ADMIN, se activa automáticamente
    // el administrador inactivo más reciente (si existe alguno).
    let adminActivado: Usuario | null = null;

    if (usuario.rol === Rol.ADMIN) {
      const adminInactivoMasReciente = await prisma.usuario.findFirst({
        where: { rol: Rol.ADMIN, activo: false, id: { not: id } },
        orderBy: { fechaCreacion: 'desc' },
      });

      if (adminInactivoMasReciente) {
        adminActivado = await prisma.usuario.update({
          where: { id: adminInactivoMasReciente.id },
          data: { activo: true },
        });
      }
    }

    res.status(200).json({
      usuario: omitirPassword(usuarioDesactivado),
      adminActivadoAutomaticamente: adminActivado ? omitirPassword(adminActivado) : null,
    });
  } catch (error) {
    console.error('Error en desactivarUsuario:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * GET /api/usuarios
 * Admin y RRHH. Lista usuarios con filtros opcionales por rol,
 * jefaturaId y activo (por defecto, solo activos).
 */
export async function listarUsuarios(req: Request, res: Response): Promise<void> {
  try {
    const { rol, jefaturaId, activo } = req.query as {
      rol?: Rol;
      jefaturaId?: string;
      activo?: string;
    };

    const where: Prisma.UsuarioWhereInput = {};

    if (rol !== undefined) {
      if (!Object.values(Rol).includes(rol)) {
        res.status(400).json({ mensaje: 'El rol especificado no es válido' });
        return;
      }
      where.rol = rol;
    }

    if (jefaturaId !== undefined) {
      const jefaturaIdNum = Number(jefaturaId);
      if (Number.isNaN(jefaturaIdNum)) {
        res.status(400).json({ mensaje: 'jefaturaId debe ser numérico' });
        return;
      }
      where.jefaturaId = jefaturaIdNum;
    }

    // Por defecto solo se listan usuarios activos, salvo que se indique lo contrario
    where.activo = activo !== undefined ? activo === 'true' : true;

    const usuarios = await prisma.usuario.findMany({
      where,
      include: {
        jefatura: true,
        jefe: { select: { id: true, nombres: true, apellidos: true } },
      },
      orderBy: { apellidos: 'asc' },
    });

    res.status(200).json({
      usuarios: usuarios.map((usuario) => omitirPassword(usuario)),
    });
  } catch (error) {
    console.error('Error en listarUsuarios:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * GET /api/usuarios/:id
 * Admin y RRHH. Devuelve un usuario con sus relaciones.
 */
export async function obtenerUsuario(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      res.status(400).json({ mensaje: 'El id proporcionado no es válido' });
      return;
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: {
        jefatura: true,
        jefe: { select: { id: true, nombres: true, apellidos: true, rol: true } },
      },
    });

    if (!usuario) {
      res.status(404).json({ mensaje: 'Usuario no encontrado' });
      return;
    }

    res.status(200).json({ usuario: omitirPassword(usuario) });
  } catch (error) {
    console.error('Error en obtenerUsuario:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * POST /api/usuarios/asignar-jefe
 * Solo Admin. Asigna el jefe inmediato de un usuario.
 * El jefe debe tener rol JEFE o DIRECTORA.
 */
export async function asignarJefe(req: Request, res: Response): Promise<void> {
  try {
    const { usuarioId, jefeId } = req.body as { usuarioId?: number; jefeId?: number };

    if (!usuarioId || !jefeId) {
      res.status(400).json({ mensaje: 'usuarioId y jefeId son obligatorios' });
      return;
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });

    if (!usuario) {
      res.status(404).json({ mensaje: 'Usuario no encontrado' });
      return;
    }

    const jefe = await prisma.usuario.findUnique({ where: { id: jefeId } });

    if (!jefe) {
      res.status(404).json({ mensaje: 'Jefe no encontrado' });
      return;
    }

    if (jefe.rol !== Rol.JEFE && jefe.rol !== Rol.DIRECTORA) {
      res.status(400).json({ mensaje: 'El usuario asignado como jefe debe tener rol JEFE o DIRECTORA' });
      return;
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { id: usuarioId },
      data: { jefeId },
    });

    res.status(200).json({ usuario: omitirPassword(usuarioActualizado) });
  } catch (error) {
    console.error('Error en asignarJefe:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}
