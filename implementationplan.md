# Plan de Implementación - Auditoría de Validación de Entradas (Punto 4)

## Fase 1: Inventario y Diagnóstico (Endpoints: `/api/papeletas` y `/api/visitas`)

### Diagnóstico Analítico:
Durante la revisión de los endpoints del módulo de **Papeletas** y **Visitas**, se verificó que todos los endpoints están enlazados a sus rutas mediante el middleware `validate(...)` y utilizan esquemas de Zod configurados con `.strict()`. Sin embargo, se identificaron los siguientes **fallos de validación arquitectónica y de diseño**:

1. **Esquema Zod de Papeleta Incompleto (Delegación de validación condicional al controlador)**:
   - El esquema `papeletaSchema` (`papeleta.schema.ts`) define campos como `fechaInicio`, `fechaFin`, `horaSalida` y `horaRetorno` como `.optional()`.
   - La verdadera validación lógica de cuándo son obligatorios estos campos (dependiendo si `tipoTiempo` es `DIAS` u `HORAS`) se realiza manualmente a través de la función `validarCamposPapeleta` en `papeleta.controller.ts`.
   - **Solución requerida**: Eliminar la validación manual del controlador y utilizar `.superRefine()` en `papeletaSchema` para validar todas las reglas de negocio condicionales (ej: si es por horas, debe tener salida y retorno del mismo día) directamente desde Zod.

2. **Duplicación de validación y redundancia (Controladores vs Zod)**:
   A pesar de tener middleware de validación con Zod en todas las rutas, los controladores de papeletas y visitas no confían en Zod y duplican múltiples validaciones de formato de manera manual:
   - **En `papeleta.controller.ts` y `visita.controller.ts` (Params)**: En métodos como `obtenerPapeleta`, `iniciarRevision`, `aprobarPapeleta`, `obtenerVisita`, `registrarSalida`, `marcarGafete`, etc., se realiza `const id = Number(req.params.id); if (Number.isNaN(id)) {...}`, ignorando que `papeletaIdParamsSchema` y `visitaIdParamsSchema` ya incluyen coerción `z.coerce.number().int().positive()` y bloquean IDs inválidos.
   - **En `listarPapeletas`**: Se reevalúa manualmente si el `estado` pertenece a `EstadoPapeleta` y se parsean manualmente las fechas usando una función auxiliar (`parseFechaLocal`) devolviendo errores HTTP 400. Esto ya está validado por el `listarPapeletasQuerySchema`. También se re-valida `solicitanteId` con `Number.isNaN`.
   - **En `listarVisitas`**: Se realiza un `split('-')` manual sobre `fechaInicio` y `fechaFin` y comprobaciones de longitud, y se aplican conversiones y verificaciones de NaN a `trabajadorVisitadoId` y `registradorId`, a pesar de que el esquema `listarVisitasQuerySchema` ya los valida.
   - **Solución requerida**: Limpiar los controladores eliminando todas estas comprobaciones manuales `Number.isNaN()`, `parseFechaLocal`, `.split('-')` y validaciones de estados (enums). Los controladores deben confiar enteramente en los datos que llegan tipados y validados a través de `req.body`, `req.query` y `req.params`.

### Siguientes Pasos
Una vez aprobado este plan, se procederá a:
1. Actualizar `papeleta.schema.ts` para integrar la lógica de `validarCamposPapeleta` utilizando `.superRefine()`.
2. Limpiar `papeleta.controller.ts` y `visita.controller.ts` eliminando las comprobaciones y sanitizaciones de entrada redundantes.

---

## Fase 2: Inventario y Diagnóstico (Bloque final: `/api/notificaciones`, `/api/firmas`, Webhook de firma y Eventos Socket.IO)

> Alcance del bloque: verificación de params/query/body con Zod en `/api/notificaciones` y `/api/firmas`; validación de campos obligatorios, tipos y contenido del Webhook de firma (Fase 6); y determinación de si existen payloads externos enviados por el cliente en Socket.IO que requieran validación (Fase 6).
> Este turno es solo de inventario y diagnóstico: **no se modifica código**.

### Inventario de validación (rutas y esquemas)

| Endpoint | Método | Fuente | Middleware/Esquema Zod | Campos | `.strict()` |
|---|---|---|---|---|---|
| `/api/notificaciones` | GET | `query` | `validate(listarNotificacionesQuerySchema, 'query')` | `soloNoLeidas` (`enum(['true','false']).optional()`) | Sí |
| `/api/notificaciones/:id/leer` | PUT | `params` | `validate(notificacionIdParamsSchema, 'params')` | `id` (`coerce.number().int().positive()`) | Sí |
| `/api/notificaciones/leer-todas` | PUT | — | No aplica (ruta sin entradas) | — | — |
| `/api/firmas/webhook` | POST | `body` | `validate(webhookFirmaSchema, 'body')` | `papeletaId`, `svgUrl` | Sí |

Conclusión del inventario: **las tres rutas que reciben entradas están enlazadas a un esquema Zod con `.strict()`**. Los fallos detectados son de diseño (redundancia en controladores) y una brecha de validación de contenido en el webhook.

### Diagnóstico analítico: `/api/notificaciones`

1. **Redundancia de validación en `marcarLeida` (Params)**:
   - `notificacionIdParamsSchema` ya coacciona y valida el `id` (`z.coerce.number().int().positive()`).
   - Aun así, el controlador vuelve a comprobar `const id = Number(req.params.id); if (Number.isNaN(id)) { ... }` (`notificacion.controller.ts`).
   - Es el mismo antipatrón ya detectado en `papeleta.controller.ts` y `visita.controller.ts`: comprobación manual que nunca puede activarse porque el middleware ya rechazó el valor inválido con HTTP 400.
   - **Solución requerida**: eliminar el bloque `Number.isNaN` del controlador y consumir directamente el `req.params.id` ya tipado/validado por Zod.

2. **Re-tipado manual del query en `listarNotificaciones`**:
   - Se declara `const { soloNoLeidas } = req.query as { soloNoLeidas?: string };`, re-declarando el tipo en lugar de confiar en el dato ya validado por `listarNotificacionesQuerySchema`.
   - No es un fallo de seguridad, pero sí duplica la definición del contrato y contradice el criterio de "los controladores confían enteramente en los datos validados".
   - **Solución requerida**: consumir `req.query` validado sin reintroducir un `as { ... }` manual (usar el tipo inferido del esquema).

### Diagnóstico analítico: `/api/firmas` (`POST /webhook`)

1. **Redundancia de validación de campos obligatorios**:
   - El esquema `webhookFirmaSchema` ya obliga `papeletaId` (entero positivo) y `svgUrl` (string no vacío, URL, ≤2048).
   - El controlador repite `const { papeletaId, svgUrl } = req.body as { ... }; if (!papeletaId || !svgUrl) { ... }`.
   - Las comprobaciones de presencia/tipo ya fueron cubiertas por Zod; la comprobación manual es código muerto.
   - **Solución requerida**: eliminar el `if (!papeletaId || !svgUrl)` y el `as { ... }` manual, consumiendo el body validado.

2. **Brecha de validación de CONTENIDO en `svgUrl` (esquema incompleto)**:
   - `webhookFirmaSchema` usa `z.string().trim().min(1).url()`. La validación `.url()` de Zod solo verifica que el valor tenga forma de URL; **no restringe el esquema (protocolo)**.
   - Por tanto se aceptan valores como `javascript:alert(1)`, `data:image/svg+xml;base64,...` o `file:///...`. Al tratarse de la URL de una firma que posteriormente puede renderizarse, esto abre la puerta a **contenido no confiable** (vector de XSS almacenado) vía la firma externa.
   - **Solución requerida (dentro del Punto 4)**: endurecer el contenido del campo en Zod, restringiendo el protocolo a `https` (y, si el proveedor es fijo, a un host/bucket permitido, p. ej. el dominio de almacenamiento de Supabase), rechazando cualquier otro esquema mediante `.refine()`/`.superRefine()`.

