// ===========================================================
// Instancia única de Prisma Client, reutilizada en toda la app
// para evitar abrir múltiples conexiones a la base de datos.
// ===========================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
