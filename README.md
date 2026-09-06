# SIGPER – Sistema de Gestión de Personal | UGEL Talara

Sistema web de gestión de personal para la UGEL Talara, diseñado para una institución de aproximadamente 50 trabajadores y pensado para operar en una red interna (intranet).

SIGPER centraliza la gestión de:

- autenticación y usuarios;
- jefaturas y estructura jerárquica;
- asistencias y control de presencia;
- papeletas de permisos;
- aprobaciones jerárquicas;
- anulaciones de papeletas;
- visitas y control de gafetes;
- notificaciones en tiempo real;
- verificación mediante token;
- generación de PDF;
- reportes en Excel;
- captura y recepción de firmas externas.

> **Estado:** sistema funcional en desarrollo activo.  
> Este README describe el estado actual del código y las funcionalidades implementadas en el repositorio.

---

## Índice

- [Características](#características)
- [Roles](#roles)
- [Arquitectura](#arquitectura)
- [Stack tecnológico](#stack-tecnológico)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Variables de entorno](#variables-de-entorno)
- [Acceso inicial](#acceso-inicial)
- [Módulo de autenticación](#módulo-de-autenticación)
- [Gestión de usuarios y jefaturas](#gestión-de-usuarios-y-jefaturas)
- [Gestión de asistencias](#gestión-de-asistencias)
- [Gestión de papeletas](#gestión-de-papeletas)
- [Aprobación jerárquica](#aprobación-jerárquica)
- [Revisión y timeout](#revisión-y-timeout)
- [Anulación de papeletas](#anulación-de-papeletas)
- [Bloqueos de asistencia](#bloqueos-de-asistencia)
- [Tokens de verificación](#tokens-de-verificación)
- [Firmas externas](#firmas-externas)
- [Gestión de visitas](#gestión-de-visitas)
- [Notificaciones](#notificaciones)
- [Reportes y exportaciones](#reportes-y-exportaciones)
- [API](#api)
- [Rutas del frontend](#rutas-del-frontend)
- [Modelo de datos](#modelo-de-datos)
- [Jobs periódicos](#jobs-periódicos)
- [Migraciones](#migraciones)
- [Cambios recientes](#cambios-recientes)
- [Consideraciones actuales](#consideraciones-actuales)
- [Licencia](#licencia)

---

## Características

### Gestión de personal

- Creación y administración de usuarios.
- Activación y desactivación de cuentas.
- Asignación de jefatura.
- Jefe inmediato mediante autorrelación.
- Encargado temporal.
- Restricción de usuarios activos para los roles `ADMIN`, `RRHH` y `DIRECTORA`.

### Asistencias

- Registro de `ENTRADA` y `SALIDA`.
- Control de hasta 4 ciclos completos por día.
- Consulta de asistencias.
- Edición de movimientos.
- Control de presencia.
- Bloqueos derivados de papeletas aprobadas.
- Exportación a Excel.

### Papeletas

- Solicitudes por días u horas.
- Motivos predefinidos.
- Aprobación jerárquica.
- Observación y reenvío.
- Rechazo.
- Cancelación.
- Anulación.
- Solicitud de anulación.
- Ventanas temporales de anulación.
- Token de verificación.
- Generación de PDF.
- Firma externa mediante URL.
- Notificaciones relacionadas con cambios de estado.

### Visitas

- Registro de visitantes.
- Validación de presencia del trabajador visitado.
- Registro de entrada y salida.
- Control de gafetes.
- Consulta según permisos del usuario.
- Exportación a Excel.
- Notificación al trabajador visitado.

### Notificaciones

- Persistencia en MySQL.
- Notificaciones en tiempo real mediante Socket.IO.
- Marcado individual como leído.
- Marcado de todas como leídas.

---

# Roles

El sistema implementa seis roles:

| Rol | Descripción general |
|---|---|
| `ADMIN` | Administración global del sistema |
| `RRHH` | Gestión de recursos humanos y operaciones autorizadas |
| `DIRECTORA` | Dirección y aprobación de papeletas según jerarquía |
| `JEFE` | Gestión y aprobación dentro de su ámbito jerárquico |
| `ESPECIALISTA` | Gestión de sus propios registros y solicitudes |
| `VIGILANTE` | Registro de asistencias y control de visitas |

Los roles `ADMIN`, `RRHH` y `DIRECTORA` están sujetos a una regla de negocio que limita a un único usuario activo por cada uno.

La restricción se implementa en la lógica de aplicación y no como una restricción única de base de datos.

---

# Arquitectura

El proyecto utiliza una arquitectura separada en frontend y backend:

```text
SIGPER/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── controllers/
│       ├── middlewares/
│       ├── routes/
│       ├── services/
│       ├── sockets/
│       ├── utils/
│       ├── app.ts
│       └── server.ts
│
├── frontend/
│   ├── firma-movil/
│   │   ├── index.html
│   │   └── script.js
│   └── src/
│       ├── components/
│       ├── contexts/
│       ├── hooks/
│       ├── pages/
│       ├── services/
│       ├── types/
│       ├── App.tsx
│       ├── index.css
│       └── main.tsx
│
├── .gitignore
└── README.md
```

## Backend

El backend expone una API REST con Express y utiliza Prisma como ORM para MySQL.

Las responsabilidades principales están separadas en:

- `controllers`: procesamiento de solicitudes HTTP;
- `routes`: definición de endpoints;
- `middlewares`: autenticación y autorización;
- `services`: reglas de negocio;
- `sockets`: comunicación Socket.IO;
- `utils`: utilidades compartidas.

## Frontend

El frontend está desarrollado con React + TypeScript + Vite.

Utiliza:

- React Router para navegación;
- Context API para autenticación, toast y Socket.IO;
- Axios para consumir la API;
- Tailwind CSS para estilos;
- Headless UI y Heroicons para componentes e interfaz.

---

# Stack tecnológico

| Capa | Tecnología |
|---|---|
| Runtime | Node.js |
| Backend | Express 4 + TypeScript |
| ORM | Prisma 5 |
| Base de datos | MySQL |
| Autenticación | JWT |
| Hash de contraseñas | bcryptjs |
| Tiempo real | Socket.IO |
| Reportes | ExcelJS |
| PDF | PDFKit |
| Uploads HTTP | Multer |
| Frontend | React 18 + TypeScript |
| Bundler | Vite 5 |
| Routing | React Router 6 |
| HTTP client | Axios |
| UI | Tailwind CSS |
| Componentes | Headless UI |
| Iconos | Heroicons |
| Firma externa | Webhook + almacenamiento externo preparado |

---

# Requisitos

Se recomienda:

- Node.js 18 o superior.
- MySQL 8 o superior.
- npm.
- Laragon es opcional y puede utilizarse para desarrollo local en Windows.

La base de datos está configurada para utilizar MySQL mediante Prisma.

---

# Instalación

## 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd <DIRECTORIO_DEL_REPOSITORIO>
```

## 2. Instalar dependencias del backend

```bash
cd backend
npm install
```

## 3. Configurar el backend

Crear:

```text
backend/.env
```

con las variables necesarias.

Ejemplo:

```env
DATABASE_URL="mysql://USUARIO:CONTRASEÑA@localhost:3306/NOMBRE_BASE_DATOS"
JWT_SECRET="CLAVE_SECRETA_SEGURA"
PORT=3001
WEBHOOK_SECRET="SECRETO_DEL_WEBHOOK"
```

## 4. Crear/aplicar la base de datos

```bash
npm run prisma:migrate
```

## 5. Ejecutar el seed

```bash
npm run prisma:seed
```

## 6. Iniciar backend

```bash
npm run dev
```

El backend queda disponible, por defecto, en:

```text
http://localhost:3001
```

Health check:

```text
GET http://localhost:3001/api/health
```

---

## 7. Instalar dependencias del frontend

Desde la raíz:

```bash
cd frontend
npm install
```

## 8. Iniciar frontend

```bash
npm run dev
```

Por defecto:

```text
http://localhost:5173
```

Vite está configurado para utilizar el backend mediante proxy durante el desarrollo.

---

# Variables de entorno

## Backend

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Cadena de conexión de Prisma/MySQL |
| `JWT_SECRET` | Firma y validación de tokens JWT |
| `PORT` | Puerto HTTP del backend; por defecto `3001` |
| `WEBHOOK_SECRET` | Protección del endpoint de firma externa |

No deben almacenarse credenciales reales en el repositorio.

---

# Acceso inicial

El seed crea las jefaturas iniciales y un usuario administrador.

Correo inicial:

```text
admin@ugeltalara.gob.pe
```

La contraseña se genera aleatoriamente cuando el administrador todavía no existe y se muestra en la consola durante el seed.

El usuario se crea con:

```text
rol = ADMIN
activo = true
cambioPassword = true
```

Por ello, el primer ingreso requiere cambiar la contraseña.

La contraseña nueva debe cumplir las reglas de validación definidas por el backend, incluyendo:

- mínimo 8 caracteres;
- al menos un número;
- al menos un símbolo.

Las contraseñas se almacenan mediante `bcryptjs`.

---

# Módulo de autenticación

## Login

```http
POST /api/auth/login
```

El login devuelve un JWT.

Si el usuario tiene pendiente el cambio inicial de contraseña, recibe un token temporal.

### Duración de tokens

Token temporal:

```text
15 minutos
```

Sesión normal:

```text
8 horas
```

Las rutas protegidas reciben:

```http
Authorization: Bearer <TOKEN>
```

El frontend conserva actualmente el token en `localStorage`.

---

# Gestión de usuarios y jefaturas

## Usuarios

El sistema permite:

- crear usuarios;
- editar usuarios;
- desactivar usuarios;
- consultar información;
- asignar jefaturas;
- establecer jefe inmediato;
- establecer encargado temporal.

Los usuarios poseen:

```text
id
email
password
rol
activo
cambioPassword
nombres
apellidos
foto
jefaturaId
jefeId
encargadoTemporalId
fechaCreacion
```

## Jefaturas

El sistema permite crear, editar, consultar y eliminar jefaturas.

Una jefatura puede tener un usuario designado como jefe.

---

# Gestión de asistencias

Los movimientos disponibles son:

```text
ENTRADA
SALIDA
```

## Registro

```http
POST /api/asistencias
```

El registro operativo está destinado principalmente a `VIGILANTE` y `ADMIN`.

## Límite diario

El sistema limita a cuatro ciclos completos de entrada/salida por día.

Un ciclo corresponde a:

```text
ENTRADA → SALIDA
```

Una `SALIDA` puede registrarse incluso si no existe una entrada previa, contemplando una omisión de marcado.

## Edición

```http
PUT /api/asistencias/:id
```

`VIGILANTE` puede editar movimientos dentro de la ventana permitida por la lógica del sistema.

`ADMIN` dispone de permisos ampliados.

## Consulta

```http
GET /api/asistencias
```

Permite aplicar filtros por:

- usuario;
- fecha inicial;
- fecha final;
- jefatura.

## Presencia

```http
GET /api/asistencias/presencia
```

El sistema determina:

```text
PRESENTE
AUSENTE
```

según el último movimiento registrado durante el día.

## Fechas

Los filtros de fecha utilizan interpretación local para evitar desfases producidos por la conversión directa de fechas `YYYY-MM-DD` a UTC.

---

# Gestión de papeletas

Las papeletas representan permisos de ausencia o salida del personal.

## Tipos

```text
DIAS
HORAS
```

### DIAS

Utiliza:

```text
fechaInicio
fechaFin
```

### HORAS

Utiliza:

```text
fechaInicio
fechaFin
horaSalida
horaRetorno
```

---

## Motivos

El frontend ofrece motivos como:

- Descanso médico;
- Atención médica;
- Asunto particular;
- Comisión de servicio;
- Docencia;
- Onomástico;
- Vacaciones;
- Omisión de marcado entrada/salida;
- Autorización de ingreso fuera de tolerancia;
- Compensación de horas trabajadas;
- Otros.

Para `Otros` se puede registrar información adicional.

---

# Estados de papeleta

Los estados definidos por Prisma son:

```text
PENDIENTE
EN_REVISION
OBSERVADO
APROBADO
RECHAZADO
CANCELADO
ANULADO
ANULACION_SOLICITADA
```

Flujo principal:

```text
                 ┌──────────────┐
                 │   PENDIENTE  │
                 └──────┬───────┘
                        │
                        ▼
                ┌───────────────┐
                │  EN_REVISION  │
                └───┬─────┬─────┘
                    │     │
          ┌─────────┘     └─────────┐
          ▼                         ▼
    ┌───────────┐             ┌───────────┐
    │ OBSERVADO │             │ APROBADO  │
    └─────┬─────┘             └─────┬─────┘
          │                         │
          ▼                         ▼
     REENVÍO                    ANULACIÓN
          │                         │
          ▼                         ▼
      PENDIENTE        ANULACION_SOLICITADA
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
                     APROBADO                ANULADO
```

También existen transiciones de rechazo y cancelación según las reglas de negocio.

---

# Aprobación jerárquica

El aprobador se determina según el rol del solicitante y su estructura organizacional.

La lógica contempla:

| Solicitante | Aprobador |
|---|---|
| `DIRECTORA` | Autoaprobación según la lógica de negocio |
| `ESPECIALISTA` | Jefe inmediato |
| `JEFE` | Directora |
| `VIGILANTE` | RRHH |
| `RRHH` | Jefe inmediato |
| `ADMIN` | Jefe inmediato |

Si no existe un aprobador válido, la operación se rechaza.

---

# Revisión y timeout

Cuando un aprobador comienza a revisar una papeleta:

```text
PENDIENTE → EN_REVISION
```

Se registra:

```text
fechaRevision
```

La ventana máxima de revisión es:

```text
20 minutos
```

Si el tiempo se supera:

```text
EN_REVISION → PENDIENTE
```

El sistema notifica la expiración.

Esto permite que una papeleta que quedó abandonada durante una revisión vuelva a estar disponible.

---

# Reenvío de papeletas observadas

Las papeletas en estado:

```text
OBSERVADO
```

pueden ser corregidas y reenviadas por el solicitante.

El frontend dispone de una ruta específica:

```text
/papeletas/:id/reenviar
```

El formulario carga la información de la papeleta existente y permite modificarla antes del reenvío.

El reenvío devuelve la papeleta a:

```text
PENDIENTE
```

y limpia el comentario de observación almacenado.

---

# Anulación de papeletas

Una papeleta aprobada puede entrar en un flujo de anulación.

Estados utilizados:

```text
APROBADO
    ↓
ANULACION_SOLICITADA
    ↓
ANULADO
```

Las reglas de tiempo dependen del tipo de papeleta.

## Papeletas por días

La anulación está permitida mientras no haya comenzado el periodo solicitado, salvo las reglas especiales de `ADMIN`.

## Papeletas por horas

La posibilidad de anulación depende de que el trabajador todavía no haya registrado su regreso correspondiente.

## ADMIN

El administrador dispone de permisos especiales para anular papeletas.

## Expiración

Un job periódico comprueba las solicitudes cuya ventana de anulación ya terminó.

Cuando corresponde, la solicitud se cierra automáticamente.

## Alertas

El sistema puede generar notificaciones cuando queda una hora o menos para que termine la ventana de anulación.

---

# Bloqueos de asistencia

Una papeleta en estado:

```text
APROBADO
```

puede bloquear el registro de asistencia correspondiente al periodo autorizado.

## DIAS

El bloqueo cubre el intervalo de fechas:

```text
fechaInicio → fechaFin
```

## HORAS

El bloqueo cubre:

```text
horaSalida → horaRetorno
```

El bloqueo se determina dinámicamente a partir de las papeletas aprobadas.

Esto significa que una papeleta que pasa de:

```text
APROBADO → ANULADO
```

deja de producir el bloqueo.

---

# Tokens de verificación

Las papeletas aprobadas pueden recibir un token de verificación único.

El modelo almacena:

```text
Papeleta.token
```

y registra consultas mediante:

```text
TokenVerificacion
```

Endpoint:

```http
POST /api/papeletas/verificar-token
```

Frontend:

```text
/verificar-token
```

El sistema registra, cuando corresponde, el usuario que realizó la consulta y la fecha de consulta.

---

# Firmas externas

El sistema incorpora soporte backend para recibir la ubicación de una firma externa.

Endpoint:

```http
POST /api/firmas/webhook
```

La autenticación del webhook utiliza:

```http
x-webhook-secret: <WEBHOOK_SECRET>
```

El modelo `Papeleta` dispone de:

```text
firmaExternaSvg
```

para almacenar la ruta o URL de la firma.

## Firma móvil

Existe una página independiente en:

```text
frontend/firma-movil/
```

Permite:

- dibujar con mouse;
- dibujar mediante pantalla táctil;
- limpiar la firma;
- generar un SVG;
- visualizar la firma;
- descargar el SVG.

### Estado de la integración

```text
Captura de firma       → IMPLEMENTADA
Generación SVG         → IMPLEMENTADA
Descarga SVG           → IMPLEMENTADA
Webhook backend        → IMPLEMENTADO
Almacenamiento externo → PREPARADO
Subida automática      → PENDIENTE DE CONFIGURACIÓN
```

La implementación incluida contiene la estructura necesaria para integrar almacenamiento externo, pero la subida a Supabase no debe considerarse activa hasta completar su configuración.

---

# Gestión de visitas

## Registro

```http
POST /api/visitas
```

El sistema registra:

- nombre del visitante;
- DNI;
- trabajador visitado;
- registrador;
- hora de entrada;
- gafete entregado.

Antes de registrar una visita se comprueba que el trabajador visitado se encuentre presente según la lógica de asistencia.

## Salida

```http
PUT /api/visitas/:id/salida
```

Registra la hora de salida.

## Gafete

```http
PUT /api/visitas/:id/gafete
```

Actualiza el estado de entrega del gafete.

## Notificación

Al registrar una visita se genera una notificación para el trabajador visitado.

---

# Notificaciones

Las notificaciones utilizan dos mecanismos.

## Persistencia

Se almacenan en:

```text
Notificacion
```

en MySQL.

## Tiempo real

Socket.IO utiliza salas individuales:

```text
usuario:<id>
```

Cuando se genera una notificación:

```text
1. Se guarda en MySQL.
2. Se emite mediante Socket.IO.
3. El frontend puede mostrarla inmediatamente.
```

Endpoints:

```http
GET /api/notificaciones
PUT /api/notificaciones/:id/leer
PUT /api/notificaciones/leer-todas
```

---

# Reportes y exportaciones

El backend genera archivos `.xlsx` utilizando ExcelJS.

## Asistencias

```http
GET /api/asistencias/exportar
```

Incluye información como:

- trabajador;
- jefatura;
- fecha;
- hora de entrada;
- hora de salida;
- estado.

Los filtros de fecha se interpretan con fecha local y el límite final se establece al final del día.

## Visitas

```http
GET /api/visitas/exportar
```

Incluye:

- visitante;
- DNI;
- trabajador visitado;
- jefatura;
- hora de entrada;
- hora de salida;
- estado del gafete.

## Papeletas

```http
GET /api/papeletas/exportar
```

Incluye información como:

- número;
- solicitante;
- jefatura;
- tipo;
- fechas;
- horas;
- motivo;
- estado;
- aprobador;
- fecha de creación.

Los filtros de la exportación de papeletas utilizan la **fecha de creación de la papeleta**, manteniendo el mismo criterio utilizado en el listado.

---

# API

## Autenticación

| Método | Endpoint |
|---|---|
| POST | `/api/auth/login` |
| POST | `/api/auth/cambiar-password` |
| GET | `/api/auth/mi-perfil` |

## Usuarios

| Método | Endpoint |
|---|---|
| POST | `/api/usuarios` |
| POST | `/api/usuarios/asignar-jefe` |
| GET | `/api/usuarios` |
| GET | `/api/usuarios/:id` |
| PUT | `/api/usuarios/:id` |
| PUT | `/api/usuarios/:id/desactivar` |

## Jefaturas

| Método | Endpoint |
|---|---|
| GET | `/api/jefaturas` |
| POST | `/api/jefaturas` |
| PUT | `/api/jefaturas/:id` |
| DELETE | `/api/jefaturas/:id` |

## Asistencias

| Método | Endpoint |
|---|---|
| POST | `/api/asistencias` |
| GET | `/api/asistencias` |
| GET | `/api/asistencias/presencia` |
| GET | `/api/asistencias/exportar` |
| PUT | `/api/asistencias/:id` |

## Papeletas

| Método | Endpoint |
|---|---|
| POST | `/api/papeletas` |
| GET | `/api/papeletas` |
| GET | `/api/papeletas/:id` |
| GET | `/api/papeletas/:id/pdf` |
| GET | `/api/papeletas/exportar` |
| POST | `/api/papeletas/verificar-token` |
| PUT | `/api/papeletas/:id/revisar` |
| PUT | `/api/papeletas/:id/aprobar` |
| PUT | `/api/papeletas/:id/rechazar` |
| PUT | `/api/papeletas/:id/observar` |
| PUT | `/api/papeletas/:id/cancelar` |
| PUT | `/api/papeletas/:id/reenviar` |
| PUT | `/api/papeletas/:id/anular` |
| POST | `/api/papeletas/:id/solicitar-anulacion` |
| POST | `/api/papeletas/:id/cancelar-solicitud-anulacion` |

## Visitas

| Método | Endpoint |
|---|---|
| POST | `/api/visitas` |
| GET | `/api/visitas` |
| GET | `/api/visitas/:id` |
| GET | `/api/visitas/exportar` |
| PUT | `/api/visitas/:id/salida` |
| PUT | `/api/visitas/:id/gafete` |

## Notificaciones

| Método | Endpoint |
|---|---|
| GET | `/api/notificaciones` |
| PUT | `/api/notificaciones/:id/leer` |
| PUT | `/api/notificaciones/leer-todas` |

## Firma externa

| Método | Endpoint |
|---|---|
| POST | `/api/firmas/webhook` |

## Health check

```http
GET /api/health
```

Respuesta:

```json
{
  "estado": "ok"
}
```

---

# Rutas del frontend

Las principales rutas disponibles son:

```text
/login
/cambiar-password

/dashboard

/usuarios
/usuarios/nuevo
/usuarios/:id/editar

/jefaturas

/asistencias
/asistencias/registro
/mis-asistencias

/papeletas
/papeletas/nueva
/papeletas/:id
/papeletas/:id/reenviar

/visitas
/visitas/registro

/notificaciones

/verificar-token
```

La navegación se encuentra protegida mediante `ProtectedRoute`.

La interfaz también adapta las opciones disponibles según el usuario autenticado.

---

# Modelo de datos

Prisma define las siguientes entidades principales:

```text
Usuario
Jefatura
Movimiento
Papeleta
Visita
Notificacion
TokenVerificacion
```

## Usuario

Representa a cada trabajador o usuario del sistema.

Mantiene relaciones con:

- jefatura;
- jefe inmediato;
- subordinados;
- encargado temporal;
- asistencias;
- papeletas;
- visitas;
- notificaciones;
- consultas de tokens.

## Jefatura

Representa una unidad organizacional y puede tener un jefe asignado.

## Movimiento

Representa una marca de asistencia:

```text
ENTRADA
SALIDA
```

## Papeleta

Representa una solicitud de permiso y contiene el flujo de aprobación, anulación, token y firma externa.

## Visita

Representa una visita externa a un trabajador.

## Notificacion

Almacena mensajes destinados a usuarios.

## TokenVerificacion

Registra las consultas realizadas sobre tokens de verificación de papeletas.

---

# Jobs periódicos

El backend ejecuta tareas periódicas cada 60 segundos.

Actualmente se realizan tres procesos:

### 1. Revisiones vencidas

Busca papeletas:

```text
EN_REVISION
```

cuya revisión superó el límite establecido.

Las devuelve a:

```text
PENDIENTE
```

### 2. Solicitudes de anulación vencidas

Busca solicitudes:

```text
ANULACION_SOLICITADA
```

cuya ventana temporal terminó y ejecuta la lógica correspondiente.

### 3. Alertas de anulación

Comprueba ventanas próximas a vencer y genera las notificaciones correspondientes.

> Estos procesos se ejecutan dentro del proceso Node.js mediante un temporizador periódico.

---

# Migraciones

El proyecto contiene migraciones Prisma para la estructura actual de la base de datos.

Entre ellas se encuentra la migración inicial y la incorporación de:

```text
fechaRevision
```

en `Papeleta`, utilizada para controlar el tiempo de revisión.

Para aplicar migraciones en desarrollo:

```bash
cd backend
npm run prisma:migrate
```

---

# Scripts disponibles

## Backend

```bash
npm run dev
npm run build
npm start
npm run prisma:migrate
npm run prisma:seed
```

| Script | Función |
|---|---|
| `dev` | Ejecuta el servidor con Nodemon + ts-node |
| `build` | Compila TypeScript |
| `start` | Ejecuta la versión compilada |
| `prisma:migrate` | Ejecuta las migraciones de Prisma |
| `prisma:seed` | Inicializa datos base |

## Frontend

```bash
npm run dev
npm run build
npm run preview
```

| Script | Función |
|---|---|
| `dev` | Servidor de desarrollo Vite |
| `build` | Compilación TypeScript + Vite |
| `preview` | Previsualización de la build |

---

# Cambios recientes

El repositorio cuenta actualmente con dos commits principales:

```text
8836b9f  fix: se solucionaron los problemas de las fechas,
         notificaciones, edicíon y reenvio de papeletas y
         descarga de reportes excel

83e4ebe  Initial commit: Estructura base del proyecto
```

El commit más reciente incorpora principalmente las siguientes mejoras.

## Fechas

Se corrigió el tratamiento de fechas `YYYY-MM-DD` para evitar desfases producidos por conversiones UTC/locales.

Los filtros de:

- asistencias;
- visitas;
- papeletas;
- reportes Excel;

utilizan interpretación de fecha local.

Para fechas finales se considera el final del día:

```text
23:59:59.999
```

## Papeletas

Se incorporó el reenvío de papeletas observadas desde el frontend.

Nueva ruta:

```text
/papeletas/:id/reenviar
```

El formulario puede cargar una papeleta existente y reutilizarla para su corrección y reenvío.

También se ajustaron los filtros del listado y exportación para utilizar:

```text
fechaCreacion
```

como criterio de fecha de la papeleta.

## Notificaciones

Se reorganizó el servicio frontend para exponer:

```text
listarNotificaciones()
```

manteniendo `listar()` como alias de compatibilidad.

## Reportes Excel

Se corrigieron:

- filtros de fecha;
- formato de horas de 24 horas;
- descarga de archivos Excel desde frontend;
- exportación de visitas;
- exportación de papeletas;
- exportación de asistencias;
- formato de encabezados.

La descarga de visitas se realiza directamente como Blob en el navegador.

---

# Consideraciones actuales

Esta sección documenta aspectos importantes del estado actual del proyecto que deben tenerse presentes antes de un despliegue institucional.

## Seguridad

La configuración actual de CORS es permisiva durante el desarrollo.

En producción debe restringirse el origen autorizado del frontend.

Socket.IO también debe configurarse para aceptar únicamente los orígenes necesarios.

## Autenticación

Los JWT se almacenan actualmente en `localStorage`.

Para un despliegue con mayores requisitos de seguridad se debe evaluar el uso de cookies `HttpOnly`, `Secure` y `SameSite`.

## Jobs

Los procesos periódicos se ejecutan dentro del proceso Node.js mediante `setInterval`.

Si posteriormente se ejecutan múltiples instancias del backend, estos jobs deberán migrarse a un mecanismo de scheduler/worker con control de concurrencia.

## Concurrencia

Las operaciones que generan consecutivos de papeletas y algunas transiciones de estado deben endurecerse antes de trabajar con cargas concurrentes importantes.

## Auditoría

Actualmente la papeleta mantiene su estado actual, pero no existe un historial completo de todas las transiciones de estado.

Para un entorno institucional sería recomendable implementar una bitácora de auditoría.

## Validación

Las validaciones principales existen en los servicios, pero sería conveniente incorporar validación estructurada de payloads HTTP mediante una librería de esquemas como Zod.

## Pruebas

No se incluye actualmente una suite de pruebas automatizadas.

Antes de producción se recomienda implementar pruebas unitarias e integración para:

- autenticación;
- permisos;
- asistencias;
- aprobación;
- observación;
- reenvío;
- anulación;
- tokens;
- concurrencia;
- reportes.

## Firma externa

La captura de firma está implementada, pero la subida al almacenamiento externo requiere completar la configuración correspondiente.

---

# Estado funcional

El sistema ha evolucionado desde la estructura inicial del proyecto hasta una aplicación funcional con múltiples módulos implementados.

Actualmente se encuentran implementados:

```text
Autenticación              ✓
Usuarios                   ✓
Jefaturas                 ✓
Asistencias               ✓
Control de presencia      ✓
Papeletas                 ✓
Aprobación jerárquica     ✓
Observación/reenvío        ✓
Rechazo/cancelación       ✓
Anulación                 ✓
Tokens de verificación    ✓
Generación de PDF         ✓
Visitas                   ✓
Notificaciones            ✓
Socket.IO                 ✓
Reportes Excel             ✓
Captura de firma          ✓
Webhook de firma          ✓
```

La integración de almacenamiento externo para firmas se encuentra preparada pero requiere configuración adicional.

---

# Licencia

Este proyecto se distribuye bajo la licencia **MIT**.

Consulta el archivo `LICENSE` incluido en el repositorio para conocer los términos completos.