3. **Validación de campos obligatorios, tipos y contenido (Fase 6) — resumen**:
   - Obligatorios: ✅ cubiertos por Zod (`papeletaId`, `svgUrl`).
   - Tipos: ✅ cubiertos por Zod (entero positivo / string).
   - Contenido: ⚠️ incompleto (ver brecha #2: no se restringe el protocolo/host de `svgUrl`).

### HALLAZGO FUERA DEL ALCANCE DEL PUNTO 4 (seguridad del Webhook de firma)

> Estos hallazgos son de **seguridad (Punto 6 — "Seguridad del webhook de firma externa", marcado como pendiente)** y **no se corrigen dentro de la auditoría de Validación de entradas**. Se registran únicamente para su trazabilidad.

- **H1 — Comparación no resistente a ataques de temporización (timing attack)**: el secreto se compara con `secretRecibido !== secretEsperado` (`!==` sobre strings), operación que no es de tiempo constante. Debería usarse una comparación en tiempo constante (p. ej. `crypto.timingSafeEqual`).
- **H2 — Ausencia de rate limiting en el webhook**: a diferencia de `/api/auth/login` (`rateLimitLogin`) y `/api/papeletas/verificar-token` (`rateLimitVerificarToken`), la ruta `/api/firmas/webhook` no tiene limitador, lo que permite intentos masivos de adivinación del secreto compartido.
- **H3 — Autenticación basada solo en secreto estático (sin HMAC ni anti-replay)**: no se verifica una firma HMAC del cuerpo ni un timestamp/nonce, por lo que un secreto filtrado permitiría reutilización/replay de peticiones.
- **Nota**: el mecanismo de autenticación por header `x-webhook-secret` **sí existe** (no falta el secreto); los hallazgos H1–H3 son de endurecimiento y quedan fuera del alcance del Punto 4.

### Diagnóstico analítico: Eventos Socket.IO (Fase 6)

Objetivo: determinar si existen **payloads externos enviados por el cliente** que requieran validación con Zod.

Revisión de `backend/src/server.ts`, `backend/src/sockets/io.ts` y `frontend/src/contexts/SocketContext.tsx`:

1. **Única entrada del cliente es el handshake JWT**: el middleware `io.use(...)` lee `socket.handshake.auth?.token`, verifica la firma/expiración con `jwt.verify`, valida que el `id` sea entero positivo y consulta el usuario en BD (existe + activo). Es validación de autenticación ya presente; no requiere un esquema de body/query.
2. **No existen eventos cliente→servidor con payload propio**: dentro de `io.on('connection')` los únicos listeners registrados son `socket.on('disconnect', ...)`. No hay ningún `socket.on('<evento>', ...)` que reciba datos del cliente.
3. **Los únicos eventos emitidos son servidor→cliente**: `io.to('usuario:<id>').emit('notificacion', { id, mensaje, fecha, leida })` (salida, no entrada).

**Conclusión**: No hay payloads externos enviados por el cliente en Socket.IO que requieran validación con Zod. **Sin hallazgos de validación (Punto 4) en este componente.** El único dato externo (el token) ya se valida en el handshake. Si en el futuro se agregaran eventos cliente→servidor con datos, deberá aplicarse allí un esquema Zod (no aplica hoy).

### Resumen del bloque final

| Componente | Validación Zod | Hallazgos Punto 4 |
|---|---|---|
| `/api/notificaciones` (GET `/`, PUT `/:id/leer`) | Presente (query y params, `.strict()`) | 2 (redundancias manuales en el controlador) |
| `/api/notificaciones/leer-todas` | No aplica (sin entradas) | 0 |
| `/api/firmas/webhook` | Presente (body, `.strict()`) | 2 (redundancia manual + contenido de `svgUrl` sin restringir protocolo) |
| Webhook — seguridad (Punto 6) | Fuera de alcance | 3 → **HALLAZGO FUERA DEL ALCANCE DEL PUNTO 4** (H1–H3) |
| Eventos Socket.IO | Handshake JWT validado; sin eventos cliente→servidor | 0 |

### Siguientes Pasos de este bloque (pendientes de aprobación, sin ejecutar)

> **Estado: IMPLEMENTADO (código modificado y verificado).** Los hallazgos H1–H3 se mantienen fuera de alcance para el Punto 6.

1. `notificacion.controller.ts`: eliminar la comprobación `Number.isNaN` de `marcarLeida` y el re-tipado manual `as { soloNoLeidas?: string }` de `listarNotificaciones`.
2. `firmaExterna.controller.ts`: eliminar el `if (!papeletaId || !svgUrl)` y el `as { ... }` manual del body.
3. `firmaExterna.schema.ts`: endurecer el contenido de `svgUrl` restringiendo el protocolo a `https` (y host permitido) mediante `.refine()`/`.superRefine()`.
4. Mantener H1–H3 (seguridad del webhook) fuera del alcance de este punto, para su tratamiento en el Punto 6.

---

# Punto 5 — Roles y Autorización

> **Auditoría estática (solo lectura).** Este documento es el entregable de diagnóstico del Bloque 1 y **requiere aprobación** antes de tocar código. En este turno **no se modificó ningún archivo fuente**.

## Fase 1: Diagnóstico de Auth, Usuarios y Jefaturas

**Alcance:** módulos `/api/auth`, `/api/usuarios` y `/api/jefaturas`, la cadena de autorización `authJWT` + `checkRole` y el modelo de datos Prisma/MySQL (`Usuario`, `Jefatura`, enum `Rol`).
**Commit base:** `f232453` (cierre del Punto 4).
**Archivos inspeccionados (backend):**
- `src/middlewares/authJWT.ts`, `src/middlewares/checkRole.ts`, `src/middlewares/validate.ts`, `src/middlewares/rateLimit.ts`
- `src/routes/auth.routes.ts`, `src/routes/usuario.routes.ts`, `src/routes/jefatura.routes.ts`
- `src/controllers/auth.controller.ts`, `src/controllers/usuario.controller.ts`, `src/controllers/jefatura.controller.ts`
- `src/schemas/auth.schema.ts`, `src/schemas/usuario.schema.ts`, `src/schemas/jefatura.schema.ts`
- `prisma/schema.prisma`, `prisma/seed.ts`, `src/app.ts`, `src/server.ts`, `src/services/visibilidadPapeletas.service.ts`

### 1.1 Arquitectura de autorización observada

| Componente | Comportamiento verificado |
|---|---|
| `authJWT` | Extrae el `Bearer`, verifica firma/expiración con `JWT_SECRET`, valida `payload.id` entero > 0, **consulta la BD en cada request** (`findUnique` seleccionando `id, email, rol, activo, cambioPassword`) y **rechaza si el usuario no existe (401) o si `activo = false` (401)**. Coloca en `req.usuario` el **rol real de la BD**. |
| `checkRole(...roles)` | Usa `req.usuario.rol` (ya proveniente de la BD). Responde 401 si no hay usuario y 403 si el rol no está en la lista permitida. |
| `validate(schema, fuente)` | `safeParse` con Zod; en error responde 400 con detalle; si es válido reemplaza `req[fuente]` por los datos transformados. Los esquemas de este bloque usan `.strict()`. |
| `rateLimitLogin` | 5 intentos / 15 min por IP en `POST /api/auth/login`. |

**Consecuencia clave (positiva):** al derivar el rol de la BD en tiempo real, **desactivar un usuario o cambiarle el rol a mitad de sesión surte efecto en la siguiente petición**, sin esperar la expiración del JWT (máx. 8 h). No existe dependencia de un rol "congelado" dentro del token.

### 1.2 Matriz de endpoints (Bloque 1)

| Método | Ruta | Autenticación | Roles permitidos (`checkRole`) | Validación Zod | Controlador |
|---|---|---|---|---|---|
| POST | `/api/auth/login` | Pública (+ `rateLimitLogin`) | — | `loginSchema` (body, strict) | `login` |
| POST | `/api/auth/cambiar-password` | `authJWT` | Cualquier rol autenticado | `cambiarPasswordSchema` (body, strict) | `cambiarPassword` |
| GET | `/api/auth/mi-perfil` | `authJWT` | Cualquier rol autenticado | — | `miPerfil` |
| POST | `/api/usuarios` | `authJWT` | **ADMIN, RRHH** | `crearUsuarioSchema` (body, strict) | `crearUsuario` |
| POST | `/api/usuarios/asignar-jefe` | `authJWT` | **ADMIN** | `asignarJefeSchema` (body, strict) | `asignarJefe` |
| GET | `/api/usuarios` | `authJWT` | ADMIN, RRHH, **VIGILANTE** | `listarUsuariosQuerySchema` (query, strict) | `listarUsuarios` |
| GET | `/api/usuarios/:id` | `authJWT` | **ADMIN, RRHH** | `usuarioIdParamsSchema` (params) | `obtenerUsuario` |
| PUT | `/api/usuarios/:id` | `authJWT` | **ADMIN** | params + `editarUsuarioSchema` (body, strict) | `editarUsuario` |
| PUT | `/api/usuarios/:id/desactivar` | `authJWT` | **ADMIN** | `usuarioIdParamsSchema` (params) | `desactivarUsuario` |
| GET | `/api/jefaturas` | `authJWT` | Cualquier rol autenticado | — | `listarJefaturas` |
| POST | `/api/jefaturas` | `authJWT` | **ADMIN** | `crearJefaturaSchema` (body, strict) | `crearJefatura` |
| PUT | `/api/jefaturas/:id` | `authJWT` | **ADMIN** | params + `editarJefaturaSchema` (body, strict) | `editarJefatura` |
| DELETE | `/api/jefaturas/:id` | `authJWT` | **ADMIN** | `jefaturaIdParamsSchema` (params) | `eliminarJefatura` |

> **Respuesta directa a la pregunta del bloque (IDOR / BOLA / escalada):** un rol inferior (**ESPECIALISTA**, JEFE, DIRECTORA, VIGILANTE) **NO** puede inyectar datos, cambiarse el rol a sí mismo ni alterar el rol de otros: **todos** los endpoints de escritura de usuarios están restringidos a **ADMIN/RRHH** y la escritura de Jefaturas a **ADMIN**. La superficie de riesgo residual está **dentro** de ADMIN y RRHH (ver H-02, H-03, H-05).

### 1.3 Roles oficiales

`prisma/schema.prisma` define `enum Rol { VIGILANTE, ESPECIALISTA, JEFE, DIRECTORA, RRHH, ADMIN }` y los esquemas Zod usan `z.enum(Rol)`. **Confirmado: el sistema está limitado estrictamente a esos 6 roles** (no hay strings de rol libres en las validaciones de este bloque). Regla de negocio adicional: roles únicos activos = `DIRECTORA`, `RRHH`, `ADMIN` (`ROLES_UNICOS` en `usuario.controller.ts`). La jerarquía se modela en `Usuario` mediante `jefaturaId` (pertenencia), `jefeId` (jefe inmediato, autorelación) y `Jefatura.jefeId` (cabeza de jefatura).

### 1.4 Hallazgos (enumerados y con severidad)

#### H-01 — [ALTO] El bloqueo de "primer inicio de sesión" es evadible (token temporal sin restricción de alcance)
- **Dónde:** `auth.controller.ts` (login emite token de 15 min con `requiereCambioPassword: true` cuando `cambioPassword = true`) y `authJWT.ts` (solo propaga la marca; **no la aplica**).
- **Qué pasa:** el token temporal es aceptado por **todas** las rutas autenticadas (usuarios, jefaturas, papeletas, asistencias, visitas y handshake de Socket.IO). `authJWT` nunca bloquea por `cambioPassword` / `requiereCambioPassword`.
- **Impacto:** un usuario con contraseña pendiente de cambio opera con su rol completo hasta 15 min sin cambiar la contraseña → el control de rotación obligatoria es evadible.
- **Recomendación (a aprobar):** añadir un middleware `exigirCambioPassword` tras `authJWT` que deniegue con 403 todo salvo `POST /api/auth/cambiar-password` cuando el usuario tenga `cambioPassword = true` (estado leído de la BD).

#### H-02 — [ALTO] Auto-degradación / auto-desactivación del último ADMIN y bypass del guard de `desactivarUsuario`
- **Dónde:** `usuario.controller.ts` → `editarUsuario` (`PUT /api/usuarios/:id`) acepta `rol` y `activo`; `editarUsuarioSchema` incluye `activo: boolean`.
- **Qué pasa:**
  1. Un ADMIN puede cambiarse su propio `rol` de `ADMIN` a `ESPECIALISTA`. La regla de "roles únicos" solo valida DIRECTORA/RRHH/ADMIN y ESPECIALISTA no es único → la operación pasa y **pueden quedar 0 ADMIN activos**.
  2. Un ADMIN puede enviar `{ "activo": false }` sobre sí mismo o sobre el otro ADMIN. `editarUsuario` **no tiene** el guard del "último administrador" que sí existe en `desactivarUsuario` → el sistema queda **sin ningún administrador**.
- **Impacto:** bloqueo total de la administración (nadie puede gestionar usuarios ni jefaturas) sin recuperación vía API. Es un **bypass** de la protección implementada en `desactivarUsuario`.
- **Recomendación:** extraer un helper (p. ej. `asegurarAdminActivoRestante`) que impida degradar/desactivar al último ADMIN activo y aplicarlo de forma unificada en `editarUsuario` y `desactivarUsuario`.

#### H-03 — [MEDIO] RRHH puede emitir roles de mayor privilegio (ADMIN/DIRECTORA/JEFE)
- **Dónde:** `usuario.routes.ts` (`POST /` permite ADMIN y RRHH) + `usuario.schema.ts` (`rol: z.enum(Rol)` acepta los 6 roles).
- **Qué pasa:** un usuario RRHH puede crear cuentas `ADMIN` (queda inactiva si ya existe un ADMIN activo, pero **activa** si no existe ninguno) y también `JEFE` / `DIRECTORA`.
- **Impacto:** escalada de privilegios indirecta y ampliación no controlada de la cúpula; el rol del creador no limita los roles asignables.
- **Recomendación:** definir una lista blanca de roles asignables según el rol del creador (p. ej. RRHH no puede crear `ADMIN`).

#### H-04 — [MEDIO] Jerarquía sin validación de integridad: self-jefe, ciclos y jefe inactivo
- **Dónde:** `asignarJefe`, `crearUsuario` y `editarUsuario` validan que el jefe exista y tenga rol JEFE/DIRECTORA, pero **no** validan `usuarioId !== jefeId`, **no** detectan ciclos y **no** comprueban `jefe.activo`.
- **Qué pasa:** se puede fijar `jefeId = id` (auto-jefe) o crear ciclos (A jefe de B y B jefe de A); también se puede asignar un jefe desactivado.
- **Impacto:** datos inconsistentes que rompen la semántica organizacional y pueden afectar la visibilidad/aprobación (`visibilidadPapeletas.service.ts`).
- **Recomendación:** validar `jefeId !== usuarioId`, ausencia de ciclos (recorrido ascendente) y `jefe.activo === true`.

#### H-05 — [BAJO] RRHH puede fijar la jerarquía en `POST /api/usuarios` eludiendo `/asignar-jefe`
- **Dónde:** `crearUsuarioSchema` incluye `jefeId` y `POST /api/usuarios` permite RRHH, mientras que `POST /api/usuarios/asignar-jefe` es **solo ADMIN**.
- **Impacto:** inconsistencia de autorización: la misma operación (asignar jefe) es ADMIN-only por una vía y permitida a RRHH por otra.
- **Recomendación:** alinear ambas vías con la política elegida (restringir `jefeId` a ADMIN o permitir `/asignar-jefe` a RRHH).

#### H-06 — [MEDIO] Exposición excesiva del directorio de usuarios al rol VIGILANTE
- **Dónde:** `GET /api/usuarios` permite VIGILANTE; `listarUsuarios` devuelve el objeto completo del usuario (solo se elimina `password`).
- **Qué pasa:** el rol de menor privilegio puede enumerar **todo** el personal con `email`, `rol`, `activo`, `jefaturaId` y `jefeId`, y usar filtros (`rol=ADMIN`, `activo=false`) para localizar cuentas privilegiadas (incluso inactivas).
- **Recomendación:** proyección de campos mínima para VIGILANTE (id, nombres, apellidos, jefatura) y/o un endpoint acotado para los selectores.

#### H-07 — [MEDIO] Sin revocación de sesiones (el cambio de contraseña no invalida tokens vigentes)
- **Dónde:** JWT sin `jti` ni `tokenVersion`; `cambiarPassword` no invalida sesiones previas; no existe logout/blacklist.
- **Qué pasa:** tras cambiar la contraseña (o si se sospecha robo de token), los tokens previos siguen válidos hasta 8 h. La desactivación **sí** queda cubierta (authJWT revalida `activo`), pero el cambio de credencial no.
- **Recomendación:** añadir `tokenVersion`/`passwordChangedAt` al modelo `Usuario` y validarlo en `authJWT` para invalidar sesiones al cambiar contraseña.

#### H-08 — [BAJO] Enumeración de usuarios en el login
- **Dónde:** `login` responde 403 "El usuario está desactivado…" cuando el email existe pero la cuenta está inactiva, frente al 401 genérico "Credenciales inválidas".
- **Impacto:** permite confirmar la existencia de cuentas.
- **Recomendación:** usar el mismo 401 genérico para cuenta inexistente, inactiva o contraseña incorrecta.

#### H-09 — [BAJO] `/api/auth/cambiar-password` sin rate limiting
- **Dónde:** la ruta solo tiene `authJWT` + `validate` (sin limitador, a diferencia de `/login`).
- **Impacto:** con un token válido se puede intentar fuerza bruta de la contraseña actual.
- **Recomendación:** reutilizar/añadir un limitador específico para este endpoint.

#### H-10 — [BAJO] Endurecimiento HTTP pendiente
- **Dónde:** `app.ts` usa `express.json()` sin límite explícito y no aplica cabeceras de seguridad (helmet). CORS sí está correctamente restringido a `FRONTEND_ORIGIN`.
- **Recomendación:** añadir `helmet` y un límite de body (p. ej. `express.json({ limit: '100kb' })`).

### 1.5 Resumen de severidades

| Severidad | Cantidad | Hallazgos |
|---|---|---|
| Crítico | 0 | — (no se halló escalada no autenticada ni lectura cruzada directa) |
| Alto | 2 | H-01, H-02 |
| Medio | 4 | H-03, H-04, H-06, H-07 |
| Bajo | 4 | H-05, H-08, H-09, H-10 |

### 1.6 Fortalezas verificadas (no requieren cambio)

1. **Rol en tiempo real:** `authJWT` consulta la BD en cada request; `checkRole` usa ese rol. Desactivar/cambiar rol a mitad de sesión surte efecto de inmediato.
2. **Roles oficiales cerrados:** enum Prisma + `z.enum(Rol)` → no hay roles arbitrarios.
3. **Sin mass-assignment:** los esquemas de este bloque son `.strict()` y exponen solo campos conocidos.
4. **Escritura de Jefaturas blindada a ADMIN** (POST/PUT/DELETE); el `GET` es para cualquier autenticado (por diseño, para los selectores).
5. **Sin IDOR de bajo privilegio:** ESPECIALISTA/JEFE/DIRECTORA/VIGILANTE no acceden a `PUT /:id`, `POST /`, `POST /asignar-jefe` ni a la escritura de jefaturas.
6. **`password` nunca se devuelve** (se elimina con `omitirPassword` / destructuring).
7. **Rate limit en login** y mensajes genéricos ante credenciales inválidas.
8. **Socket.IO** revalida el usuario en BD (existe y activo) en el handshake.

### 1.7 Siguientes pasos (propuesta — PENDIENTE DE APROBACIÓN, sin ejecutar)

> **No se modificará ningún archivo fuente hasta que apruebes esta fase.**

1. **H-01:** crear middleware `exigirCambioPassword` y aplicarlo tras `authJWT` (bloquear todo salvo `POST /api/auth/cambiar-password`).
2. **H-02:** extraer helper `asegurarAdminActivoRestante` y usarlo en `editarUsuario` y `desactivarUsuario`.
3. **H-03 / H-05:** definir lista blanca de roles por rol creador y alinear `jefeId` en creación con la política de `/asignar-jefe`.
4. **H-04:** validaciones anti-self y anti-ciclo en `asignarJefe`, `crearUsuario` y `editarUsuario`.
5. **H-06:** proyección de campos para VIGILANTE en `listarUsuarios`.
6. **H-07:** `tokenVersion` en `Usuario` + validación en `authJWT` (requiere migración Prisma).
7. **H-08 / H-09 / H-10:** unificar 401 en login, rate limit en cambiar-password, `helmet` + límite de body.

---

## ⛔ FIN DE LA FASE 1 — SE SOLICITA APROBACIÓN

He completado el **diagnóstico estático** del Bloque 1 (Auth, Usuarios y Jefaturas) **sin modificar código fuente**. Confirma cómo continuar:

- **(a)** apruebas los hallazgos y procedo a implementar los puntos 1–7; o
- **(b)** quieres ajustar el alcance/severidades antes de implementar; o
- **(c)** continúo con la auditoría estática del siguiente bloque (Punto 5) antes de tocar código.

> **[BLOQUE 1 PRE-APROBADO]:** el diagnóstico de Auth, Usuarios y Jefaturas quedó registrado y pre-aprobado. Se conserva intacto arriba. Metodología Opción C: se avanza con el siguiente bloque **en modo solo lectura**.

---

# Fase 2: Diagnóstico de Papeletas y Visibilidad

> **Auditoría estática (solo lectura).** Entregable de diagnóstico del **Bloque 2**. **No se modificó ningún archivo fuente** (backend 100 % intacto).

**Alcance:** módulo `/api/papeletas` (creación, lectura, descarga PDF, exportación y todas las transiciones de estado) y el servicio de visibilidad organizacional `visibilidadPapeletas.service.ts`.
**Commit base:** `f232453`.
**Archivos inspeccionados:**
- `src/routes/papeleta.routes.ts`
- `src/controllers/papeleta.controller.ts`, `src/controllers/anulacion.controller.ts`, `src/controllers/pdf.controller.ts`, `src/controllers/reportes.controller.ts` (función `exportarPapeletas`)
- `src/services/visibilidadPapeletas.service.ts`, `src/services/papeleta.service.ts`, `src/services/anulacion.service.ts`, `src/services/pdf.service.ts`
- `src/utils/tokenGenerator.ts`, `src/schemas/papeleta.schema.ts`

### 2.1 Modelo de visibilidad observado (`visibilidadPapeletas.service.ts`)

| Rol | `obtenerIdsVisibles` devuelve | Efecto |
|---|---|---|
| ADMIN, RRHH | `null` | Sin restricción: ven **todas** las papeletas. |
| JEFE | `[self, ...subordinados con jefeId = self]` | Ve las propias + las de sus subordinados **actuales**. |
| DIRECTORA | `[self, ...todos los usuarios con rol JEFE]` | Ve las propias + las de todos los JEFE. |
| ESPECIALISTA, VIGILANTE | `[self]` | **Solo las propias.** |

`usuarioPuedeVerPapeleta()` reutiliza `obtenerIdsVisibles` y es consumida por `obtenerPapeleta` y (vía `obtenerIdsVisibles`) por `descargarPDF` y `exportarPapeletas`. El servicio **no filtra por `activo`** en las consultas de subordinados/jefes (irrelevante para seguridad, pero relevante para integridad).

### 2.2 Matriz de endpoints (Bloque 2)

| Método | Ruta | Auth | `checkRole` | Validación Zod | Autorización a nivel de recurso (en controlador) |
|---|---|---|---|---|---|
| POST | `/api/papeletas` | `authJWT` | Los 6 roles | `papeletaSchema` | `solicitante` = token.id (no permite crear a nombre de otro) |
| POST | `/api/papeletas/verificar-token` | `rateLimitVerificarToken` + `authJWT` | — (cualquier rol) | `verificarTokenSchema` | **Ninguna** (busca por `token` global) |
| GET | `/api/papeletas/exportar` | `authJWT` | — (cualquier rol) | `listarPapeletasQuerySchema` | `obtenerIdsVisibles` ✅ |
| GET | `/api/papeletas` | `authJWT` | — (cualquier rol) | `listarPapeletasQuerySchema` | `obtenerIdsVisibles` ✅ |
| GET | `/api/papeletas/:id` | `authJWT` | — (cualquier rol) | `papeletaIdParamsSchema` | `usuarioPuedeVerPapeleta` ✅ |
| GET | `/api/papeletas/:id/pdf` | `authJWT` | — (cualquier rol) | `papeletaIdParamsSchema` | `idsVisibles.includes(solicitanteId)` ✅ |
| PUT | `/api/papeletas/:id/revisar` | `authJWT` | — | `papeletaIdParamsSchema` | `aprobadorId === token.id` ✅ |
| PUT | `/api/papeletas/:id/aprobar` | `authJWT` | — | `papeletaIdParamsSchema` | `aprobadorId === token.id` ✅ |
| PUT | `/api/papeletas/:id/rechazar` | `authJWT` | — | params + `rechazarPapeletaSchema` | `aprobadorId === token.id` ✅ |
| PUT | `/api/papeletas/:id/observar` | `authJWT` | — | params + `observarPapeletaSchema` | `aprobadorId === token.id` ✅ |
| PUT | `/api/papeletas/:id/cancelar` | `authJWT` | — | `papeletaIdParamsSchema` | `solicitanteId === token.id` ✅ |
| PUT | `/api/papeletas/:id/reenviar` | `authJWT` | — | params + `papeletaSchema` | `solicitanteId === token.id` ✅ |
| PUT | `/api/papeletas/:id/anular` | `authJWT` | — | params + `anularPapeletaSchema` | `esAdmin OR aprobadorId === token.id` ✅ (+ `puedeAnular`) |
| POST | `/api/papeletas/:id/solicitar-anulacion` | `authJWT` | — | `papeletaIdParamsSchema` | `solicitanteId === token.id` ✅ |
| POST | `/api/papeletas/:id/cancelar-solicitud-anulacion` | `authJWT` | — | `papeletaIdParamsSchema` | `solicitanteId === token.id` ✅ |

> **Observación transversal:** **ninguna** ruta del módulo de papeletas usa `checkRole`; la autorización depende **exclusivamente** de comprobaciones dentro de los controladores.

### 2.3 Diagnóstico de los puntos geométricos solicitados

**P1 — IDOR / BOLA en lectura y descarga (`GET /:id` y `GET /:id/pdf`):** ✅ **Sin brecha.** Ambos endpoints primero cargan la papeleta y luego aplican las reglas de visibilidad (`usuarioPuedeVerPapeleta` en `GET /:id`; `idsVisibles.includes(solicitanteId)` en `GET /:id/pdf`) **antes** de devolver datos/PDF. Un ESPECIALISTA que adivine un ID ajeno recibe **403**. La lógica de PDF reutiliza el **mismo** `obtenerIdsVisibles` (fuerte: no hay divergencia entre listar y descargar). Detalle menor: `descargarPDF` y `anulacion.controller` aún re-coercionan el id con `Number.isNaN` (redundancia de validación, propia del Punto 4, no de seguridad).

**P2 — Transiciones críticas de estado:** ✅ **Sin brecha de aprobación/observación cruzada.** `revisar`, `aprobar`, `rechazar` y `observar` exigen `papeleta.aprobadorId === usuarioToken.id`, por lo que un JEFE **no** puede aprobar/rechazar papeletas fuera de su subordinación (solo verá y accionará donde sea el aprobador asignado). `cancelar` y `reenviar` exigen `solicitanteId === token.id`, y `anular` exige **ADMIN o aprobador**. Un ESPECIALISTA **no** puede anular/cancelar papeletas de otros.
> **Debilidad estructural detectada:** la autorización es de **comparación estática de un campo**, no de **verificación dinámica de jerarquía**. Si `aprobadorId` quedó obsoleto por un cambio de jefe/rol (o por asignación indebida vía API de usuarios), la comprobación `aprobadorId === token.id` **sigue autorizando** aunque el actor ya no sea el superior jerárquico real → **riesgo latente de autorización obsoleta** (ver A-02).

**P3 — Fuga de información en exportaciones (`GET /exportar`):** ✅ **Sin fuga.** `exportarPapeletas` **sí** aplica `obtenerIdsVisibles` (bloquea `solicitanteId` no visible con 403 y, si no se filtra, restringe con `where.solicitanteId = { in: idsVisibles }`). Un ESPECIALISTA **no** puede volcar la base completa en Excel: solo exporta lo que puede ver. La única fuga real de este bloque está en `verificar-token` (ver A-01).

### 2.4 Hallazgos (enumerados y con severidad)

#### A-01 — [CRÍTICO] `verificar-token` es un **oráculo de lectura (BOLA)** sin filtro de visibilidad
- **Dónde:** `anulacion.controller.ts` → `verificarToken` (ruta `POST /api/papeletas/verificar-token`).
- **Qué pasa:** cualquier usuario autenticado (rol ESPECIALISTA incluido) envía un `token` y, si existe, recibe **id, número, solicitante (nombres/apellidos), tipoTiempo, fechas, horas, estado y el propio token** de la papeleta, **sin** ninguna comprobación de visibilidad/jerarquía.
- **Agrava el peligro:** el token de verificación es de **6 caracteres** (~32⁶ ≈ 1.07 × 10⁹ combinaciones). El rate limit `rateLimitVerificarToken` es de **10 solicitudes / 10 min / IP** y se aplica **antes** de `authJWT`, es decir, es un límite **global por IP** sorteable con múltiples IPs o distribuyendo la fuerza bruta entre cuentas ya autenticadas. La respuesta **confirma el acierto sin ambigüedad**, por lo que un atacante decidido o distribuido puede enumerar el espacio y **leer datos personales de papeletas ajenas**.
- **Impacto:** fuga de información personal/organizacional entre trabajadores y confirmación de existencia de papeletas; es el vector más directo del módulo.
- **Recomendación (a aprobar):** aplicar visibilidad en `verificarToken` (`obtenerIdsVisibles`), **y/o** restringir `verificar-token` a roles operativamente habilitados (VIGILANTE/ADMIN/RRHH) mediante `checkRole`, **y/o** alargar el token a ≥8–10 caracteres y endurecer/segmentar el rate limiting.

#### A-02 — [ALTO] Autorización por `aprobadorId` **obsoleta** ante cambios de jerarquía o rol
- **Dónde:** `iniciarRevision`, `aprobarPapeleta`, `rechazarPapeleta`, `observarPapeleta`, `anularPapeleta`.
- **Qué pasa:** la comprobación es `papeleta.aprobadorId === usuarioToken.id`. No se revalida que el actor **siga siendo** el superior jerárquico real del solicitante. Si un jefe es reemplazado, cambia de rol o se le reasigna personal después de crear la papeleta, el **antiguo** aprobador conserva la capacidad de aprobar/rechazar/observar/anular mientras la papeleta siga con su `aprobadorId`.
- **Impacto:** un usuario con jerarquía ya inexistente puede ejecutar transiciones sobre papeletas cuyos solicitantes hoy **no** son sus subordinados → **autorización obsoleta**. Se combina con H-04 del Bloque 1 (la API de usuarios permite reasignar jefaturas sin revalidar papeletas en vuelo).
- **Recomendación:** al ejecutar transiciones de aprobación, revalidar contra la jerarquía **vigente** (p. ej. `determinarAprobador(solicitanteId)` o comprobar `solicitante.jefeId === token.id`) además del `aprobadorId`, o **recalcular `aprobadorId`** cuando cambie el jefe del usuario.

#### A-03 — [MEDIO] La DIRECTORA no ve las papeletas de los subordinados de cada JEFE
- **Dónde:** `visibilidadPapeletas.service.ts` (rama `DIRECTORA`).
- **Qué pasa:** la Directora ve `[self] + [todos los usuarios con rol JEFE]`, pero **no** a los subordinados de esos jefes (los ESPECIALISTAS/VIGILANTES). Como el grueso del personal ESPECIALISTA depende de un JEFE, la Directora **no** ve sus papeletas en listado/exportación/PDF.
- **Impacto:** no es fuga (es **sub-exposición**), pero puede ser una **brecha funcional**: la máxima autoridad no visualiza la mayoría de papeletas de la organización. Debe confirmarse la intención de negocio.
- **Recomendación:** si es un defecto, definir el alcance de la Directora (p. ej. todos los usuarios) y documentarlo.

#### A-04 — [MEDIO] `anular` permite al aprobador actuar sin revalidar su rol/actividad vigentes
- **Dónde:** `anularPapeleta` (`esAdmin || esAprobador`).
- **Qué pasa:** se permite anular al `aprobadorId` sin exigir que su rol siga siendo JEFE/DIRECTORA/RRHH en el momento y sin exigir `activo`. Una cuenta que fue aprobadora y luego fue degradada a un rol sin privilegios (o desactivada y reactivada) conserva la potestad de anular.
- **Impacto:** anulación indebida de papeletas (transición sensible: revierte una APROBADA con token emitido y bloqueos aplicados). Es un caso concreto de **autorización obsoleta** (A-02) sobre el recurso más crítico, y la anulación **no** queda auditada con el rol en ese instante.
- **Recomendación:** exigir rol autorizado vigente y revalidar jerarquía actual; registrar la anulación (por quién y con qué rol).

#### A-05 — [BAJO] `verificarToken` devuelve el **token de la papeleta** (eco) y no filtra por estado
- **Dónde:** respuesta de `verificarToken` (`token: papeleta.token`).
- **Qué pasa:** la respuesta refleja el mismo valor consultado y devuelve `valido: true` también para papeletas ANULADO/CANCELADO/RECHAZADO. El eco no aporta capacidad propia, pero **confirma** el token válido a cualquiera (refuerza A-01). El endpoint **sí** registra la consulta en `TokenVerificacion` (trazabilidad).
- **Recomendación:** no devolver el campo `token`; si se busca verificación en puerta, distinguir estados no vigentes.

#### A-06 — [BAJO] DRY roto: `descargarPDF` y `anulacion.controller` reimplementan visibilidad/validación
- **Dónde:** `pdf.controller.ts` (recalcula `Number.isNaN` y reaplica `idsVisibles` a mano) y `anulacion.controller.ts` (revalida manualmente `motivoAnulacion`/`token` pese a existir `anularPapeletaSchema`/`verificarTokenSchema`).
- **Qué pasa:** aunque hoy **coincide** con el servicio de visibilidad, la lógica está **duplicada**. Existe **riesgo de divergencia futura**: un cambio en `visibilidadPapeletas.service.ts` podría no replicarse aquí y reintroducir un BOLA.
- **Recomendación:** que `descargarPDF` use `usuarioPuedeVerPapeleta()` y que los controladores confíen en Zod (coherente con el cierre del Punto 4).

### 2.5 Resumen de severidades (Bloque 2)

| Severidad | Cantidad | Hallazgos |
|---|---|---|
| Crítico | 1 | A-01 |
| Alto | 1 | A-02 |
| Medio | 2 | A-03, A-04 |
| Bajo | 2 | A-05, A-06 |

### 2.6 Fortalezas verificadas (no requieren cambio)

1. **Lectura por ID blindada (sin IDOR):** `GET /:id` y `GET /:id/pdf` aplican la visibilidad **antes** de responder; `GET /:id/pdf` **reutiliza** `obtenerIdsVisibles` (sin divergencia listar/descargar).
2. **Exportación filtrada:** `GET /exportar` **no** permite volcar la base completa; respeta la jerarquía. (Responde directamente al Punto 3.)
3. **Transiciones de aprobación por recurso asignado:** `revisar/aprobar/rechazar/observar` exigen `aprobadorId === token.id`; `cancelar/reenviar/solicitar-anulacion/cancelar-solicitud-anulacion` exigen `solicitanteId === token.id`.
4. **Anulación con ventana temporal:** `puedeAnular` impide anular (no-admin) una papeleta de DÍAS ya iniciada o de HORAS cuyo regreso ya se registró.
5. **Creación sin suplantación:** `crearPapeleta` fija `solicitante` = token.id (no se puede crear a nombre de otro).
6. **Trazabilidad de verificación:** `verificarToken` registra la consulta en `TokenVerificacion`.
7. **Validación Zod presente** en todas las rutas del bloque (params/body/query), con esquemas `strict`.

### 2.7 Siguientes pasos (propuesta — PENDIENTE DE APROBACIÓN, sin ejecutar)

> **No se modificará ningún archivo fuente hasta que apruebes esta fase.**

1. **A-01:** decidir el modelo de `verificar-token` — (i) aplicar `obtenerIdsVisibles`, (ii) `checkRole('VIGILANTE','ADMIN','RRHH')`, y/o (iii) token de ≥8–10 caracteres + rate limit reforzado. Prioridad máxima.
2. **A-02 / A-04:** revalidar jerarquía **vigente** en las transiciones (`solicitante.jefeId === token.id` o `determinarAprobador`), y recalcular/reasignar `aprobadorId` al cambiar el jefe.
3. **A-03:** definir y aplicar el alcance de visibilidad de la DIRECTORA (confirmar regla de negocio).
4. **A-05:** dejar de devolver `token` en la respuesta de verificación.
5. **A-06:** unificar visibilidad en `descargarPDF` (usar `usuarioPuedeVerPapeleta`) y eliminar validaciones manuales redundantes de `anulacion.controller.ts`.

---

## ⛔ FIN DE LA FASE 2 — SE SOLICITA APROBACIÓN

He completado el **diagnóstico estático** del Bloque 2 (Papeletas y Visibilidad) **sin modificar código fuente**. El backend permanece **100 % intacto**. Confirma cómo continuar:

- **(a)** apruebas los hallazgos y procedo a implementar los puntos 1–5; o
- **(b)** quieres ajustar el alcance/severidades antes de implementar; o
- **(c)** continúo con la auditoría estática del siguiente bloque del Punto 5 (p. ej. Asistencias, Visitas, Notificaciones/Firmas o Reportes) antes de tocar código.

> **[BLOQUES 1 y 2 PRE-APROBADOS]:** los diagnósticos de Auth/Usuarios/Jefaturas y de Papeletas/Visibilidad quedan registrados y pre-aprobados arriba, **intactos**. Se cierra la Fase de Planificación Estricta del Punto 5 con este tercer bloque, siempre en **modo solo lectura**.

---

# Fase 3: Diagnóstico de Asistencias, Visitas y Notificaciones

> **Auditoría estática (solo lectura).** Entregable de diagnóstico del **Bloque 3 (final)**. **No se modificó ningún archivo fuente** (backend 100 % intacto).

**Alcance:** módulos `/api/asistencias`, `/api/visitas`, `/api/notificaciones`, el webhook `/api/firmas/webhook` y las exportaciones a Excel de asistencias/visitas.
**Commit base:** `f232453`.
**Archivos inspeccionados:**
- `src/routes/asistencia.routes.ts`, `src/controllers/asistencia.controller.ts`
- `src/routes/visita.routes.ts`, `src/controllers/visita.controller.ts`
- `src/routes/notificacion.routes.ts`, `src/controllers/notificacion.controller.ts`
- `src/controllers/firmaExterna.controller.ts`, `src/routes/firmaExterna.routes.ts`
- `src/controllers/reportes.controller.ts` (`exportarAsistencias`, `exportarVisitas`)
- `src/schemas/asistencia.schema.ts`, `src/schemas/notificacion.schema.ts`

### 3.1 Matriz de endpoints (Bloque 3)

| Método | Ruta | Auth | `checkRole` | Validación Zod | Autorización a nivel de recurso |
|---|---|---|---|---|---|
| POST | `/api/asistencias` | `authJWT` | VIGILANTE, ADMIN | `registrarMovimientoSchema` | — (los roles autorizados registran para cualquier `usuarioId`) |
| GET | `/api/asistencias/exportar` | `authJWT` | VIGILANTE, ADMIN, RRHH | `listarMovimientosQuerySchema` | `puedeVerTodos` → si no, `usuarioId = token.id` ✅ |
| PUT | `/api/asistencias/:id` | `authJWT` | VIGILANTE, ADMIN | params + `editarMovimientoSchema` | `—` (sin scoping; regla de 7 días solo para VIGILANTE) |
| GET | `/api/asistencias` | `authJWT` | — (cualquier rol) | `listarMovimientosQuerySchema` | ESPECIALISTA/JEFE/DIRECTORA: fuerza `usuarioId = token.id` ✅; VIGILANTE/RRHH/ADMIN: todos |
| GET | `/api/asistencias/presencia` | `authJWT` | VIGILANTE, ADMIN, RRHH | `obtenerPresenciaQuerySchema` | Presencia de **todos** los activos (filtro `jefaturaId` opcional) |
| POST | `/api/visitas` | `authJWT` | VIGILANTE, ADMIN | `registrarVisitaSchema` | `registradorId = token.id` (implícito); exige trabajador presente |
| GET | `/api/visitas/exportar` | `authJWT` | — (cualquier rol) | `listarVisitasQuerySchema` | ESPECIALISTA/JEFE/DIRECTORA: solo `trabajadorVisitadoId = token.id` ✅; resto: todas |
| GET | `/api/visitas` | `authJWT` | — (cualquier rol) | `listarVisitasQuerySchema` | Igual que exportar ✅ |
| GET | `/api/visitas/:id` | `authJWT` | — (cualquier rol) | `visitaIdParamsSchema` | ESPECIALISTA/JEFE/DIRECTORA: `trabajadorVisitadoId === token.id` ✅ |
| PUT | `/api/visitas/:id/salida` | `authJWT` | VIGILANTE, ADMIN | `visitaIdParamsSchema` | `esAdmin OR registradorId === token.id` ✅ |
| PUT | `/api/visitas/:id/gafete` | `authJWT` | VIGILANTE, ADMIN | `visitaIdParamsSchema` | **Ninguna** (solo rol) |
| PUT | `/api/notificaciones/leer-todas` | `authJWT` | — | — | `usuarioId = token.id` ✅ |
| GET | `/api/notificaciones` | `authJWT` | — | `listarNotificacionesQuerySchema` | `usuarioId = token.id` ✅ |
| PUT | `/api/notificaciones/:id/leer` | `authJWT` | — | `notificacionIdParamsSchema` | `notificacion.usuarioId === token.id` ✅ |
| POST | `/api/firmas/webhook` | **sin `authJWT`** | — | `webhookFirmaSchema` | Header `x-webhook-secret` (secreto estático compartido) |

### 3.2 Diagnóstico de los puntos geométricos solicitados

**Geométrico 1 — IDOR en Notificaciones (`PUT /:id/leer`):** ✅ **Sin brecha.** `marcarLeida` carga la notificación y exige `notificacion.usuarioId === usuarioToken.id` (**403** en caso contrario); `listarNotificaciones` y `marcarTodasLeidas` filtran por `usuarioId = token.id`. Un usuario **no** puede cambiar el `:id` en la URL para marcar como leídas (ni consultar) notificaciones de otros.

**Geométrico 2 — Control de acceso en Asistencias y Visitas:** ✅ **Sin brecha de escalada horizontal.**
- *Asistencias (consulta):* para ESPECIALISTA/JEFE/DIRECTORA el controlador **fuerza** `where.usuarioId = usuarioToken.id` **ignorando** cualquier `usuarioId` enviado en el query (`listarMovimientos`, línea 246-249). Un ESPECIALISTA **no** puede ver los movimientos de otro manipulando el parámetro.
- *Asistencias (escritura):* `POST /` y `PUT /:id` están restringidos por `checkRole('VIGILANTE','ADMIN')`; un ESPECIALISTA/JEFE/DIRECTORA/RRHH obtiene **403**.
- *Visitas:* registro/salida/gafete restringidos a `VIGILANTE/ADMIN`; `registrarSalida` exige `registradorId === token.id` (o ADMIN). El VIGILANTE queda **acotado** para las operaciones sensibles.
> **Matiz detectado:** `PUT /api/visitas/:id/gafete` **no** replica el control de `registradorId` que sí aplica `registrarSalida` → cualquier VIGILANTE puede marcar el gafete de una visita registrada por otro (ver B-02). Y en asistencias no existe control por recurso (`Movimiento` no tiene campo "registradoPor"), pero eso es consecuencia del modelo, no un IDOR explotable por roles bajos.

**Geométrico 3 — Fugas en exportaciones de Asistencias/Visitas:** ✅ **Sin volcado masivo para roles bajos.**
- `GET /api/asistencias/exportar` está restringido por `checkRole('VIGILANTE','ADMIN','RRHH')`: ESPECIALISTA/JEFE/DIRECTORA reciben **403** (no pueden exportar en absoluto). Para los autorizados, `puedeVerTodos` controla el alcance.
- `GET /api/visitas/exportar` (sin `checkRole`) **sí** aplica scoping: ESPECIALISTA/JEFE/DIRECTORA quedan limitados a `trabajadorVisitadoId = token.id` (solo lo que ellos recibieron); VIGILANTE/RRHH/ADMIN ven todo (coherente con su rol operativo).
- Conclusión: un rol de bajo privilegio **no** puede descargar el historial completo de la UGEL. El único recolector de datos amplio son roles operativos de confianza (VIGILANTE/RRHH/ADMIN), por diseño.

### 3.3 Hallazgos (enumerados y con severidad)

#### B-01 — [ALTO] Autorización del webhook de firma: secreto estático, comparación no constante y sin rate limiting
- **Dónde:** `firmaExterna.routes.ts` + `firmaExterna.controller.ts` → `POST /api/firmas/webhook`.
- **Qué pasa:** es el **único endpoint de escritura sin `authJWT`**. La autorización es un **secreto compartido estático** (`x-webhook-secret`) comparado con `secretRecibido !== secretEsperado` (**no** es de tiempo constante → fuga por temporización), **sin** rate limiting, **sin** firma HMAC del cuerpo y **sin** protección anti-replay (`timestamp`/`nonce`). Además el handler escribe `firmaExternaSvg` en **cualquier** papeleta que exista, **sin importar su estado** (incluido ANULADO/RECHAZADO).
- **Impacto:** con el secreto filtrado (o por fuerza bruta al no haber límite), un tercero puede **alterar la firma** de cualquier papeleta (integridad de un documento con validez formal). Estos puntos ya se habían marcado como **fuera del alcance del Punto 4** (H1–H3); aquí se confirman como **hallazgo de autorización del Punto 5**.
- **Recomendación (a aprobar):** comparación en tiempo constante (`crypto.timingSafeEqual`), rate limiting específico, firma HMAC + `timestamp`/`nonce` anti-replay, y restringir la escritura de firma a estados válidos de la papeleta.

#### B-02 — [MEDIO] Visitas: `marcarGafete` sin control a nivel de recurso (inconsistente con `registrarSalida`)
- **Dónde:** `visita.controller.ts` → `marcarGafete` (`PUT /api/visitas/:id/gafete`).
- **Qué pasa:** se limita solo por rol (`checkRole('VIGILANTE','ADMIN')`), sin la comprobación `esAdmin || registradorId === token.id` que sí tiene `registrarSalida`. Cualquier VIGILANTE puede marcar como entregado el gafete de una visita **registrada por otro** vigilante.
- **Impacto:** modificación de un registro ajeno por un compañero con el mismo rol (BOLA de alcance acotado); rompe la coherencia de la bitácora de visitas. Impacto funcional limitado (es un booleano), por eso MEDIO y no ALTO.
- **Recomendación:** replicar en `marcarGafete` la misma condición de propiedad (`registradorId === token.id` o ADMIN) que en `registrarSalida`.

#### B-03 — [MEDIO] Asistencias: sin control a nivel de recurso en escritura (confianza total en VIGILANTE, sin auditoría)
- **Dónde:** `asistencia.controller.ts` → `registrarMovimiento` y `editarMovimiento`.
- **Qué pasa:** no existe campo "registradoPor" en `Movimiento`; cualquier VIGILANTE puede registrar (`POST`) o editar (`PUT /:id`) movimientos de **cualquier** usuario. La única traba al editar es la regla temporal de 7 días (que **solo** aplica a VIGILANTE; ADMIN no tiene límite). No queda registro de **quién** creó o editó cada movimiento.
- **Impacto:** un VIGILANTE (rol de confianza pero de menor privilegio) puede alterar la asistencia de cualquier trabajador dentro de 7 días sin trazabilidad de autor. No es escalada de rol bajo (ESPECIALISTA está bloqueado por `checkRole`), pero sí un riesgo de integridad/repudio.
- **Recomendación:** añadir `registradoPorId`/`editadoPorId` a `Movimiento` (auditoría) y/o acotar la edición por autoría.

#### B-04 — [BAJO] `registrarMovimiento` acepta un `timestamp` arbitrario sin límite temporal (back-dating)
- **Dónde:** `registrarMovimiento` (el `timestamp` lo envía el cliente y solo se valida que sea una fecha parseable).
- **Qué pasa:** un VIGILANTE puede registrar una ENTRADA/SALIDA con fecha muy anterior o futura (no se restringe a "hoy" ni a una ventana), a diferencia de la regla de 7 días que sí acota la **edición**.
- **Impacto:** manipulación histórica de asistencia (integridad) por un rol autorizado.
- **Recomendación:** acotar el `timestamp` de registro (p. ej. ±1 día) y/o aplicar una ventana coherente con la de edición.

#### B-05 — [BAJO] Rutas de lectura de Visitas y de Asistencias sin `checkRole` (defensa en profundidad dependiente del controlador)
- **Dónde:** `GET /api/visitas`, `GET /api/visitas/exportar`, `GET /api/visitas/:id` y `GET /api/asistencias` no usan `checkRole`.
- **Qué pasa:** toda la autorización recae en el controlador. Hoy es correcto (los roles bajos quedan forzados a sus propios datos), pero es **frágil**: cualquier cambio futuro en la lógica de scoping podría exponer datos sin que el middleware lo detenga.
- **Recomendación:** añadir `checkRole(...)` explícito donde el conjunto de roles sea conocido, como segunda capa.

#### B-06 — [BAJO] Exportaciones con PII sin trazas de auditoría de descargas masivas
- **Dónde:** `exportarAsistencias` (nombres, apellidos, jefatura, horarios) y `exportarVisitas` (**DNI del visitante**, trabajador visitado, horarios).
- **Qué pasa:** están correctamente restringidas por rol/scoping, pero **no** se registra quién exportó qué ni cuándo (a diferencia de `TokenVerificacion`, que sí deja traza). Además, en `exportarAsistencias` existe una rama `!puedeVerTodos` **inalcanzable** (la ruta ya restringe el rol), lo que denota código muerto.
- **Impacto:** dificultad para auditar exfiltraciones legítimas de datos personales (cifras de asistencia y DNI).
- **Recomendación:** registrar un log de exportaciones (usuario, filtros, fecha) y eliminar la rama muerta.

### 3.4 Resumen de severidades (Bloque 3)

| Severidad | Cantidad | Hallazgos |
|---|---|---|
| Crítico | 0 | — |
| Alto | 1 | B-01 |
| Medio | 2 | B-02, B-03 |
| Bajo | 3 | B-04, B-05, B-06 |

### 3.5 Fortalezas verificadas (no requieren cambio)

1. **Notificaciones sin IDOR:** `marcarLeida` valida propiedad (`usuarioId === token.id`); listar/marcar-todas filtran por dueño.
2. **Asistencias acotadas para roles bajos:** `listarMovimientos` **fuerza** `usuarioId = token.id` para ESPECIALISTA/JEFE/DIRECTORA, ignorando el query (sin IDOR de lectura).
3. **Escritura de asistencias restringida:** `checkRole('VIGILANTE','ADMIN')` en POST/PUT; regla de 7 días para el VIGILANTE.
4. **Visitas con scoping:** registro/salida/gafete = VIGILANTE/ADMIN; `registrarSalida` exige `registradorId === token.id`; lectura y exportación acotan a ESPECIALISTA/JEFE/DIRECTORA a lo recibido.
5. **Exportación de asistencias blindada a roles operativos** (ESPECIALISTA/JEFE/DIRECTORA reciben 403): sin volcado masivo para roles bajos.
6. **Validación Zod `strict`** en todas las rutas del bloque; `webhookFirmaSchema` valida el cuerpo.
7. **Trazabilidad de verificación de tokens** (`TokenVerificacion`) como precedente de auditoría.

### 3.6 Siguientes pasos (propuesta — PENDIENTE DE APROBACIÓN, sin ejecutar)

> **No se modificará ningún archivo fuente hasta que apruebes esta fase.**

1. **B-01:** endurecer el webhook de firma (comparación en tiempo constante, rate limit, HMAC + anti-replay, restringir por estado). *(Solapa con el Punto 6; requiere decisión de alcance.)*
2. **B-02:** añadir el control `esAdmin || registradorId === token.id` a `marcarGafete`.
3. **B-03:** introducir auditoría `registradoPor`/`editadoPor` en `Movimiento` (migración Prisma) y/o acotar edición por autoría.
4. **B-04:** limitar temporalmente el `timestamp` de `registrarMovimiento`.
5. **B-05:** añadir `checkRole` explícito a las rutas de lectura de visitas/asistencias.
6. **B-06:** registrar log de exportaciones y eliminar la rama muerta de `exportarAsistencias`.

---

## ⛔ FIN DE LA FASE 3 (Y DEL PUNTO 5) — SE SOLICITA APROBACIÓN

He completado el **diagnóstico estático** del Bloque 3 (Asistencias, Visitas, Notificaciones, Webhook de firma y Exportaciones) **sin modificar código fuente**. El backend permanece **100 % intacto**. Con esto queda cubierto el **Punto 5 completo** (3 bloques: Auth/Usuarios/Jefaturas · Papeletas/Visibilidad · Asistencias/Visitas/Notificaciones).

**Resumen global del Punto 5:** **1 Crítico** (A-01, `verificar-token`), **4 Altos** (H-01, H-02, A-02, B-01), y varios Medios/Bajos por bloque. Los dos vectores de mayor prioridad son **A-01** (fuga BOLA en verificación de tokens) y **B-01** (webhook de firma).

Confirma cómo continuar:

- **(a)** apruebas el diagnóstico de los 3 bloques y procedo a **implementar** las correcciones (empezando por A-01 y B-01); o
- **(b)** quieres ajustar el alcance/severidades antes de implementar; o
- **(c)** prefieres que primero consolide un **plan de implementación unificado** del Punto 5 (orden, dependencias y archivos a tocar) sin ejecutar código todavía.
