# SIGPER – Sistema de Gestión de Personal | UGEL Talara

Sistema web de gestión de personal para la UGEL Talara, diseñado para una institución de aproximadamente 50 trabajadores y pensado para operar en una red interna (intranet).

SIGPER centraliza la gestión de:

- autenticación y usuarios;
- jefaturas y estructura jerárquica;
- asistencias y control de presencia;
- papeletas de permisos;
- aprobaciones jerárquicas;
- observación, rechazo, cancelación y anulación de papeletas;
- visitas y control de gafetes;
- notificaciones en tiempo real;
- verificación mediante token;
- generación de PDF;
- reportes en Excel;
- captura y recepción de firmas externas.

> **Estado:** sistema funcional en desarrollo activo.
> Este README describe el estado actual documentado del proyecto y las modificaciones de seguridad implementadas durante la revisión técnica.

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
- [Seguridad y endurecimiento](#seguridad-y-endurecimiento)
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
- [Validación de entradas](#validación-de-entradas)
- [API](#api)
- [Rutas del frontend](#rutas-del-frontend)
- [Modelo de datos](#modelo-de-datos)
- [Jobs periódicos](#jobs-periódicos)
- [Migraciones](#migraciones)
- [Scripts disponibles](#scripts-disponibles)
- [Cambios recientes](#cambios-recientes)
- [Estado de los puntos críticos](#estado-de-los-puntos-críticos)
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
│       ├── schemas/
│       ├── services/
│       ├── sockets/
│       ├── utils/
│       ├── app.ts
│       └── server.ts
│
├── frontend/
│   ├── firma-movil/
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
├── LICENSE
└── README.md
```

## Backend

El backend expone una API REST con Express y utiliza Prisma como ORM para MySQL.

Las responsabilidades principales están separadas en:

- `controllers`: procesamiento de solicitudes HTTP;
- `routes`: definición de endpoints;
- `middlewares`: autenticación, autorización, rate limiting y validación;
- `schemas`: esquemas de validación con Zod;
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
| Rate limiting | express-rate-limit |
| Validación | Zod 4 |
| Reportes | ExcelJS |
| PDF | PDFKit |
| Uploads HTTP | Multer |
| Frontend | React + TypeScript |
| Bundler | Vite |
| Routing | React Router |
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

Ejemplo:

```env
DATABASE_URL="mysql://USUARIO:CONTRASEÑA@localhost:3306/NOMBRE_BASE_DATOS"
JWT_SECRET="CLAVE_SECRETA_SEGURA"
PORT=3001
FRONTEND_ORIGIN="http://localhost:5173"
WEBHOOK_SECRET="SECRETO_DEL_WEBHOOK"
```

No publiques valores reales de estas variables en GitHub.

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

---

# Variables de entorno

## Backend

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Cadena de conexión de Prisma/MySQL |
| `JWT_SECRET` | Firma y validación de tokens JWT |
| `PORT` | Puerto HTTP del backend; por defecto `3001` |
| `FRONTEND_ORIGIN` | Origen autorizado para CORS |
| `WEBHOOK_SECRET` | Protección del endpoint de firma externa |

## Frontend

La aplicación utiliza la URL configurada para comunicarse con el backend, por ejemplo:

```env
VITE_API_URL=http://localhost:3001/api
```

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

# Seguridad y endurecimiento

Esta sección resume los principales cambios aplicados durante la revisión técnica.

## 1. Revalidación de sesión y JWT

El backend ya no depende exclusivamente del contenido del JWT para autorizar una solicitud protegida.

En cada solicitud autenticada se:

1. verifica la firma y vigencia del JWT;
2. obtiene el `id` del usuario;
3. consulta el usuario actual en la base de datos;
4. comprueba que exista y esté activo;
5. utiliza el rol actual almacenado en la base de datos.

El JWT normal contiene únicamente la identidad mínima necesaria (`id`).

Los tokens temporales para el cambio obligatorio de contraseña incluyen además la marca correspondiente de cambio de contraseña.

### Efectos

- Un usuario desactivado deja de poder consumir endpoints protegidos aunque conserve un JWT válido temporalmente.
- Un cambio de rol se refleja sin necesidad de cerrar sesión y volver a iniciar sesión.
- El frontend limpia la sesión cuando recibe un `401` por token inválido, expirado o usuario desactivado.

Socket.IO también valida la existencia, actividad y rol actual del usuario durante el handshake autenticado.

---

## 2. CORS restringido

La configuración anterior basada en origen abierto fue reemplazada por un origen configurable.

Variable utilizada:

```env
FRONTEND_ORIGIN="http://localhost:5173"
```

Express utiliza esta variable para la política CORS y Socket.IO utiliza la misma configuración de origen autorizado.

Esto mantiene permitido el frontend actual sin mantener una política de origen abierta de forma general.

---

## 3. Rate limiting

Se incorporó `express-rate-limit` para limitar endpoints sensibles.

### Login

```text
5 intentos / 15 minutos por IP
```

Endpoint:

```http
POST /api/auth/login
```

### Verificación de token

```text
10 intentos / 10 minutos por IP
```

Endpoint:

```http
POST /api/papeletas/verificar-token
```

Cuando se alcanza el límite, el backend responde con HTTP `429` y un mensaje específico.

---

## 4. Validación de entradas

Se incorporó **Zod 4** junto con un middleware centralizado de validación:

```text
backend/src/middlewares/validate.ts
```

Los esquemas se organizan en:

```text
backend/src/schemas/
├── auth.schema.ts
├── usuario.schema.ts
├── papeleta.schema.ts
├── asistencia.schema.ts
├── visita.schema.ts
├── notificacion.schema.ts
├── jefatura.schema.ts
└── firmaExterna.schema.ts
```

La validación se aplica a `body`, `params` y `query` según corresponda.

### Criterios generales

- IDs: enteros positivos.
- Enumeraciones: únicamente valores definidos por el sistema.
- Booleanos: valores booleanos válidos.
- Fechas: formato y calendario válidos donde corresponde.
- Fechas y horas ISO: se admiten cuando ese es el formato real utilizado por el frontend.
- Strings: no vacíos cuando son obligatorios y con límites de longitud.
- Objetos: se utilizan esquemas estrictos cuando corresponde para rechazar campos no contemplados.
- Errores: respuesta uniforme mediante HTTP `400` con `mensaje` y detalle por campo.

### Validaciones específicas

#### Autenticación

Se validan:

```text
email
password
passwordActual
nuevaPassword
```

#### Usuarios

Se validan:

```text
email
password
rol
nombres
apellidos
jefaturaId
jefeId
activo
usuarioId
```

además de los parámetros y filtros correspondientes.

#### Papeletas

Se validan:

```text
tipoTiempo
fechaInicio
fechaFin
horaSalida
horaRetorno
motivo
motivoOtros
motivoRechazo
comentario
motivoAnulacion
id
estado
solicitanteId
token
```

El token de verificación debe tener exactamente 6 caracteres del conjunto utilizado por el generador de tokens.

#### Asistencias

Se validan:

```text
usuarioId
tipo
timestamp
nuevoTimestamp
nuevoTipo
fechaInicio
fechaFin
jefaturaId
id
```

#### Visitas

Se validan:

```text
visitanteNombre
visitanteDni
trabajadorVisitadoId
gafeteEntregado
fechaInicio
fechaFin
registradorId
id
```

El DNI se valida como una cadena de 8 dígitos.

#### Notificaciones

Se validan:

```text
soloNoLeidas
id
```

#### Jefaturas

Se validan:

```text
nombre
descripcion
id
```

#### Firma externa

Se validan:

```text
papeletaId
svgUrl
```

La validación estructural del webhook pertenece a este punto; la seguridad específica del secreto `x-webhook-secret` se mantiene como una preocupación independiente del Punto 6.

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

## Cambio obligatorio de contraseña

```http
POST /api/auth/cambiar-password
```

Permite completar el cambio inicial y después cerrar la sesión temporal para exigir un login normal.

## Perfil

```http
GET /api/auth/mi-perfil
```

Devuelve la información actual del usuario autenticado.

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

Los usuarios mantienen información de identificación, rol, estado, jefatura y relaciones jerárquicas.

## Jefaturas

El sistema permite:

- listar jefaturas;
- crear jefaturas;
- editar jefaturas;
- eliminar jefaturas sin usuarios asociados.

Las operaciones de escritura están restringidas a `ADMIN`.

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

El registro operativo está destinado a `VIGILANTE` y `ADMIN`.

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

## Motivos

El sistema utiliza motivos predefinidos y permite información adicional cuando corresponde el motivo `Otros`.

## Flujo de estados

Los estados definidos son:

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

Flujo general:

```text
PENDIENTE
   │
   ▼
EN_REVISION
   ├─────────────► RECHAZADO
   │
   ├─────────────► APROBADO
   │                 │
   │                 └──► ANULACION_SOLICITADA ──► ANULADO
   │
   └─────────────► OBSERVADO ──► REENVÍO ──► PENDIENTE
```

También existen transiciones de cancelación según las reglas de negocio.

---

# Aprobación jerárquica

El aprobador se determina según el rol del solicitante y su estructura organizacional.

| Solicitante | Flujo de aprobación |
|---|---|
| `DIRECTORA` | Autoaprobación según lógica de negocio |
| `ESPECIALISTA` | Jefe inmediato |
| `JEFE` | Directora |
| `VIGILANTE` | RRHH |
| `RRHH` | Según la estructura configurada |
| `ADMIN` | Según la estructura configurada |

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

Las reglas de tiempo dependen del tipo de papeleta y de la lógica de negocio del sistema.

El administrador dispone de permisos especiales para anular.

---

# Bloqueos de asistencia

Una papeleta en estado:

```text
APROBADO
```

puede bloquear el registro de asistencia correspondiente al periodo autorizado.

## DIAS

El bloqueo cubre:

```text
fechaInicio → fechaFin
```

## HORAS

El bloqueo cubre:

```text
horaSalida → horaRetorno
```

El bloqueo se determina dinámicamente a partir de las papeletas aprobadas.

Cuando una papeleta deja de estar aprobada, deja de producir el bloqueo correspondiente.

---

# Tokens de verificación

Las papeletas aprobadas pueden recibir un token de verificación único.

Endpoint:

```http
POST /api/papeletas/verificar-token
```

El token se registra y las consultas se auditan mediante:

```text
TokenVerificacion
```

La validación HTTP exige exactamente seis caracteres del alfabeto definido por el generador de tokens.

---

# Firmas externas

El backend recibe la referencia de una firma externa mediante:

```http
POST /api/firmas/webhook
```

El request esperado contiene:

```json
{
  "papeletaId": 123,
  "svgUrl": "https://..."
}
```

La petición usa el header:

```http
x-webhook-secret: <WEBHOOK_SECRET>
```

El modelo `Papeleta` dispone de:

```text
firmaExternaSvg
```

para almacenar la URL o referencia de la firma.

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

## Consulta

```http
GET /api/visitas
GET /api/visitas/:id
```

Los resultados se restringen según el rol del usuario y los filtros recibidos.

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

## Visitas

```http
GET /api/visitas/exportar
```

## Papeletas

```http
GET /api/papeletas/exportar
```

Las exportaciones utilizan los mismos criterios de filtrado temporal definidos por cada módulo.

---

# Validación de entradas

La validación HTTP se centraliza mediante:

```text
backend/src/middlewares/validate.ts
```

con esquemas separados por dominio.

Cuando una entrada no es válida, la API utiliza el formato:

```json
{
  "mensaje": "Los datos enviados no son válidos",
  "errores": {
    "campo": "Descripción del error"
  }
}
```

Los controladores conservan las reglas de negocio que dependen de la base de datos o del estado de la operación. Por ejemplo:

- existencia de usuarios, jefaturas o papeletas;
- permisos sobre recursos concretos;
- estado de una papeleta;
- presencia de un trabajador;
- bloqueos por papeletas;
- límites operativos;
- jerarquía de aprobación.

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

Representa a cada trabajador o usuario del sistema y mantiene relaciones jerárquicas y operativas.

## Jefatura

Representa una unidad organizacional.

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

Registra consultas realizadas sobre tokens de verificación de papeletas.

---

# Jobs periódicos

El backend ejecuta tareas periódicas cada 60 segundos.

Actualmente se realizan tres procesos:

### 1. Revisiones vencidas

Busca papeletas `EN_REVISION` cuya revisión superó el límite establecido y las devuelve a `PENDIENTE` cuando corresponde.

### 2. Solicitudes de anulación vencidas

Busca solicitudes `ANULACION_SOLICITADA` cuya ventana temporal terminó y ejecuta la lógica correspondiente.

### 3. Alertas de anulación

Comprueba ventanas próximas a vencer y genera las notificaciones correspondientes.

> Estos procesos se ejecutan dentro del proceso Node.js mediante un temporizador periódico.

---

# Migraciones

El proyecto contiene migraciones Prisma para la estructura actual de la base de datos.

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
| `prisma:migrate` | Ejecuta migraciones de Prisma |
| `prisma:seed` | Inicializa datos base |

## Frontend

```bash
npm run dev
npm run build
npm run preview
```

---

# Cambios recientes

## Punto 1 — Revalidación de JWT y sesión

Se implementó la revalidación del usuario autenticado contra la base de datos en cada petición protegida.

Cambios principales:

- el JWT normal contiene únicamente el `id`;
- el middleware `authJWT` consulta el usuario actual;
- se rechazan cuentas inexistentes o inactivas;
- el rol utilizado por autorización es el rol actual de la base de datos;
- Socket.IO valida la sesión durante el handshake.

Validaciones funcionales realizadas:

- cambio de `ESPECIALISTA` a `RRHH` sin cerrar sesión;
- cambio inverso de `RRHH` a `ESPECIALISTA` sin cerrar sesión;
- desactivación de una cuenta durante una sesión activa.

## Punto 2 — CORS

Se sustituyó la configuración de origen abierto por una política configurable mediante:

```env
FRONTEND_ORIGIN=http://localhost:5173
```

La misma política se aplica al servidor Express y Socket.IO.

## Punto 3 — Rate limiting

Se incorporó `express-rate-limit` mediante:

```text
backend/src/middlewares/rateLimit.ts
```

Configuración actual:

```text
Login             → 5 / 15 minutos
Verificar token   → 10 / 10 minutos
```

Se verificó funcionalmente la respuesta HTTP `429` al superar ambos límites.

## Punto 4 — Validación de entradas

Se incorporó Zod 4 y el middleware:

```text
backend/src/middlewares/validate.ts
```

Se añadieron esquemas para:

```text
auth
usuarios
papeletas
asistencias
visitas
notificaciones
jefaturas
firmas externas
```

Se realizaron pruebas funcionales sobre:

- entradas inválidas;
- IDs no numéricos;
- IDs negativos;
- fechas inválidas;
- enumeraciones inválidas;
- filtros inválidos;
- token de verificación con formato incorrecto;
- bodies incompletos;
- registro de datos válidos después de incorporar los esquemas.

Los módulos principales continuaron funcionando con datos válidos después de la integración de la validación.

---

# Estado de los puntos críticos

| Punto | Descripción | Estado |
|---|---|---|
| 1 | Revalidación de JWT y revocación lógica de sesión | ✅ Implementado y probado |
| 2 | Restricción de CORS | ✅ Implementado y probado |
| 3 | Rate limiting | ✅ Implementado y probado |
| 4 | Validación estructurada de entradas | ✅ Implementado y probado |
| 5 | Revisión de roles y autorización | ⏳ Pendiente |
| 6 | Seguridad del webhook de firma externa | ⏳ Pendiente |

---

# Consideraciones actuales

La aplicación continúa en desarrollo y todavía requiere endurecimientos adicionales antes de un despliegue institucional definitivo.

## CORS en producción

La variable `FRONTEND_ORIGIN` debe configurarse con el origen real del frontend institucional y no con `localhost` cuando el sistema se publique en el servidor definitivo.

## JWT en frontend

El frontend conserva actualmente el JWT en `localStorage`. Para escenarios con requisitos superiores de seguridad puede evaluarse un mecanismo basado en cookies `HttpOnly`, `Secure` y `SameSite`.

## Rate limiting

El rate limiting actual utiliza el almacenamiento en memoria y la identidad de origen predeterminada de `express-rate-limit`. Para múltiples instancias del backend se deberá evaluar un almacenamiento compartido.

## Jobs

Los procesos periódicos se ejecutan dentro del proceso Node.js mediante `setInterval`. Para múltiples instancias del backend deberá evaluarse un scheduler o worker con coordinación para evitar duplicidades.

## Concurrencia

La numeración de papeletas y otras operaciones críticas de estado deben seguir siendo revisadas antes de trabajar con cargas concurrentes mayores.

## Auditoría

El sistema registra consultas de tokens, pero una bitácora completa de todas las transiciones de estado puede requerir una implementación específica de auditoría.

## Webhook de firma externa

El webhook estructuralmente validado pertenece al Punto 4, pero su endurecimiento criptográfico y de autenticación continúa contemplado en el Punto 6.

## Pruebas automatizadas

El proyecto no incorpora actualmente una suite automatizada completa para todas las reglas de negocio. Las pruebas realizadas durante esta etapa fueron funcionales/manuales.

---

# Estado funcional

Actualmente se encuentran implementados:

```text
Autenticación              ✓
Usuarios                   ✓
Jefaturas                  ✓
Asistencias                ✓
Control de presencia       ✓
Papeletas                  ✓
Aprobación jerárquica      ✓
Observación/reenvío         ✓
Rechazo/cancelación         ✓
Anulación                  ✓
Tokens de verificación     ✓
Generación de PDF          ✓
Visitas                    ✓
Notificaciones             ✓
Socket.IO                  ✓
Reportes Excel             ✓
Captura de firma           ✓
Webhook de firma           ✓
Rate limiting              ✓
Validación con Zod         ✓
CORS restringido            ✓
Revalidación de JWT        ✓
```

---

# Licencia

Este proyecto se distribuye bajo la licencia **MIT**.

Consulta el archivo `LICENSE` incluido en el repositorio para conocer los términos completos.

```text
MIT License

Copyright (c) 2026 UGEL Talara

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files, to deal in the Software
without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the
Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
