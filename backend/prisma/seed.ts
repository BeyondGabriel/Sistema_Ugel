// ===========================================================
// Sistema de Gestión de Personal - UGEL Talara
// Script de seed - Fase 0
// ===========================================================

import { PrismaClient, Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generarPasswordSegura } from '../src/utils/generarPassword';

const prisma = new PrismaClient();

async function crearJefaturasIniciales() {
  const nombresJefaturas = [
    'Administración',
    'Recursos Humanos',
    'Dirección',
    'Vigilancia',
  ];

  const jefaturas: Record<string, { id: number }> = {};

  for (const nombre of nombresJefaturas) {
    const jefatura = await prisma.jefatura.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    jefaturas[nombre] = jefatura;
  }

  return jefaturas;
}

async function crearUsuarioAdmin(jefaturaAdministracionId: number) {
  const emailAdmin = 'admin@ugeltalara.gob.pe';

  const adminExistente = await prisma.usuario.findUnique({
    where: { email: emailAdmin },
  });

  if (adminExistente) {
    console.log('El usuario admin ya existe. No se generará una nueva contraseña.');
    return;
  }

  const passwordGenerada = generarPasswordSegura(16);
  const passwordHasheada = await bcrypt.hash(passwordGenerada, 10);

  await prisma.usuario.create({
    data: {
      email: emailAdmin,
      password: passwordHasheada,
      rol: Rol.ADMIN,
      activo: true,
      cambioPassword: true,
      nombres: 'Administrador',
      apellidos: 'Sistema',
      jefaturaId: jefaturaAdministracionId,
    },
  });

  console.log('================================');
  console.log(' Usuario admin creado');
  console.log(` Email: ${emailAdmin}`);
  console.log(` Contraseña: ${passwordGenerada}`);
  console.log(' Cambie la contraseña en el primer inicio de sesión');
  console.log('================================');
}

async function main() {
  console.log('Iniciando seed de la base de datos...\n');

  const jefaturas = await crearJefaturasIniciales();
  await crearUsuarioAdmin(jefaturas['Administración'].id);

  console.log('\nSeed completado exitosamente.');
}

main()
  .catch((error) => {
    console.error('Error ejecutando el seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
