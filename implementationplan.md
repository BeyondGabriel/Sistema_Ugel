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
