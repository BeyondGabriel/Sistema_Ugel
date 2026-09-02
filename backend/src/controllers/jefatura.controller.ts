// ===========================================================
// Controlador de jefaturas (solo Admin para escritura)
// ===========================================================

import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';

/**
 * GET /api/jefaturas
 * Cualquier usuario autenticado puede listar jefaturas (necesario para
 * los selects de formularios en toda la aplicación).
 */
export async function listarJefaturas(_req: Request, res: Response): Promise<void> {
  try {
    const jefaturas = await prisma.jefatura.findMany({
      include: {
        _count: { select: { usuarios: true } },
      },
      orderBy: { nombre: 'asc' },
    });

    res.status(200).json({ jefaturas });
  } catch (error) {
    console.error('Error en listarJefaturas:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * POST /api/jefaturas
 * Solo Admin. Crea una nueva jefatura.
 */
export async function crearJefatura(req: Request, res: Response): Promise<void> {
  try {
    const { nombre, descripcion } = req.body as { nombre?: string; descripcion?: string };

    if (!nombre) {
      res.status(400).json({ mensaje: 'El nombre de la jefatura es obligatorio' });
      return;
    }

    const existente = await prisma.jefatura.findUnique({ where: { nombre } });
    if (existente) {
      res.status(409).json({ mensaje: 'Ya existe una jefatura con ese nombre' });
      return;
    }

    const jefatura = await prisma.jefatura.create({
      data: { nombre, descripcion: descripcion ?? null },
    });

    res.status(201).json({ jefatura });
  } catch (error) {
    console.error('Error en crearJefatura:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

/**
 * PUT /api/jefaturas/:id
 * Solo Admin. Edita nombre y/o descripción de una jefatura.
 */
export async function editarJefatura(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ mensaje: 'El id proporcionado no es válido' });
      return;
    }

    const jefatura = await prisma.jefatura.findUnique({ where: { id } });
    if (!jefatura) {
      res.status(404).json({ mensaje: 'Jefatura no encontrada' });
      return;
    }

    const { nombre, descripcion } = req.body as { nombre?: string; descripcion?: string };

    if (nombre && nombre !== jefatura.nombre) {
      const conflicto = await prisma.jefatura.findUnique({ where: { nombre } });
      if (conflicto) {
        res.status(409).json({ mensaje: 'Ya existe una jefatura con ese nombre' });
        return;
      }
    }

    const datos: Prisma.JefaturaUpdateInput = {};
    if (nombre !== undefined) datos.nombre = nombre;
    if (descripcion !== undefined) datos.descripcion = descripcion;

    const actualizada = await prisma.jefatura.update({ where: { id }, data: datos });

    res.status(200).json({ jefatura: actualizada });
  } catch (error) {
    console.error('Error en editarJefatura:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

export async function eliminarJefatura(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ mensaje: 'ID inválido' });
      return;
    }

    const jefatura = await prisma.jefatura.findUnique({ where: { id } });
    if (!jefatura) {
      res.status(404).json({ mensaje: 'Jefatura no encontrada' });
      return;
    }

    // Verificar si tiene usuarios asociados
    const usuariosCount = await prisma.usuario.count({ where: { jefaturaId: id } });
    if (usuariosCount > 0) {
      res.status(409).json({ mensaje: 'No se puede eliminar la jefatura porque tiene usuarios asociados' });
      return;
    }

    await prisma.jefatura.delete({ where: { id } });
    res.status(200).json({ mensaje: 'Jefatura eliminada correctamente' });
  } catch (error) {
    console.error('Error en eliminarJefatura:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}