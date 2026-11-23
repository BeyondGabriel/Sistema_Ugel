<div align="center">

# SIGPER

### Sistema de Gestión de Personal · UGEL Talara

Plataforma web institucional para la gestión del personal de la UGEL Talara: control de asistencias,
papeletas de permiso con aprobación jerárquica, vacaciones con VoBo y aprobación final, registro de
visitantes, notificaciones en tiempo real y reportes institucionales en Excel y PDF.

La interfaz está **100 % migrada al tema claro institucional** (navy + amarillo + azul + blanco),
definido como Design System sobre Tailwind CSS.

**Backend** `Express · Prisma · MySQL` &nbsp;·&nbsp; **Frontend** `React · Vite · Tailwind` &nbsp;·&nbsp; **Tiempo real** `Socket.IO`

</div>

---

## Contenido

1. [Stack tecnológico](#1-stack-tecnológico)
2. [Arquitectura y roles](#2-arquitectura-y-roles)
3. [Módulos del sistema](#3-módulos-del-sistema)
   - [3.1 Autenticación](#31-autenticación)
   - [3.2 Asistencias](#32-asistencias)
   - [3.3 Papeletas](#33-papeletas)
   - [3.4 Vacaciones](#34-vacaciones)
   - [3.5 Visitas](#35-visitas)
   - [3.6 Dashboards por rol](#36-dashboards-por-rol)
   - [3.7 Notificaciones](#37-notificaciones)
   - [3.8 Reportes](#38-reportes)
   - [3.9 Administración](#39-administración)
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
| Node.js | 18+ | Runtime del servidor |
| Express | `^4.19.2` | Servidor HTTP y 10 routers modulares |
| Prisma Client / Prisma CLI | `^5.20.0` | ORM, migraciones y seed |
| MySQL | 8.x | Base de datos relacional (`DATABASE_URL`) |
| TypeScript / ts-node | `^5.5.4` / `^10.9.2` | Tipado y ejecución en desarrollo |
| Zod | `^4.6.4` | Validación estricta de body, query y params |
| Socket.IO | `^4.7.5` | Notificaciones y eventos en tiempo real |
| JSON Web Token | `^9.0.2` | Sesiones firmadas (normal 8 h / temporal 15 min) |
| bcryptjs | `^2.4.3` | Hash de contraseñas (10 rondas) |
| ExcelJS | `^4.4.0` | Exportación de asistencias, papeletas, visitas y vacaciones |
| PDFKit | `^0.15.0` | Papeletas y solicitudes de vacaciones en PDF |
| Helmet | `^8.3.0` | Cabeceras de seguridad HTTP |
| express-rate-limit | `^8.7.0` | Limitación de peticiones en rutas sensibles |
| CORS / dotenv | `^2.8.5` / `^16.4.5` | Política de origen y variables de entorno |
| Multer | `^1.4.5-lts.1` | Dependencia instalada sin uso actual (el sistema no recibe archivos). |

### Frontend

| Componente | Versión | Uso en SIGPER |
|---|---|---|
| React + React DOM | `^18.3.1` | Interfaz de usuario |
| Vite | `^5.4.2` | Dev server, proxy `/api` + `/socket.io` y build de producción |
| TypeScript | `^5.5.4` | Tipado estático extremo a extremo |
| Tailwind CSS | `^3.4.10` | Design System institucional (tokens + clases semánticas) |
| React Router DOM | `^6.26.1` | Rutas protegidas por rol y carga diferida (`lazy`) |
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
        └── Design System (Tailwind, tema claro)            └── Socket.IO (salas por usuario y ADMIN)
```

- **API REST** bajo el prefijo `/api`, protegida globalmente por `authJWT` + `exigirCambioPassword`
  (excepto login, health y el webhook de firma externa, que se autentica por HMAC).
- **Autorización en dos capas:** `checkRole(...)` en la ruta y control de recurso en el controlador
  (jerarquía viva, delegaciones vigentes y visibilidad por módulo).
- **Tiempo real:** cada usuario autenticado se une a la sala `usuario:<id>` y los administradores a
  la sala de ADMIN, que recibe avisos transversales como `papeleta:bloqueada`.
- **Dashboards por rol:** `DashboardPage` selecciona la vista de KPIs según el rol autenticado
  (`AdminDashboard`, `RrhhDashboard`, `DirectoraDashboard`, `JefeDashboard`,
  `EspecialistaDashboard`, `VigilanteDashboard`).

### Los 6 roles

| Rol | Alcance | Responsabilidades principales |
|---|---|---|
| **ADMIN** | Global | Configuración integral: usuarios, jefaturas, delegaciones, desbloqueo y reasignación de aprobadores, anulación de papeletas, carga de saldos de vacaciones y supervisión total. |
| **RRHH** | Global | Gestión del personal (alta de usuarios, excepto `ADMIN`), supervisión de asistencias, papeletas y visitas, **aprobación final de vacaciones y registro de saldos anuales**, exportaciones. |
| **DIRECTORA** | Institucional | Máxima autoridad de la jerarquía: aprueba las papeletas de los jefes, firma sus propias papeletas (auto-aprobación), otorga VoBo a solicitudes de vacaciones y consulta asistencias y visitas de toda la institución. Su facultad de aprobar puede delegarse (registrada por `ADMIN`) en un `JEFE`. |
| **JEFE** | Su jefatura | Aprueba las papeletas de su equipo, otorga el **VoBo de vacaciones** de sus subordinados, consulta asistencias y visitas de su equipo. Su facultad de aprobar puede delegarse (registrada por `ADMIN`) en un `ESPECIALISTA` de su área. |
| **ESPECIALISTA** | Personal | Solicita papeletas y vacaciones, consulta sus asistencias y ve las visitas que recibió. Puede actuar como encargado de una delegación. |
| **VIGILANTE** | Puerta | Registra entradas y salidas, control de presencia, alta de visitas y registro de salida, verificación de tokens de papeletas. También solicita sus propias papeletas y vacaciones. |

### Jerarquía viva (aprobadores de papeletas)

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

### Delegaciones de aprobación

El modelo `Delegacion` registra una **sustitución temporal de la facultad de aprobar**:

| Campo | Significado |
|---|---|
| `titularId` | Usuario que delega (`JEFE` o `DIRECTORA`). |
| `encargadoId` | Usuario que asume la aprobación durante la vigencia. |
| `motivo`, `documentoRef` | Sustento y referencia documental de la delegación. |
| `fechaInicio`, `fechaFin` | Ventana temporal de la sustitución. |
| `activo` | Permite anularla sin borrar el historial. |
| `creadoPorId` | `ADMIN` que la registró. |

- Una delegación está **vigente** cuando `activo = true` y `fechaInicio ≤ ahora ≤ fechaFin`.
- Mientras está vigente, las papeletas que corresponderían al titular se enrutan automáticamente al
  encargado, que puede verlas y aprobarlas.
- La creación y la anulación son exclusivas del `ADMIN`; el listado también lo consultan `JEFE` y
  `DIRECTORA` para ver sus propias delegaciones en el dashboard.
- El **VoBo de vacaciones** se asigna al jefe inmediato (`jefeId`) al crear la solicitud y no se
  enruta por delegación; el flujo vacacional se explica en [3.4](#34-vacaciones).

### Visibilidad por módulo

| Módulo | `ADMIN` / `RRHH` | `DIRECTORA` | `JEFE` | `ESPECIALISTA` | `VIGILANTE` |
|---|---|---|---|---|---|
| **Papeletas** | Todas | Todas | Propias + subordinados directos + las asignadas como aprobador | Propias + las asignadas como aprobador | Todas (control de puerta) |
| **Asistencias** | Todas | Todas (o solo propias con `alcance=propios`) | Su equipo (él + subordinados) o solo propias | Solo propias | Todas |
| **Visitas** | Todas | Todas (o solo propias con `alcance=propios`) | Su equipo o solo propias | Solo las que recibió | Todas |
| **Vacaciones** | Todas | Todas | Propias + subordinados directos | Solo propias | Solo propias |

El parámetro `alcance=propios` permite a `JEFE` y `DIRECTORA` limitar los listados de **asistencias y
visitas** a su propio historial; sin él, cada rol usa su alcance por defecto (equipo para `JEFE`,
institucional para `DIRECTORA`). Los demás roles no lo utilizan.

---

## 3. Módulos del sistema

### 3.1 Autenticación

- **Login** con email y contraseña (`bcryptjs`). Respuesta `401` genérica ante credenciales
  inválidas, cuentas inexistentes o desactivadas (anti-enumeración).
- **JWT sin datos sensibles:** el token solo contiene el `id`, la marca `requiereCambioPassword`
  (cuando aplica) y la `tokenVersion`. En cada petición, `authJWT` revalida el usuario contra la base
  de datos y usa el **rol actual**, de modo que un cambio de rol o una desactivación surten efecto de
  inmediato.
- **Cambio de contraseña obligatorio:** si `cambioPassword = true`, el login emite un token temporal
  de **15 minutos** y `exigirCambioPassword` limita la sesión a `cambiar-password` y `mi-perfil`.
  La sesión normal dura **8 horas**.
- **Revocación de sesión (H-07):** `Usuario.tokenVersion` se incluye en cada JWT. Al cambiar la
  contraseña se incrementa `tokenVersion` en la misma actualización, de modo que **todos los tokens
  emitidos antes quedan invalidados** en la API y en el handshake de Socket.IO.
- **Rate limiting:** login `5/15 min`, cambio de contraseña `5/15 min`, verificación de token
  `10/10 min` y webhook de firma `5/15 min`.
- **Perfil:** `GET /api/auth/mi-perfil` devuelve los datos de la sesión vigente.

### 3.2 Asistencias

- Registro de movimientos **ENTRADA / SALIDA** con marca de tiempo; se admiten hasta **4 ciclos
  completos por día** (entrada + salida).
- Registro y corrección de movimientos por `VIGILANTE` y `ADMIN`; el alta exige un timestamp dentro
  de **±1 día** y el `VIGILANTE` solo puede editar movimientos de hasta **7 días** de antigüedad.
- **Reloj y presencia en vivo:** pantalla de registro para vigilancia y panel de presencia
  (`PRESENTE` / `AUSENTE`) para jefaturas, RRHH, Dirección y Administración.
- **Vistas por alcance:** `Mis Asistencias` (propias), `Asistencias` (equipo o institución según rol)
  y filtros por usuario, jefatura y rango de fechas.
- **Auditoría de autoría (B-03):** cada `Movimiento` guarda `registradoPorId` (quién lo creó) y
  `editadoPorId` (quién lo modificó por última vez, `null` si nunca se editó). Los campos de autoría usan
  `onDelete: SetNull`, por lo que la trazabilidad no bloquea la baja de usuarios.
- **Bloqueos automáticos:** una papeleta APROBADA o una vacación APROBADA bloquea los movimientos que
  se solapan con el permiso (`verificarBloqueo`). Una papeleta `DIAS` o una vacación `DIA_COMPLETO`
  bloquea el día calendario completo; una papeleta `HORAS` o una vacación `MEDIO_DIA` bloquea
  únicamente el intervalo solicitado. El intento de registro devuelve `409`.
- Los bloqueos **no se materializan** como filas: se calculan al vuelo y se liberan solos cuando el
  documento deja de estar en estado APROBADO.
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
  **20 minutos**, un job periódico (cada 60 s) la devuelve a `PENDIENTE` y notifica al solicitante
  y al aprobador.
- **Token de verificación:** al aprobar se genera un token de **6 caracteres**; el personal de puerta
  lo valida en `POST /api/papeletas/verificar-token` (con visibilidad y rate limiting).
- **Documento PDF** por papeleta y **firma externa** recibida vía webhook autenticado.
- **Delegaciones de aprobación:** el `ADMIN` registra una delegación temporal de un `JEFE` hacia un
  `ESPECIALISTA` de su misma jefatura, o de la `DIRECTORA` hacia un `JEFE`. Mientras está vigente,
  las papeletas del titular se enrutan al encargado, que puede verlas y aprobarlas. Las delegaciones
  se pueden anular con motivo.
- **Desbloqueo administrativo:** las papeletas bloqueadas por falta de aprobador quedan visibles para
  el `ADMIN`, que reasigna un aprobador y registra quién lo hizo (`reasignadoPorId`).
- **Anulación con ventana temporal:** el solicitante pide la anulación, el aprobador vigente (o el
  `ADMIN`) la ejecuta con motivo mientras la ventana siga abierta, el cierre de esa ventana se procesa
  automáticamente y se envían recordatorios cada **20 minutos** cuando falta una hora o menos.

### 3.4 Vacaciones

Módulo completo de vacaciones con saldo anual, reglas de fraccionamiento, flujo de VoBo y aprobación
final, y documentos oficiales.

**Entidades**

| Modelo | Rol en el módulo |
|---|---|
| `VacacionSaldo` | Saldo anual por usuario y año (`@@unique[usuarioId, anio]`). `diasGanados` arranca en **30.00** y `diasUsados` acumula lo consumido. |
| `SolicitudVacacion` | Solicitud con `tipo` (`DIA_COMPLETO` / `MEDIO_DIA`), rango de fechas, horas (medio día), `diasDescontados`, estado, `aprobadorId` (VoBo) y `rrhhId` (aprobación final). |
| `RolVacaciones` | Bloques de rol vacacional programados por año (`esBloquePrincipal`), estructura de planificación anual. |

**Tipos de solicitud**

- `DIA_COMPLETO`: rango de fechas inclusive; descuenta **1.00 día** por día calendario del rango.
- `MEDIO_DIA`: una sola fecha y un bloque de **exactamente 4 horas** (`horaInicio`–`horaFin`);
  descuenta **0.50 días**.

**Reglas de negocio** (`vacacion.service.ts`)

1. **Saldo suficiente:** los días solicitados no pueden superar `diasGanados − diasUsados`.
2. **Fraccionamiento:** los medios días vigentes del año no pueden superar el equivalente a
   **7 días hábiles (14 medios días)**.
3. **Bloque principal:** mientras no exista una solicitud **vigente** (`APROBADA` o `CON_VB`) en el año,
   la primera solicitud de día completo debe ser un bloque continuo de **mínimo 7 días calendario**
   (Art. 43.1 del reglamento interno).
4. Si el trabajador no tiene saldo registrado para el año, `GET /api/vacaciones/mi-saldo` responde
   `404`, la creación de solicitudes se rechaza con el mismo criterio y la UI lo muestra como estado
   "sin saldo".

**Flujo de estados**

```text
   crear
     │
     ▼
┌───────────┐  VoBo (JEFE / DIRECTORA)  ┌─────────┐  aprobación final (RRHH / ADMIN)  ┌───────────┐
│ PENDIENTE │──────────────────────────▶│ CON_VB  │──────────────────────────────────▶│ APROBADA  │
└─────┬─────┘                           └────┬────┘                                   └───────────┘
      │ rechazo motivado                    │ rechazo motivado
      ▼                                     ▼
┌───────────┐                         ┌───────────┐
│ RECHAZADA │                         │ RECHAZADA │
└───────────┘                         └───────────┘
```

- La **aprobación final** se ejecuta en una **transacción**: cambia el estado a `APROBADA`, registra
  `rrhhId` e incrementa `diasUsados` de forma atómica. Solo se permite desde `CON_VB`.
- El **rechazo** exige `motivoRechazo` (obligatorio, máximo 255 caracteres) y notifica al solicitante.
- `CANCELADA` existe en el enum y en los badges de la UI para conservar el historial.
- Cada transición notifica por Socket.IO al solicitante y/o al aprobador.

**Pantallas**

- **Mis Vacaciones** (`/vacaciones/mis-vacaciones`): saldo disponible del año, formulario de solicitud
  (día completo o medio día), historial con badges de estado y descarga del PDF.
- **Gestión de Vacaciones** (`/vacaciones/gestion`, para `JEFE`, `DIRECTORA`, `RRHH` y `ADMIN`):
  1. **Bandeja de solicitudes:** filtros por estado, acciones de VoBo, aprobación final, rechazo
     motivado y exportación a Excel.
  2. **Saldos iniciales** (solo `RRHH` / `ADMIN`): registro o actualización del saldo anual por
     trabajador y año mediante *upsert*.
  3. **Calendario anual:** vista de 12 meses que resalta los días con vacaciones aprobadas y permite
     navegar entre años.

**Documentos y exportaciones**

| Documento | Formato | Endpoint | Acceso |
|---|---|---|---|
| Solicitud de vacaciones | PDF oficial con tres firmas (Trabajador, Jefe Inmediato — VoBo, RRHH — Aprobación Final) | `GET /api/vacaciones/:id/pdf` | Solicitante, jefe/aprobador, `RRHH`, `ADMIN`, `DIRECTORA` |
| Reporte de vacaciones | Excel (`.xlsx`) con filtro por estado | `GET /api/vacaciones/exportar` | `RRHH`, `ADMIN` |

Las vacaciones aprobadas también **bloquean los registros de asistencia** que se solapen con el
periodo (ver [3.2](#32-asistencias)).

### 3.5 Visitas

Registro de visitantes para el control de acceso a la sede. **No se emiten gafetes ni credenciales
físicas**: la identificación se gestiona íntegramente en el registro digital.

- Alta de visita por `VIGILANTE` o `ADMIN` con **nombre completo y DNI de 8 dígitos**.
- La visita se asocia al **trabajador que se visita**, quien debe tener una **entrada registrada**
  ese día (presencia activa); si no está presente, el registro se rechaza.
- Registro de **salida** (`PUT /api/visitas/:id/salida`) e historial con filtros por rango de fechas,
  trabajador visitado y registrador; la condición **dentro / salió** se deriva de `horaSalida`.
- Visibilidad: `VIGILANTE`, `ADMIN` y `RRHH` ven todas; `DIRECTORA` todas o solo las suyas
  (`alcance=propios`); `JEFE` su equipo; `ESPECIALISTA` únicamente las visitas que recibió.
- **Exportación a Excel** del listado filtrado.

### 3.6 Dashboards por rol

`/dashboard` renderiza un panel distinto según el rol, todos sobre el tema claro y con carga
asíncrona, esqueletos de carga y accesos rápidos:

| Rol | Panel | Contenido principal |
|---|---|---|
| `ADMIN` | `AdminDashboard` | Usuarios activos, papeletas pendientes, alerta de papeletas bloqueadas y accesos a usuarios, jefaturas, delegaciones, asistencias, papeletas, visitas y verificación de tokens. |
| `RRHH` | `RrhhDashboard` | Presencia de hoy (primeros 8 registros), papeletas pendientes con enlace a revisión y accesos a asistencias, papeletas y notificaciones. |
| `DIRECTORA` | `DirectoraDashboard` | Papeletas pendientes, presencia institucional (presentes / ausentes) y delegaciones de aprobación vigentes. |
| `JEFE` | `JefeDashboard` | Papeletas por aprobar, presencia de su equipo y delegaciones vigentes. |
| `ESPECIALISTA` | `EspecialistaDashboard` | Papeletas activas visibles (propias y, si aplica, recibidas por delegación), días asistidos en el mes en curso y notificaciones sin leer. |
| `VIGILANTE` | `VigilanteDashboard` | Contadores de **presentes / ausentes / total**, lista de trabajadores presentes con hora de entrada y accesos a registrar asistencia, registrar visita, mis papeletas y verificar token. |

### 3.7 Notificaciones

- Se generan en cada evento del ciclo de vida: papeleta creada, observada, aprobada, rechazada,
  anulada o bloqueada; vacación creada, con VoBo, aprobada o rechazada; delegación registrada o
  anulada; visita registrada (aviso al trabajador visitado); y avisos de revisión vencida.
- Se entregan por **Socket.IO** a la sala `usuario:<id>` (y a los `ADMIN` en eventos transversales) y
  se persisten en la tabla `Notificacion`.
- **Campana en la barra superior** con contador de no leídas y las **últimas 10** notificaciones, marcado
  individual (`PUT /api/notificaciones/:id/leer`), marcado masivo
  (`PUT /api/notificaciones/leer-todas`) y página completa con el historial en `/notificaciones`.
- Cada notificación persiste `mensaje`, `leida` y `fecha`; el evento `notificacion` enviado al
  cliente incluye `id`, `mensaje`, `fecha` y `leida`.

### 3.8 Reportes

Las exportaciones se ejecutan desde las propias pantallas (no existe un módulo independiente de
reportes) y se generan **en memoria** con ExcelJS, sin archivos temporales en disco:

| Reporte | Origen | Endpoint |
|---|---|---|
| Asistencias | `AsistenciasPage` / `MisAsistenciasPage` | `GET /api/asistencias/exportar` |
| Papeletas | `PapeletasPage` | `GET /api/papeletas/exportar` |
| Visitas | `VisitasPage` | `GET /api/visitas/exportar` |
| Vacaciones | `GestionVacacionesPage` | `GET /api/vacaciones/exportar` |
| Solicitud de vacaciones (PDF) | `MisVacacionesPage` / `GestionVacacionesPage` | `GET /api/vacaciones/:id/pdf` |

Todas las exportaciones respetan **exactamente los mismos filtros y la misma visibilidad por rol**
que el listado en pantalla.

### 3.9 Administración

- **Usuarios:** alta, edición, activación/desactivación y cambio de rol, con reglas de jerarquía
  (`jefeId`) y restricciones (no se puede desactivar al **último `ADMIN` activo** — al desactivar un
  `ADMIN` se reactiva automáticamente el más reciente que estuviera inactivo —; `RRHH` no puede
  **crear** cuentas `ADMIN`).
- **Jefaturas:** catálogo de áreas con jefe asignado, usado para la jerarquía viva y los filtros.
- **Delegaciones:** registro y anulación de sustituciones temporales de aprobación.
- **Operación de papeletas:** desbloqueo con reasignación de aprobador y anulación administrativa.
- **Saldos de vacaciones:** alta y actualización del saldo anual por trabajador.
- **Design System:** página `/design-system` para revisar tokens, componentes y contrastes.

---

## 4. Modelo de datos

Base de datos **MySQL 8** gestionada con Prisma. Contiene **11 modelos** y **6 enums**, y está
evolucionada con **9 migraciones** versionadas en `backend/prisma/migrations`.

### Modelos

| Modelo | Campos clave | Propósito |
|---|---|---|
| `Usuario` | `email` único, `password` (bcrypt), `rol`, `activo`, `cambioPassword`, `tokenVersion`, `jefeId`, `jefaturaId`, `noDisponible`, `encargadoTemporalId`, `tituloFormal` | Cuenta y posición jerárquica del trabajador. |
| `Jefatura` | `nombre` único, `esOficial`, `jefeId` único | Áreas oficiales (Dirección, Gestión Pedagógica, Unidad de Administración, UPDI) e internas. |
| `Movimiento` | `usuarioId`, `tipo`, `timestamp`, `bloqueado`, `registradoPorId`, `editadoPorId` | Marcas de entrada/salida con auditoría de autoría (B-03). |
| `Papeleta` | `numero` único, `tipoTiempo`, `fechaInicio`, `fechaFin`, `horaSalida`, `horaRetorno`, `estado`, `token` único, `fechaRevision`, `requiereAprobadorEspecial`, `reasignadoPorId`, `firmaExternaSvg` | Permisos con flujo de aprobación, anulación y verificación. |
| `TokenVerificacion` | `token`, `papeletaId`, `usuarioConsultanteId`, `fechaConsulta` | Auditoría de cada consulta de token en puerta. |
| `Visita` | `visitanteNombre`, `visitanteDni`, `trabajadorVisitadoId`, `registradorId`, `horaEntrada`, `horaSalida` | Control de visitantes (sin gafetes). |
| `Notificacion` | `usuarioId`, `mensaje` (`VarChar(500)`), `leida`, `fecha` | Bandeja persistente de avisos. |
| `Delegacion` | `titularId`, `encargadoId`, `motivo`, `documentoRef`, `fechaInicio`, `fechaFin`, `activo`, `creadoPorId` | Sustitución temporal de la facultad de aprobar. |
| `VacacionSaldo` | `usuarioId` + `anio` (único), `diasGanados` (30.00), `diasUsados` (0.00) | Saldo anual de vacaciones. |
| `SolicitudVacacion` | `solicitanteId`, `aprobadorId`, `rrhhId`, `tipo`, `fechaInicio`, `fechaFin`, `horaInicio`, `horaFin`, `diasDescontados`, `estado`, `motivoRechazo` | Solicitud de vacaciones con VoBo y aprobación final. |
| `RolVacaciones` | `usuarioId`, `anio`, `fechaInicio`, `fechaFin`, `esBloquePrincipal` | Bloques de planificación vacacional por año. |

### Enums

| Enum | Valores |
|---|---|
| `Rol` | `VIGILANTE`, `ESPECIALISTA`, `JEFE`, `DIRECTORA`, `RRHH`, `ADMIN` |
| `TipoMovimiento` | `ENTRADA`, `SALIDA` |
| `TipoTiempo` | `DIAS`, `HORAS` |
| `EstadoPapeleta` | `PENDIENTE`, `EN_REVISION`, `OBSERVADO`, `APROBADO`, `RECHAZADO`, `CANCELADO`, `ANULADO`, `ANULACION_SOLICITADA` |
| `TipoVacacion` | `DIA_COMPLETO`, `MEDIO_DIA` |
| `EstadoSolicitudVacacion` | `PENDIENTE`, `CON_VB`, `APROBADA`, `RECHAZADA`, `CANCELADA` |

### Relaciones principales

- `Usuario` **1—N** `Movimiento`, `Papeleta`, `Visita`, `Notificacion`, `VacacionSaldo`,
  `SolicitudVacacion`, `TokenVerificacion` y `Delegacion` (como titular, encargado y creador).
- `Usuario` mantiene **autorelaciones**: `jefe` / `subordinados` y `encargadoTemporal` /
  `esEncargadoDe`.
- `Jefatura` **1—N** `Usuario` (miembros) y **1—1** con su `jefe`.
- `Papeleta` **1—N** `TokenVerificacion`; `SolicitudVacacion` referencia a tres usuarios distintos
  (solicitante, jefe que da VoBo y RRHH que aprueba).
- `VacacionSaldo` y `RolVacaciones` usan `onDelete: Cascade` sobre `Usuario`; los campos de autoría
  (`Movimiento.registradoPorId` / `editadoPorId` y `Papeleta.reasignadoPorId`) usan `onDelete: SetNull`
  para no perder el histórico.

### Migraciones

| Migración | Aporte |
|---|---|
| `20260624025825_init` | Esquema base (usuarios, jefaturas, movimientos, papeletas, visitas, notificaciones, tokens). |
| `20260625233149_add_fecha_revision` | Marca de inicio de revisión de papeletas (`EN_REVISION`). |
| `20261023235500_bloque_a_jerarquia` | Jerarquía, disponibilidad, encargado temporal y delegaciones. |
| `20261024060333_delegacion_activo_documento_ref` | Vigencia/anulación y sustento documental de delegaciones. |
| `20261025011302_widen_notificacion_mensaje_delegacion_documento_ref` | Ampliación de longitudes de mensajes y referencias. |
| `20261025035123_add_reasignado_por_id_papeleta` | Desbloqueo administrativo de papeletas. |
| `20261025035407_drop_gafete_from_visita` | **Retiro del módulo de gafetes** del registro de visitas. |
| `20261028222215_add_token_version_and_audit_movimiento` | **H-07** (`tokenVersion`) y **B-03** (autoría de movimientos). |
| `20261110163219_add_vacaciones_module` | **Módulo de vacaciones**: saldos, solicitudes y rol vacacional. |

---

## 5. Instalación y despliegue

### Requisitos

- **Node.js 18+** y npm.
- **MySQL 8** (base de datos `gestion_personal` con `utf8mb4`).
- Puertos libres: `3001` (API) y `5173` (Vite en desarrollo).

### 1. Backend

```bash
cd backend
npm install
```

Crea `backend/.env` con las variables que el código necesita para operar:

```env
# Base de datos
DATABASE_URL="mysql://usuario:password@localhost:3306/gestion_personal"

# Sesiones
JWT_SECRET="cadena-larga-y-aleatoria"
PORT=3001

# CORS / Socket.IO (obligatoria: el servidor no arranca sin ella)
FRONTEND_ORIGIN="http://localhost:5173"

# Webhook de firma externa (obligatoria para ese endpoint)
WEBHOOK_SECRET="secreto-compartido-con-el-firmador"

# Almacenamiento de firmas SVG (recomendada: restringe el host de svgUrl)
SUPABASE_URL="https://<proyecto>.supabase.co"
```

> `FRONTEND_ORIGIN` se valida al arrancar: si falta, el proceso termina con un error explícito.
> `WEBHOOK_SECRET` se comprueba en cada llamada al webhook (responde `500` si no está configurada).
> Se recomienda además `TZ=America/Lima` para que los cortes de día y los cálculos de fecha coincidan
> con la hora de Perú.

Aplica el esquema y carga los datos iniciales:

```bash
npx prisma migrate deploy     # producción (aplica las 9 migraciones)
# o, en desarrollo:
npm run prisma:migrate
npm run prisma:seed
```

El seed crea las **7 jefaturas iniciales** (4 oficiales) y un usuario
`admin@ugeltalara.gob.pe` con **contraseña aleatoria de 16 caracteres** que se imprime **una sola
vez** en la consola. Ese usuario arranca con `cambioPassword = true`, por lo que el primer login
obliga a cambiarla.

```bash
npm run dev      # API en http://localhost:3001 con recarga automática
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Vite redirige `/api` y `/socket.io` a `http://localhost:3001`, por lo que en desarrollo no se
necesita ninguna URL absoluta ni variable `VITE_*`.

### 3. Build de producción

```bash
# Backend
cd backend
npm run build        # compila TypeScript a dist/
npm start            # node dist/server.js

# Frontend
cd frontend
npm run build        # genera dist/ (tsc + vite build)
npm run preview      # verificación local del build
```

Sirve `frontend/dist` con Nginx o Apache y publica `/api` y `/socket.io` hacia el backend. En
producción, ajusta `FRONTEND_ORIGIN` al dominio real (CORS y Socket.IO usan ese valor) y configura
`/socket.io` con soporte WebSocket.

### Scripts disponibles

| Ubicación | Script | Acción |
|---|---|---|
| `backend` | `npm run dev` | API con `nodemon` + `ts-node`. |
| `backend` | `npm run build` / `npm start` | Compila a `dist/` y ejecuta `dist/server.js`. |
| `backend` | `npm run prisma:migrate` | `prisma migrate dev`. |
| `backend` | `npm run prisma:seed` | Ejecuta `prisma/seed.ts`. |
| `frontend` | `npm run dev` | Vite en el puerto 5173. |
| `frontend` | `npm run build` / `npm run preview` | Build de producción y vista previa. |
| `frontend` | `npm run verificar:fechahora` | Verifica los helpers de fecha/hora local (`scripts/verificar-fechahora.mjs`). |

---

## 6. API endpoints

Prefijo global `/api`. Todas las rutas exigen `Authorization: Bearer <token>` salvo las marcadas
como públicas; las respuestas de error siguen el formato `{ "mensaje": "..." }`.

### Autenticación y salud

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/login` | Público (5/15 min) | Autentica y devuelve JWT (8 h) o token temporal (15 min). |
| `POST` | `/api/auth/cambiar-password` | Autenticado (5/15 min) | Cambia la contraseña e invalida los JWT previos. |
| `GET` | `/api/auth/mi-perfil` | Autenticado | Perfil de la sesión vigente. |
| `GET` | `/api/health` | Público | Comprobación de disponibilidad (`{ estado: "ok" }`). |

### Usuarios y jefaturas

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/usuarios` | `ADMIN`, `RRHH` | Crea usuario (contraseña temporal + `cambioPassword`). |
| `POST` | `/api/usuarios/asignar-jefe` | `ADMIN` | Asigna jefe inmediato. |
| `GET` | `/api/usuarios` | `ADMIN`, `RRHH`, `VIGILANTE` | Lista con filtros por rol, jefatura, estado y búsqueda. |
| `GET` | `/api/usuarios/:id` | `ADMIN`, `RRHH` | Detalle de usuario. |
| `PUT` | `/api/usuarios/:id` | `ADMIN` | Edita datos, rol, jefatura y disponibilidad. |
| `PUT` | `/api/usuarios/:id/desactivar` | `ADMIN` | Baja lógica. |
| `GET` | `/api/jefaturas` | Autenticado | Catálogo de jefaturas. |
| `POST` | `/api/jefaturas` | `ADMIN` | Crea jefatura interna. |
| `PUT` | `/api/jefaturas/:id` | `ADMIN` | Edita nombre, descripción y jefe. |
| `DELETE` | `/api/jefaturas/:id` | `ADMIN` | Elimina jefaturas no oficiales sin usuarios. |

### Delegaciones

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/delegaciones` | `ADMIN`, `JEFE`, `DIRECTORA` | Lista delegaciones (filtros por titular, encargado y vigencia). |
| `POST` | `/api/delegaciones` | `ADMIN` | Registra una delegación temporal. |
| `PUT` | `/api/delegaciones/:id/anular` | `ADMIN` | Anula con motivo, conservando el historial. |

### Asistencias

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/asistencias` | `VIGILANTE`, `ADMIN` | Registra ENTRADA/SALIDA (valida bloqueos por papeleta/vacación). |
| `PUT` | `/api/asistencias/:id` | `VIGILANTE`, `ADMIN` | Corrige un movimiento (registra `editadoPorId`). |
| `GET` | `/api/asistencias` | Todos los roles | Listado según visibilidad; `alcance=propios\|equipo`. |
| `GET` | `/api/asistencias/presencia` | `VIGILANTE`, `ADMIN`, `RRHH`, `JEFE`, `DIRECTORA` | Presencia del día (`PRESENTE` / `AUSENTE`). |
| `GET` | `/api/asistencias/exportar` | `VIGILANTE`, `ADMIN`, `RRHH` | Excel del listado filtrado. |

### Papeletas

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/papeletas` | Todos los roles | Crea una papeleta (`DIAS` u `HORAS`). |
| `GET` | `/api/papeletas` | Todos los roles | Listado según visibilidad, con filtros por estado, tipo y fechas. |
| `GET` | `/api/papeletas/:id` | Autenticado | Detalle con solicitante, aprobador y trazabilidad. |
| `GET` | `/api/papeletas/:id/pdf` | Autenticado | PDF oficial de la papeleta. |
| `GET` | `/api/papeletas/exportar` | Autenticado | Excel del listado visible. |
| `POST` | `/api/papeletas/verificar-token` | Autenticado (10/10 min) | Valida el token de 6 caracteres en puerta. |
| `PUT` | `/api/papeletas/:id/revisar` | `ADMIN`, `RRHH`, `DIRECTORA`, `JEFE` | Inicia la revisión (`EN_REVISION`). |
| `PUT` | `/api/papeletas/:id/aprobar` | `ADMIN`, `RRHH`, `DIRECTORA`, `JEFE` | Aprueba y genera el token de verificación. |
| `PUT` | `/api/papeletas/:id/rechazar` | `ADMIN`, `RRHH`, `DIRECTORA`, `JEFE` | Rechaza con motivo. |
| `PUT` | `/api/papeletas/:id/observar` | `ADMIN`, `RRHH`, `DIRECTORA`, `JEFE` | Observa para corrección del solicitante. |
| `PUT` | `/api/papeletas/:id/desbloquear` | `ADMIN` | Reasigna aprobador a una papeleta bloqueada. |
| `PUT` | `/api/papeletas/:id/cancelar` | Solicitante | Cancela su propia papeleta. |
| `PUT` | `/api/papeletas/:id/reenviar` | Solicitante | Reenvía una papeleta observada. |
| `PUT` | `/api/papeletas/:id/anular` | Aprobador / `ADMIN` | Anula una papeleta aprobada. |
| `POST` | `/api/papeletas/:id/solicitar-anulacion` | Autenticado | Inicia la ventana de anulación. |
| `POST` | `/api/papeletas/:id/cancelar-solicitud-anulacion` | Autenticado | Cancela la solicitud de anulación. |

### Visitas y notificaciones

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/visitas` | `VIGILANTE`, `ADMIN` | Registra visitante (DNI de 8 dígitos) y valida presencia del trabajador. |
| `GET` | `/api/visitas` | Todos los roles | Historial según visibilidad; `alcance=propios\|equipo`. |
| `GET` | `/api/visitas/:id` | Todos los roles | Detalle de la visita. |
| `PUT` | `/api/visitas/:id/salida` | `VIGILANTE`, `ADMIN` | Registra la hora de salida. |
| `GET` | `/api/visitas/exportar` | Todos los roles | Excel del listado filtrado. |
| `GET` | `/api/notificaciones` | Autenticado | Bandeja del usuario (`?soloNoLeidas=true` opcional). |
| `PUT` | `/api/notificaciones/leer-todas` | Autenticado | Marca todas como leídas. |
| `PUT` | `/api/notificaciones/:id/leer` | Autenticado | Marca una notificación como leída. |

### Vacaciones

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/vacaciones/mi-saldo` | Autenticado | Saldo del año (`?anio=AAAA` opcional); `404` si no está registrado. |
| `GET` | `/api/vacaciones` | Autenticado | Listado según visibilidad, con filtros por `estado` y `usuarioId`. |
| `POST` | `/api/vacaciones` | Autenticado | Crea solicitud (`DIA_COMPLETO` o `MEDIO_DIA`). |
| `POST` | `/api/vacaciones/saldos` | `ADMIN`, `RRHH` | Registra o actualiza el saldo anual (upsert). |
| `GET` | `/api/vacaciones/exportar` | `RRHH`, `ADMIN` | Excel del listado filtrado por estado. |
| `GET` | `/api/vacaciones/:id/pdf` | Solicitante, jefe/aprobador, `RRHH`, `ADMIN`, `DIRECTORA` | PDF oficial con las tres firmas. |
| `PUT` | `/api/vacaciones/:id/vb` | `JEFE`, `DIRECTORA` | Otorga el VoBo (`CON_VB`). |
| `PUT` | `/api/vacaciones/:id/aprobar` | `RRHH`, `ADMIN` | Aprobación final y descuento transaccional del saldo. |
| `PUT` | `/api/vacaciones/:id/rechazar` | `JEFE`, `DIRECTORA`, `RRHH`, `ADMIN` | Rechazo con `motivoRechazo` obligatorio. |

### Firma externa

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/firmas/webhook` | HMAC-SHA256 (`x-webhook-signature` + `x-webhook-timestamp`) o `x-webhook-secret` estático; 5/15 min | Recibe el SVG firmado, valida el cuerpo exacto, la ventana anti-replay y lo asocia a la papeleta. |

> **Nota:** las rutas estáticas (`/exportar`, `/presencia`, `/verificar-token`, `/mi-saldo`,
> `/leer-todas`) se declaran antes de las rutas con `:id` para evitar colisiones de parámetros.

---

## 7. Diseño UI

SIGPER usa un **tema claro institucional** construido sobre Tailwind CSS con tokens semánticos. El
diseño se apoya en cuatro colores de marca —**navy, amarillo, azul y blanco**— y en una paleta de
estados con contraste verificado **WCAG AA**. La especificación de tokens y mediciones vive en
`frontend/DESIGN.md`, y la implementación en `frontend/tailwind.config.js` + `frontend/src/index.css`.

### Paleta institucional

| Token | Hex | Uso |
|---|---|---|
| `brand-navy` | `#0A1D3D` | Sidebar, top bar, títulos y texto sobre amarillo. |
| `brand-navy-light` | `#1E3A5F` | Hover del sidebar y superficies oscuras secundarias. |
| `brand-yellow` | `#F5C518` | Acentos, badges e ítem activo de navegación. |
| `brand-yellow-dark` | `#D4A800` | Hover del amarillo. |
| `brand-blue` | `#2563EB` | Botones primarios, enlaces y focos. |
| `brand-blue-hover` | `#1D4ED8` | Hover del azul. |
| `surface-bg` | `#F5F7FA` | Fondo del área de contenido. |
| `surface-card` | `#FFFFFF` | Tarjetas, tablas y formularios. |
| `line-light` / `line-strong` | `#E2E8F0` / `#CBD5E1` | Bordes sutiles y bordes visibles. |
| `content-primary` | `#0F172A` | Texto principal. |
| `content-secondary` | `#64748B` | Texto secundario. |
| `content-tertiary` | `#94A3B8` | Placeholders y ayudas. |
| `content-inverse` | `#FFFFFF` | Texto sobre navy o azul. |
| `content-on-yellow` | `#0A1D3D` | **Obligatorio** sobre fondos amarillos. |

### Estados y contraste

| Estado | Fondo | Texto | Contraste |
|---|---|---|---|
| Éxito | `#E8F8F0` | `#047857` | **4.99:1** (AA) |
| Advertencia | `#FEF9E7` | `#8A6D00` | **4.67:1** (AA) |
| Error (badge) | `#FEE9E9` | `#C81E1E` | **4.93:1** (AA) |
| Error (botón) | `#C81E1E` | `#FFFFFF` | **5.74:1** (AA) |
| Información | `#E8F3FE` | `#2563EB` | AA |

> **Regla de oro:** nunca usar texto blanco sobre amarillo. Sobre `brand-yellow` el texto es siempre
> `content-on-yellow` (navy).

### Forma, elevación y tipografía

- **Radios:** `ds-sm` 6 px, `ds-md` 10 px, `ds-lg` 14 px, `ds-xl` 20 px. Se usan con prefijo para no
  alterar los radios por defecto de Tailwind.
- **Sombras:** `shadow-card` (reposo), `shadow-hover` (interacción) y `shadow-modal` (diálogos).
- **Tipografía del sistema**, sin webfonts: `heading-1` (24 px/bold), `heading-2` (20 px/semibold),
  `heading-3` (16 px/semibold), `body-text` (14 px), `body-muted` (14 px secundario) y `caption`
  (12 px terciario).

### Clases semánticas

| Grupo | Clases |
|---|---|
| Contenedores | `.card`, `.card-hover`, `.kpi-card` |
| Botones | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`, `.btn-sm/md/lg` |
| Formularios | `.input-field`, `.input-field-error` |
| Estados | `.badge-success`, `.badge-warning`, `.badge-error`, `.badge-info` |
| Tipografía | `.heading-1/2/3`, `.body-text`, `.body-muted`, `.caption` |

### Layout y accesibilidad

- **Sidebar navy** (`#0A1D3D`) con scroll propio, ítem activo en amarillo con texto navy, y **top bar**
  del mismo navy con la campana de notificaciones y el menú de usuario.
- **Área de contenido** sobre `surface-bg`, con tarjetas blancas y tablas de borde sutil.
- Foco visible con `focus-visible:ring-2 ring-brand-blue` en botones e inputs; estados `disabled`
  atenuados y `cursor-not-allowed`.
- Diálogos y transiciones con **Headless UI** (foco atrapado y cierre por teclado).
- Todos los paneles muestran **estados de carga** y estados vacíos explícitos.
- Página de referencia viva en **`/design-system`** (`demo/DesignSystemPage.tsx`).

---

## 8. Seguridad

Las decisiones de seguridad están implementadas en el código y se resumen en la siguiente tabla:

| Control | Implementación |
|---|---|
| **Hash de contraseñas** | `bcryptjs` con 10 rondas; la contraseña nunca se devuelve en las respuestas (`omitirPassword`). |
| **Política de contraseñas** | Mínimo 8 caracteres, al menos un número y un símbolo (`utils/validarPassword.ts`). |
| **Sesiones JWT** | Token normal de **8 h** y temporal de **15 min** cuando `cambioPassword = true`; se firma con `JWT_SECRET` obligatorio. |
| **Revocación (H-07)** | `tokenVersion` en el JWT se compara con la BD en cada petición y en el handshake de Socket.IO; el cambio de contraseña la incrementa. |
| **Autenticación global** | `app.use('/api', authJWT, exigirCambioPassword)` protege todos los routers de negocio; solo login y health son públicos, el webhook se autentica por HMAC y `cambiar-password` / `mi-perfil` aplican `authJWT` en su propia ruta. |
| **Autorización por rol** | `checkRole(...)` por ruta + validación de recurso en el controlador (jerarquía viva, delegaciones y visibilidad por módulo). |
| **Alcance del token temporal** | `exigirCambioPassword` limita la sesión a `cambiar-password` y `mi-perfil` (corrige H-01). |
| **Validación de entrada** | Esquemas **Zod `.strict()`** para body, query y params: rechazan campos desconocidos y aplican límites de longitud y formato (DNI de 8 dígitos, fechas ISO, enums). |
| **Rate limiting** | Login 5/15 min, cambio de contraseña 5/15 min, verificación de token 10/10 min y webhook 5/15 min. |
| **Cabeceras y cuerpo** | `helmet()` y límite JSON de **100 kb**. |
| **CORS** | Origen único `FRONTEND_ORIGIN` (validado al arrancar), compartido por la API y Socket.IO. |
| **Webhook de firma** | HMAC-SHA256 sobre el **cuerpo crudo**, ventana anti-replay, comparación en tiempo constante y compatibilidad con `x-webhook-secret`; solo papeletas APROBADAS, idempotente y sin sobreescritura. |
| **URLs de firma** | `svgUrl` debe ser `https`; si `SUPABASE_URL` está configurada, el host debe coincidir con ese dominio o un subdominio suyo. |
| **Anti-enumeración** | `401` genérico en login para usuario inexistente, contraseña incorrecta o cuenta inactiva. |
| **Consultas a BD** | Prisma parametriza todas las consultas (sin SQL concatenado). |
| **Auditoría** | `Movimiento.registradoPorId` / `editadoPorId`, `Papeleta.reasignadoPorId` y `TokenVerificacion` (quién consultó cada token y cuándo). |
| **Control de acceso físico** | Las visitas ya no generan credenciales ni gafetes: se elimina la superficie de credenciales físicas reutilizables. |
| **Transporte** | En producción se recomienda HTTPS en el proxy inverso, con WebSocket habilitado para `/socket.io`. |

> **Nota:** los JWT se envían en la cabecera `Authorization` y se persisten en el cliente para
> mantener la sesión; por ello es imprescindible servir la aplicación por HTTPS y mantener
> `FRONTEND_ORIGIN` restringido al dominio institucional.

---

## 9. Estructura del repositorio

```text
Sistema_Ugel/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # 11 modelos, 6 enums
│   │   ├── migrations/            # 9 migraciones versionadas
│   │   └── seed.ts                # jefaturas iniciales + admin aleatorio
│   ├── src/
│   │   ├── app.ts                 # Express, CORS, Helmet, routers, manejo de errores
│   │   ├── server.ts              # HTTP + Socket.IO (handshake con tokenVersion)
│   │   ├── routes/                # 10 routers
│   │   ├── controllers/           # 13 controladores
│   │   ├── services/              # 9 servicios (papeletas, vacaciones, bloqueos, PDF…)
│   │   ├── schemas/               # 10 esquemas Zod
│   │   ├── middlewares/           # authJWT, checkRole, validate, rateLimit, exigirCambioPassword
│   │   ├── sockets/               # salas de usuario y avisos en tiempo real
│   │   └── utils/                 # fechas, tokens, contraseñas, motivos y cliente Prisma
│   ├── .env                       # no versionado
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/                 # 27 pantallas
│   │   │   ├── admin/             # usuarios, formulario, jefaturas, delegaciones
│   │   │   ├── asistencias/       # registro, mis asistencias, listado
│   │   │   ├── auth/              # login, cambio de contraseña
│   │   │   ├── dashboard/         # 6 dashboards por rol + dispatcher + 404
│   │   │   ├── demo/              # Design System
│   │   │   ├── notificaciones/
│   │   │   ├── papeletas/         # listado, creación, detalle, verificar token
│   │   │   ├── vacaciones/        # mis vacaciones, gestión
│   │   │   └── visitas/           # registro, listado
│   │   ├── components/            # layout (Layout, Sidebar, ProtectedRoute, campana) y ui (Button, Card, Input, Modal, Toast)
│   │   ├── contexts/              # AuthContext
│   │   ├── hooks/                 # useAuth, useSocket, useToast
│   │   ├── services/              # clientes Axios por módulo
│   │   ├── types/                 # tipos compartidos del dominio
│   │   ├── utils/                 # fechaHora (formato de fechas y horas)
│   │   ├── App.tsx                # rutas protegidas y lazy loading
│   │   ├── main.tsx
│   │   └── index.css              # clases semánticas del Design System
│   ├── DESIGN.md                  # especificación de tokens y contrastes
│   ├── tailwind.config.js
│   ├── vite.config.ts             # proxy /api y /socket.io
│   └── scripts/verificar-fechahora.mjs
├── implementationplan.md          # bitácora técnica y cierre de deudas (B-03, H-07)
├── README.md
└── LICENSE
```

---

## 10. Licencia

Distribuido bajo licencia **MIT**. Consulta [`LICENSE`](LICENSE) para el texto completo.

---

<div align="center">

**SIGPER · UGEL Talara** — Gestión de personal con trazabilidad, jerarquía viva y documentos oficiales.

</div>