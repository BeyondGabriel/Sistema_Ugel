# Sistema de Gestión de Personal – UGEL Talara

Sistema de gestión de personal para una institución de aproximadamente 50 trabajadores, pensado para funcionar en intranet. Centraliza el control de **asistencias**, **papeletas** (permisos de salida) y **registro de visitas**, con flujos de aprobación jerárquicos entre 7 roles de usuario distintos.

## Módulos principales

- **Asistencias**: registro de movimientos de entrada y salida del personal.
- **Papeletas**: solicitud, aprobación, observación, rechazo y anulación de permisos de salida (por día(s) u horas), con firma digital y token de verificación.
- **Visitas**: registro de ingreso y salida de personas externas, con control de gafetes.

## Roles del sistema

`VIGILANTE` · `ESPECIALISTA` · `JEFE` · `DIRECTORA` · `RRHH` · `ADMIN`

> Los roles `DIRECTORA`, `RRHH` y `ADMIN` están restringidos a un único usuario activo a la vez (regla de negocio validada en los servicios del backend, no a nivel de base de datos).

## Stack tecnológico

| Capa            | Tecnología                                  |
|-----------------|----------------------------------------------|
| Backend         | Node.js + Express + TypeScript               |
| ORM             | Prisma                                       |
| Base de datos   | MySQL (Laragon en desarrollo)                |
| Frontend        | React 18 + Vite + Tailwind CSS               |
| Autenticación   | JWT + bcryptjs                               |
| Notificaciones  | Socket.IO                                    |
| Almacenamiento  | Supabase (solo para firmas SVG)              |

## Requisitos previos

- Node.js 18 o superior
- MySQL 8 o superior
- Laragon (opcional, recomendado para desarrollo en Windows)

## Instalación

### 1. Backend

```bash
cd backend
npm install

# Copiar el archivo de variables de entorno y completarlo con tus credenciales
cp .env.example .env

# Crear las tablas en la base de datos a partir del schema de Prisma
npm run prisma:migrate

# Poblar la base de datos con las jefaturas iniciales y el usuario admin
npm run prisma:seed

# Levantar el servidor en modo desarrollo
npm run dev
```

El backend quedará disponible en `http://localhost:3001`.

### 2. Frontend

```bash
cd frontend
npm install

# Copiar el archivo de variables de entorno
cp .env.example .env

# Levantar el servidor de desarrollo
npm run dev
```

El frontend quedará disponible en `http://localhost:5173`, con un proxy configurado hacia `/api` para comunicarse con el backend.

## Acceso inicial

Al ejecutar el seed (`npm run prisma:seed`), se crea automáticamente un usuario administrador. Las credenciales se imprimen **una sola vez** en la consola:

```
================================
 Usuario admin creado
 Email: admin@ugeltalara.gob.pe
 Contraseña: [contraseña generada]
 Cambie la contraseña en el primer inicio de sesión
================================
```

Guarda esa contraseña en un lugar seguro: el sistema obliga a cambiarla en el primer inicio de sesión (`cambioPassword: true`).

## Estructura del proyecto

```
proyecto-raiz/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── sockets/
│   │   └── app.ts
│   ├── uploads/
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── styles/
│   │   └── App.tsx
│   ├── .env
│   └── package.json
├── firma-movil/
│   ├── index.html
│   └── script.js
└── README.md
```

## Estado del proyecto

Esta es la **Fase 0**: configuración inicial del entorno, estructura de carpetas y modelo de datos. Las siguientes fases cubrirán la implementación de autenticación, los controladores y rutas de cada módulo, y la interfaz de usuario en React.
