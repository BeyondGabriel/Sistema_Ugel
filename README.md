<div align="center">

# SIGPER

### Sistema de Gestión de Personal · UGEL Talara

Plataforma web institucional para la gestión del personal de la UGEL Talara: control de asistencias,
papeletas de permiso con aprobación jerárquica, registro de visitantes, notificaciones en tiempo real
y reportes institucionales en Excel y PDF.

**Backend** `Express · Prisma · MySQL` &nbsp;·&nbsp; **Frontend** `React · Vite · Tailwind` &nbsp;·&nbsp; **Tiempo real** `Socket.IO`

</div>

---

## Contenido

1. [Stack tecnológico](#1-stack-tecnológico)
2. [Arquitectura y roles](#2-arquitectura-y-roles)
3. [Módulos del sistema](#3-módulos-del-sistema)
4. [Modelo de datos](#4-modelo-de-datos)
5. [Instalación y despliegue](#5-instalación-y-despliegue)
6. [API endpoints](#6-api-endpoints)
7. [Diseño UI](#7-diseño-ui)
8. [Seguridad](#8-seguridad)
9. [Estructura del repositorio](#9-estructura-del-repositorio)
10. [Licencia](#10-licencia)

---

## 1. Stack tecnológico

### Backend

| Componente | Versión | Uso en SIGPER |
|---|---|---|
| Node.js + TypeScript | `^5.5.4` | Lenguaje y compilación (`tsc`) |
| Express | `^4.19.2` | Servidor HTTP y enrutamiento modular |
| Prisma Client / Prisma CLI | `^5.20.0` | ORM, migraciones y seed |
| MySQL | 8.x | Base de datos relacional (`DATABASE_URL`) |
| Zod | `^4.6.4` | Validación estricta de body, query y params |
| Socket.IO | `^4.7.5` | Notificaciones y eventos en tiempo real |
| JSON Web Token | `^9.0.2` | Sesiones firmadas (normal 8 h / temporal 15 min) |
| bcryptjs | `^2.4.3` | Hash de contraseñas |
| ExcelJS | `^4.4.0` | Exportación de reportes a Excel |
| PDFKit | `^0.15.0` | Generación de papeletas en PDF |
| Helmet | `^8.3.0` | Cabeceras de seguridad HTTP |
| express-rate-limit | `^8.7.0` | Limitación de peticiones en rutas sensibles |
| Multer / CORS / dotenv | `^1.4.5-lts.1` / `^2.8.5` / `^16.4.5` | Carga de archivos, política de origen y variables de entorno |

### Frontend

| Componente | Versión | Uso en SIGPER |
|---|---|---|
| React + React DOM | `^18.3.1` | Interfaz de usuario |
| Vite | `^5.4.2` | Dev server y build de producción |
| TypeScript | `^5.5.4` | Tipado estático extremo a extremo |
| Tailwind CSS | `^3.4.10` | Design System institucional (tokens + clases semánticas) |
| React Router DOM | `^6.26.1` | Rutas protegidas por rol |
| Axios | `^1.7.7` | Cliente HTTP con interceptores JWT |
| Socket.IO Client | `^4.7.5` | Recepción de notificaciones en vivo |
| Headless UI | `^2.1.5` | Diálogos, listas y transiciones accesibles |
| Heroicons | `^2.1.5` | Iconografía |
| PostCSS / Autoprefixer | `^8.4.41` / `^10.4.20` | Pipeline de estilos |

---

## 2. Arquitectura y roles

SIGPER es una aplicación cliente–servidor con tres capas:

```text
React SPA (Vite, :5173)  ──HTTP/JSON + WebSocket──▶  Express API (:3001)  ──Prisma──▶  MySQL 8
        │                                                   │
        └── Design System (Tailwind)                        └── Socket.IO (salas por usuario y ADMIN)
```

- **API REST** bajo el prefijo `/api`, protegida globalmente por `authJWT` + `exigirCambioPassword`.
- **Autorización en dos capas:** `checkRole(...)` en la ruta y control de recurso en el controlador
  (jerarquía viva + delegaciones vigentes).
- **Tiempo real:** cada usuario autenticado se une a la sala `usuario:<id>` y los administradores a
  la sala de ADMIN, que recibe avisos transversales como `papeleta:bloqueada`.

### Los 6 roles

| Rol | Alcance | Responsabilidades principales |
|---|---|---|
| **ADMIN** | Global | Configuración integral: usuarios, jefaturas, delegaciones, desbloqueo y reasignación de aprobadores, anulación de papeletas, supervisión total. |
| **RRHH** | Global | Gestión del personal (alta de usuarios, excepto `ADMIN`), supervisión de asistencias, papeletas y visitas, exportaciones. |
| **DIRECTORA** | Institucional | Máxima autoridad de la jerarquía: aprueba las papeletas de los jefes, firma sus propias papeletas (auto-aprobación) y consulta asistencias y visitas de toda la institución. Puede delegar en un `JEFE`. |
| **JEFE** | Su jefatura | Aprueba las papeletas de su equipo, consulta asistencias y visitas de su equipo, puede delegar la aprobación en un `ESPECIALISTA` de su área. |
| **ESPECIALISTA** | Personal | Solicita papeletas, registra/consulta sus asistencias, ve las visitas que recibió. Puede actuar como encargado de una delegación. |
| **VIGILANTE** | Puerta | Registra entradas y salidas, control de presencia, alta de visitas y registro de salida, verificación de tokens de papeletas. |

### Jerarquía viva (aprobadores)

El aprobador **no se almacena de forma estática**: se resuelve en cada operación a partir de la
jerarquía y de las delegaciones vigentes (`papeleta.service.ts`).

| Solicitante | Aprobador natural |
|---|---|
| `ESPECIALISTA`, `VIGILANTE` | Su jefe inmediato (`jefeId`) |
| `JEFE` | La `DIRECTORA` activa |
| `RRHH`, `ADMIN` | Su jefe inmediato o, si no tiene, la `DIRECTORA` activa |
| `DIRECTORA` | Auto-aprobación (firma sus propias papeletas) |

Reglas de resolución:

1. Si el aprobador natural tiene una **delegación vigente**, la papeleta se enruta al **encargado**.
2. Si el aprobador natural está **inactivo o no disponible** y el solicitante es `JEFE`, la papeleta
   queda **bloqueada** (`requiereAprobadorEspecial`) y visible para el `ADMIN`.
3. Si no existe aprobador natural, se aplica el **respaldo de RRHH**; para `JEFE` se marca como bloqueo.
4. El `ADMIN` puede **desbloquear** la papeleta reasignando un aprobador (`reasignadoPorId`), que
   queda habilitado aunque no sea el aprobador natural.

### Visibilidad por módulo

| Módulo | `ADMIN` / `RRHH` | `DIRECTORA` | `JEFE` | `ESPECIALISTA` | `VIGILANTE` |
|---|---|---|---|---|---|
| **Papeletas** | Todas | Todas | Propias + subordinados directos + las asignadas como aprobador | Propias + las asignadas como aprobador | Todas (control de puerta) |
| **Asistencias** | Todas | Todas (o solo propias con `alcance=propios`) | Su equipo (él + subordinados) o solo propias | Solo propias | Todas |
| **Visitas** | Todas | Todas (o solo propias con `alcance=propios`) | Su equipo o solo propias | Solo las que recibió | Todas |

El parámetro `alcance=propios|equipo` permite a `JEFE` y `DIRECTORA` alternar entre la vista de
equipo y su propio historial. Los demás roles lo ignoran.

---

## 3. Módulos del sistema

### 3.1 Autenticación

- **Login** con email y contraseña (`bcryptjs`). Respuesta `401` genérica ante credenciales
  inválidas, cuentas inexistentes o desactivadas (anti-enumeración).
- **JWT sin datos sensibles:** el token solo contiene el `id` (y la marca `requiereCambioPassword`
  cuando aplica). En cada petición, `authJWT` revalida el usuario contra la base de datos y usa el
  **rol actual**, de modo que un cambio de rol o una desactivación surten efecto de inmediato.
- **Cambio de contraseña obligatorio:** si `cambioPassword = true`, el login emite un token temporal
  de **15 minutos** y `exigirCambioPassword` limita la sesión a `cambiar-password` y `mi-perfil`.
  La sesión normal dura **8 horas**.
- **Rate limiting:** login `5/15 min`, cambio de contraseña `5/15 min`, verificación de token
  `10/10 min` y webhook de firma `5/15 min`.
- **Perfil:** `GET /api/auth/mi-perfil` devuelve los datos de la sesión vigente.

### 3.2 Asistencias

- Registro de movimientos **ENTRADA / SALIDA** con marca de tiempo; se admiten hasta **4 ciclos
  completos por día** (entrada + salida).
- Registro y corrección de movimientos por `VIGILANTE` y `ADMIN`, con guardia temporal de ±1 día.
- **Reloj y presencia en vivo:** pantalla de registro para vigilancia y panel de presencia
  (`PRESENTE` / `AUSENTE`) para jefaturas, RRHH, Dirección y Administración.
- **Vistas por alcance:** `Mis Asistencias` (propias), `Asistencias` (equipo o institución según rol)
  y filtros por usuario, jefatura y rango de fechas.
- **Bloqueos automáticos:** una papeleta aprobada bloquea los movimientos que se solapan con el
  permiso (`aplicarBloqueos`), impidiendo registros inconsistentes.
- **Exportación a Excel** del listado filtrado.

### 3.3 Papeletas

Solicitudes de permiso por **días** (`DIAS`) o por **horas** (`HORAS`, con hora de salida y retorno),
con numeración única `NNNN-AAAA`.

**Flujo de estados**

```text
                        ┌──────────────┐
        crear ─────────▶│  PENDIENTE   │◀──────── reenviar ────────┐
                        └──────┬───────┘                          │
                               │ iniciar revisión (20 min máx.)   │
                               ▼                                  │
                        ┌──────────────┐   observar   ┌───────────┴──┐
                        │ EN_REVISION  │─────────────▶│  OBSERVADO   │
                        └──────┬───────┘              └──────────────┘
                    aprobar    │    rechazar
                               ▼           ▼
                        ┌───────────┐  ┌────────────┐
                        │ APROBADO  │  │ RECHAZADO  │
                        └─────┬─────┘  └────────────┘
     solicitud de anulación    │
                               ▼
                   ┌──────────────────────┐   anular   ┌──────────┐
                   │ ANULACION_SOLICITADA │───────────▶│ ANULADO  │
                   └──────────────────────┘            └──────────┘
                              cancelar (solicitante) ──▶ CANCELADO
```

- **Revisión con timeout:** al abrir una papeleta pasa a `EN_REVISION`; si no se resuelve en
  **20 minutos**, un job periódico la devuelve a `PENDIENTE` y notifica al aprobador.
- **Token de verificación:** al aprobar se genera un token de **6 caracteres**; el personal de puerta
  lo valida en `POST /api/papeletas/verificar-token` (con visibilidad y rate limiting).
- **Documento PDF** por papeleta y **firma externa** recibida vía webhook autenticado.
- **Delegaciones de aprobación:** el `ADMIN` registra una delegación temporal de un `JEFE` hacia un
  `ESPECIALISTA` de su misma jefatura, o de la `DIRECTORA` hacia un `JEFE`. Mientras está vigente
  (`activo`, `fechaInicio ≤ ahora ≤ fechaFin`), las papeletas del titular se enrutan al encargado,
  que puede verlas y aprobarlas. Las delegaciones se pueden anular con motivo.
- **Desbloqueo administrativo:** las papeletas bloqueadas por falta de aprobador quedan visibles para
  el `ADMIN`, que reasigna un aprobador y registra quién lo hizo (`reasignadoPorId`).
- **Anulación con ventana temporal:** solicitud de anulación del aprobador, cierre automático de la
  ventana y recordatorios cada 20 minutos.

### 3.4 Visitas

- Registro de visitantes con **nombre** y **DNI de 8 dígitos**, por `VIGILANTE` o `ADMIN`.
- Solo se permite registrar la visita si el trabajador visitado está **presente** en el edificio.
- Registro de **hora de entrada** y **hora de salida**; historial filtrable por fechas, trabajador
  visitado y registrador.
- Control de acceso digital: la identificación del visitante se gestiona íntegramente en el registro
  (no se emiten credenciales físicas).
- Exportación del historial a Excel.

### 3.5 Notificaciones

- Notificaciones persistentes por usuario (`Notificacion`) con estado leído/no leído.
- Entrega en tiempo real mediante **Socket.IO** a la sala `usuario:<id>`.
- Campanita en el layout con contador de no leídas, marcado individual y "marcar todas como leídas".
- Avisos de cambios de papeleta, bloqueos, delegaciones y cierre de ventanas de anulación.

### 3.6 Reportes

| Reporte | Formato | Endpoint |
|---|---|---|
| Asistencias | Excel (`.xlsx`) | `GET /api/asistencias/exportar` |
| Papeletas | Excel (`.xlsx`) | `GET /api/papeletas/exportar` |
| Visitas | Excel (`.xlsx`) | `GET /api/visitas/exportar` |
| Papeleta individual | PDF | `GET /api/papeletas/:id/pdf` |

Las exportaciones respetan el mismo criterio de visibilidad y alcance que los listados.

### 3.7 Administración

- **Usuarios:** alta (ADMIN/RRHH), edición, desactivación, asignación de jefe inmediato y de jefatura.
  Se protege al último `ADMIN` activo y RRHH no puede crear administradores.
- **Jefaturas:** las cuatro jefaturas oficiales (`Dirección`, `Gestión Pedagógica`,
  `Unidad de Administración`, `UPDI`) se crean en el seed y no pueden eliminarse; el `ADMIN` puede
  añadir jefaturas internas.
- **Delegaciones:** creación y anulación exclusivas del `ADMIN`; consulta para titulares y encargados.

---

## 4. Modelo de datos

Definido en `backend/prisma/schema.prisma` sobre MySQL.

| Modelo | Descripción | Campos clave |
|---|---|---|
| **Usuario** | Personal de la UGEL y su posición en la jerarquía | `email`, `password`, `rol`, `activo`, `cambioPassword`, `nombres`, `apellidos`, `tituloFormal`, `noDisponible`, `jefaturaId`, `jefeId`, `encargadoTemporalId` |
| **Jefatura** | Área organizacional y su cabeza visible | `nombre`, `descripcion`, `esOficial`, `jefeId` |
| **Movimiento** | Marca de asistencia | `usuarioId`, `tipo` (`ENTRADA`/`SALIDA`), `timestamp`, `bloqueado` |
| **Papeleta** | Permiso solicitado y su ciclo de vida | `numero`, `solicitanteId`, `aprobadorId`, `tipoTiempo`, `fechaInicio`, `fechaFin`, `horaSalida`, `horaRetorno`, `motivo`, `estado`, `token`, `fechaRevision`, `requiereAprobadorEspecial`, `reasignadoPorId`, `anuladoPorAdmin`, `firmaExternaSvg` |
| **Delegacion** | Delegación temporal de la facultad de aprobar | `titularId`, `encargadoId`, `motivo`, `documentoRef`, `fechaInicio`, `fechaFin`, `activo`, `creadoPorId` |
| **Visita** | Visitante y su permanencia en la sede | `visitanteNombre`, `visitanteDni`, `trabajadorVisitadoId`, `registradorId`, `horaEntrada`, `horaSalida` |
| **Notificacion** | Aviso persistente para un usuario | `usuarioId`, `mensaje`, `leida`, `fecha` |
| **TokenVerificacion** | Traza de cada consulta de token | `token`, `papeletaId`, `usuarioConsultanteId`, `fechaConsulta` |

**Enumeraciones**

| Enum | Valores |
|---|---|
| `Rol` | `VIGILANTE`, `ESPECIALISTA`, `JEFE`, `DIRECTORA`, `RRHH`, `ADMIN` |
| `TipoMovimiento` | `ENTRADA`, `SALIDA` |
| `TipoTiempo` | `DIAS`, `HORAS` |
| `EstadoPapeleta` | `PENDIENTE`, `EN_REVISION`, `OBSERVADO`, `APROBADO`, `RECHAZADO`, `CANCELADO`, `ANULADO`, `ANULACION_SOLICITADA` |

Migraciones: el historial consta de **7 migraciones** en `backend/prisma/migrations`, entre ellas la
del Bloque A (jerarquía, delegaciones, reasignación de aprobadores y ajustes de notificaciones).

---

## 5. Instalación y despliegue

### Requisitos

- **Node.js 18+** y npm
- **MySQL 8.x** en ejecución con una base de datos vacía
- Puerto `3001` (API) y `5173` (frontend en desarrollo) disponibles

### 5.1 Clonar e instalar

```bash
git clone <url-del-repositorio> Sistema_Ugel
cd Sistema_Ugel/backend
npm install

cd ../frontend
npm install
```

### 5.2 Variables de entorno

**`backend/.env`**

```env
# Conexión MySQL
DATABASE_URL="mysql://usuario:password@localhost:3306/sigper"

# Firma de los JWT (obligatorio)
JWT_SECRET="cadena-larga-y-aleatoria"

# Puerto de la API
PORT=3001

# Origen permitido por CORS y Socket.IO (obligatorio)
FRONTEND_ORIGIN="http://localhost:5173"

# Secreto compartido del webhook de firma externa
WEBHOOK_SECRET="cadena-larga-y-aleatoria"
```

> `FRONTEND_ORIGIN` y `JWT_SECRET` no tienen valor por defecto: la API no arranca / no autentica si
> faltan.

**`frontend/.env`**

```env
VITE_API_URL=http://localhost:3001/api
```

En desarrollo, Vite además redirige `/api` y `/socket.io` a `http://localhost:3001` (`vite.config.ts`).

### 5.3 Preparar la base de datos

```bash
cd backend

npx prisma generate
npx prisma migrate deploy     # aplica las migraciones existentes
npx prisma migrate dev        # alternativa en desarrollo (crea migraciones)
npm run prisma:seed           # jefaturas oficiales + usuario administrador
```

El seed crea las jefaturas `Dirección`, `Gestión Pedagógica`, `Unidad de Administración`, `UPDI`
(oficiales, no eliminables) más las áreas de apoyo, y un usuario `admin@ugeltalara.gob.pe` con
contraseña aleatoria de 16 caracteres **impresa una sola vez en la consola**. El primer inicio de
sesión obliga a cambiarla.

### 5.4 Ejecutar en desarrollo

```bash
# Terminal 1
cd backend && npm run dev      # API en http://localhost:3001

# Terminal 2
cd frontend && npm run dev     # UI en http://localhost:5173
```

Comprobación rápida: `GET http://localhost:3001/api/health` → `{ "estado": "ok" }`.

### 5.5 Build de producción

```bash
cd backend
npm run build                  # compila TypeScript en dist/
npm start                      # node dist/server.js

cd ../frontend
npm run build                  # genera dist/ estático
npm run preview                # verificación local del build
```

El contenido de `frontend/dist` puede servirse con Nginx o Apache; la API debe quedar accesible en
el mismo origen o detrás de un proxy inverso, y `FRONTEND_ORIGIN` debe apuntar al dominio público.

### 5.6 Scripts disponibles

| Ubicación | Script | Acción |
|---|---|---|
| `backend` | `npm run dev` | Servidor con `nodemon` + `ts-node` |
| `backend` | `npm run build` | Compilación TypeScript |
| `backend` | `npm start` | Ejecuta `dist/server.js` |
| `backend` | `npm run prisma:migrate` | `prisma migrate dev` |
| `backend` | `npm run prisma:seed` | Carga de datos iniciales |
| `frontend` | `npm run dev` | Vite en modo desarrollo |
| `frontend` | `npm run build` | `tsc` + build de Vite |
| `frontend` | `npm run preview` | Sirve el build localmente |

---

## 6. API endpoints

Todas las rutas cuelgan de `/api`. Salvo login y health, toda petición requiere
`Authorization: Bearer <token>`.

### Autenticación y sistema

| Método | Endpoint | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/login` | Público | Inicia sesión; token temporal si debe cambiar contraseña |
| `POST` | `/api/auth/cambiar-password` | Autenticado | Cambio de contraseña (obligatorio en el primer ingreso) |
| `GET` | `/api/auth/mi-perfil` | Autenticado | Datos del usuario de la sesión |
| `GET` | `/api/health` | Público | Estado del servicio |

### Usuarios, jefaturas y delegaciones

| Método | Endpoint | Roles | Descripción |
|---|---|---|---|
| `POST` | `/api/usuarios` | ADMIN, RRHH | Crea usuario (RRHH no puede crear ADMIN) |
| `GET` | `/api/usuarios` | ADMIN, RRHH, VIGILANTE | Lista usuarios (proyección mínima para VIGILANTE) |
| `GET` | `/api/usuarios/:id` | ADMIN, RRHH | Detalle de usuario |
| `PUT` | `/api/usuarios/:id` | ADMIN | Edita usuario |
| `PUT` | `/api/usuarios/:id/desactivar` | ADMIN | Desactiva la cuenta (protege al último ADMIN) |
| `POST` | `/api/usuarios/asignar-jefe` | ADMIN | Asigna jefe inmediato |
| `GET` | `/api/jefaturas` | Autenticado | Lista jefaturas y su jefe |
| `POST` | `/api/jefaturas` | ADMIN | Crea jefatura interna |
| `PUT` | `/api/jefaturas/:id` | ADMIN | Edita jefatura |
| `DELETE` | `/api/jefaturas/:id` | ADMIN | Elimina jefatura (no oficial) |
| `GET` | `/api/delegaciones` | ADMIN, JEFE, DIRECTORA | Lista delegaciones (filtro `soloVigentes`) |
| `POST` | `/api/delegaciones` | ADMIN | Crea delegación de aprobación |
| `PUT` | `/api/delegaciones/:id/anular` | ADMIN | Anula una delegación |

### Asistencias

| Método | Endpoint | Roles | Descripción |
|---|---|---|---|
| `POST` | `/api/asistencias` | VIGILANTE, ADMIN | Registra `ENTRADA`/`SALIDA` |
| `PUT` | `/api/asistencias/:id` | VIGILANTE, ADMIN | Corrige un movimiento (±1 día) |
| `GET` | `/api/asistencias` | Todos los roles | Listado con `alcance=propios\|equipo` y filtros |
| `GET` | `/api/asistencias/presencia` | VIGILANTE, ADMIN, RRHH, JEFE, DIRECTORA | Presencia del día |
| `GET` | `/api/asistencias/exportar` | VIGILANTE, ADMIN, RRHH | Exportación a Excel |

### Papeletas

| Método | Endpoint | Roles | Descripción |
|---|---|---|---|
| `POST` | `/api/papeletas` | Todos los roles | Crea papeleta (`DIAS` o `HORAS`) |
| `GET` | `/api/papeletas` | Autenticado | Listado según visibilidad y filtros |
| `GET` | `/api/papeletas/:id` | Autenticado | Detalle con control de visibilidad |
| `GET` | `/api/papeletas/:id/pdf` | Autenticado | PDF de la papeleta |
| `GET` | `/api/papeletas/exportar` | Autenticado | Exportación a Excel |
| `POST` | `/api/papeletas/verificar-token` | Autenticado | Valida el token de una papeleta aprobada |
| `PUT` | `/api/papeletas/:id/revisar` | ADMIN, RRHH, DIRECTORA, JEFE | Inicia revisión (`EN_REVISION`) |
| `PUT` | `/api/papeletas/:id/aprobar` | ADMIN, RRHH, DIRECTORA, JEFE | Aprueba y genera token |
| `PUT` | `/api/papeletas/:id/observar` | ADMIN, RRHH, DIRECTORA, JEFE | Observa con motivo |
| `PUT` | `/api/papeletas/:id/rechazar` | ADMIN, RRHH, DIRECTORA, JEFE | Rechaza con motivo |
| `PUT` | `/api/papeletas/:id/desbloquear` | ADMIN | Reasigna aprobador en papeleta bloqueada |
| `PUT` | `/api/papeletas/:id/cancelar` | Solicitante | Cancela su solicitud |
| `PUT` | `/api/papeletas/:id/reenviar` | Solicitante | Reenvía una papeleta observada |
| `PUT` | `/api/papeletas/:id/anular` | Aprobador / ADMIN | Anula una papeleta aprobada |
| `POST` | `/api/papeletas/:id/solicitar-anulacion` | Aprobador | Abre la ventana de anulación |
| `POST` | `/api/papeletas/:id/cancelar-solicitud-anulacion` | Aprobador | Cancela la solicitud de anulación |

### Visitas, notificaciones y firma externa

| Método | Endpoint | Roles | Descripción |
|---|---|---|---|
| `POST` | `/api/visitas` | VIGILANTE, ADMIN | Registra visitante (requiere trabajador presente) |
| `GET` | `/api/visitas` | Todos los roles | Listado con `alcance` y filtros |
| `GET` | `/api/visitas/:id` | Todos los roles | Detalle de la visita |
| `PUT` | `/api/visitas/:id/salida` | VIGILANTE, ADMIN | Registra hora de salida |
| `GET` | `/api/visitas/exportar` | Todos los roles | Exportación a Excel |
| `GET` | `/api/notificaciones` | Autenticado | Lista notificaciones del usuario |
| `PUT` | `/api/notificaciones/:id/leer` | Autenticado | Marca una notificación como leída |
| `PUT` | `/api/notificaciones/leer-todas` | Autenticado | Marca todas como leídas |
| `POST` | `/api/firmas/webhook` | Secreto `x-webhook-secret` | Recepción de firma externa (rate limit `5/15 min`) |

---

## 7. Diseño UI

La interfaz está **100 % migrada** al Design System institucional de **tema claro**
(navy + amarillo + azul + blanco), definido en `frontend/tailwind.config.js` y
`frontend/src/index.css`. Ya no queda ninguna pantalla con el tema oscuro anterior.

### Paleta institucional

| Token | Hex | Uso |
|---|---|---|
| `brand-navy` | `#0A1D3D` | Sidebar, top bar, títulos |
| `brand-navyLight` / `navy-light` | `#1E3A5F` | Hover del sidebar |
| `brand-yellow` | `#F5C518` | Acentos, badges, ítem activo del menú |
| `brand-yellowDark` / `yellow-dark` | `#D4A800` | Hover del amarillo (nunca como texto) |
| `brand-blue` | `#2563EB` | Botones primarios y enlaces |
| `brand-blueHover` / `blue-hover` | `#1D4ED8` | Hover del azul |
| `surface-bg` | `#F5F7FA` | Fondo del área de contenido |
| `surface-card` | `#FFFFFF` | Tarjetas y superficies |
| `content-primary` | `#0F172A` | Texto principal |
| `content-secondary` | `#64748B` | Texto secundario |
| `content-tertiary` | `#94A3B8` | Pistas y placeholders |
| `content-onYellow` / `on-yellow` | `#0A1D3D` | Único color válido sobre amarillo |
| `line-light` / `line-strong` | `#E2E8F0` / `#CBD5E1` | Bordes |
| `state-success` | `#E8F8F0` / `#047857` | Fondo / texto de éxito |
| `state-warning` | `#FEF9E7` / `#8A6D00` | Fondo / texto de advertencia |
| `state-error` | `#FEE9E9` / `#C81E1E` | Fondo / texto de error |
| `state-info` | `#E8F3FE` / `#2563EB` | Fondo / texto informativo |

- **Radios:** `rounded-ds-sm` 6px · `ds-md` 10px · `ds-lg` 14px · `ds-xl` 20px.
- **Sombras:** `shadow-card`, `shadow-hover`, `shadow-modal`.
- **Clases semánticas:** `.card`, `.kpi-card`, `.btn-primary|secondary|danger|ghost`, `.input-field`,
  `.badge-success|warning|error|info`, `.heading-1|2|3`, `.body-text`, `.body-muted`, `.caption`.
- **Accesibilidad:** todos los pares fondo/texto de las clases semánticas cumplen **WCAG AA**
  (≥ 4.5:1). Regla dura: sobre `bg-brand-yellow` solo se usa `text-content-onYellow` (nunca blanco).
- **Demo viva:** la ruta pública `/design-system` documenta tokens, componentes y contrastes.

### Dashboards por rol

`DashboardPage` selecciona la vista según el rol de la sesión:

| Rol | Dashboard | Contenido principal |
|---|---|---|
| `ADMIN` | `AdminDashboard` | Usuarios, jefaturas, papeletas bloqueadas, delegaciones |
| `RRHH` | `RrhhDashboard` | Personal, asistencias y papeletas del día |
| `DIRECTORA` | `DirectoraDashboard` | Papeletas de jefes pendientes, presencia y ausencias institucionales, delegaciones vigentes |
| `JEFE` | `JefeDashboard` | Papeletas de su equipo, presencia del equipo, delegaciones |
| `ESPECIALISTA` | `EspecialistaDashboard` | Sus papeletas, sus asistencias y sus visitas recibidas |
| `VIGILANTE` | `VigilanteDashboard` | Registro de movimientos, presencia y visitas del día |

### Pantallas del frontend

| Módulo | Rutas / páginas |
|---|---|
| Autenticación | `/login` · `/cambiar-password` |
| Dashboard | `/dashboard` (6 dashboards por rol) · 404 |
| Asistencias | `/asistencias/registro` · `/asistencias` · `/mis-asistencias` |
| Papeletas | `/papeletas` · `/papeletas/nueva` · `/papeletas/:id` · `/papeletas/:id/reenviar` · `/verificar-token` |
| Visitas | `/visitas` · `/visitas/registro` |
| Notificaciones | `/notificaciones` |
| Administración | `/usuarios` · `/usuarios/nuevo` · `/usuarios/:id/editar` · `/jefaturas` · `/delegaciones` |
| Demo | `/design-system` |

Todas las rutas (excepto login, cambio de contraseña y la demo) viven dentro de `ProtectedRoute`,
que exige sesión activa y aplica el layout con sidebar, top bar y campanita de notificaciones.

---

## 8. Seguridad

| Control | Implementación |
|---|---|
| Autenticación | JWT firmado con `JWT_SECRET`; `authJWT` revalida usuario, rol, estado y `cambioPassword` en cada petición |
| Contraseñas | `bcryptjs` (10 rondas); cambio obligatorio en el primer ingreso |
| Autorización | `checkRole(...)` por ruta + control de recurso (jerarquía viva, delegaciones y visibilidad) |
| Validación de entrada | Esquemas Zod `.strict()` para body, query y params en todos los módulos |
| Rate limiting | Login y cambio de contraseña `5/15 min`; verificación de token `10/10 min`; webhook `5/15 min` |
| Cabeceras | `helmet()` y `express.json({ limit: '100kb' })` |
| CORS | Origen único configurable mediante `FRONTEND_ORIGIN` (también para Socket.IO) |
| Webhook de firma | Secreto compartido en cabecera `x-webhook-secret` + rate limiting específico |
| Socket.IO | Autenticación por JWT en el handshake y salas por usuario/ADMIN |
| Anti-enumeración | Respuesta `401` genérica en login para cuentas inexistentes, inactivas o con contraseña errónea |

---

## 9. Estructura del repositorio

```text
Sistema_Ugel/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Modelos, enums y relaciones
│   │   ├── seed.ts                # Jefaturas oficiales + ADMIN inicial
│   │   └── migrations/            # Historial de migraciones
│   └── src/
│       ├── app.ts                 # Configuración de Express
│       ├── server.ts              # HTTP + Socket.IO + jobs periódicos
│       ├── controllers/           # auth, usuarios, asistencias, papeletas...
│       ├── routes/                # 9 routers montados bajo /api
│       ├── middlewares/           # authJWT, checkRole, validate, rateLimit, exigirCambioPassword
│       ├── schemas/               # Validación Zod por módulo
│       ├── services/              # jerarquía, delegaciones, bloqueos, PDF, visibilidad
│       ├── sockets/               # Salas y emisión de eventos
│       └── utils/                 # Prisma, fechas, passwords, tokens
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Rutas y providers
│   │   ├── index.css              # Design System (clases semánticas)
│   │   ├── components/            # Layout, Sidebar, UI (Button, Card, Input, Modal, Toast)
│   │   ├── contexts/              # Auth, Socket, Toast
│   │   ├── pages/                 # 25 páginas por módulo y rol
│   │   ├── services/              # Clientes Axios por módulo
│   │   └── types/                 # Tipos compartidos
│   ├── tailwind.config.js         # Tokens del Design System
│   └── DESIGN.md                  # Documentación de la paleta y contrastes
├── implementationplan.md          # Auditorías de seguridad y fases del proyecto
├── LICENSE
└── README.md
```

---

## 10. Licencia

Distribuido bajo licencia **MIT**. Consulta [`LICENSE`](./LICENSE) para más detalles.

<div align="center">

**SIGPER** · Sistema de Gestión de Personal · UGEL Talara

</div>
