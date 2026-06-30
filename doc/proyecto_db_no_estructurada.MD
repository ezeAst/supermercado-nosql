# Diseño de una solución NoSQL para la gestión de pedidos y operación de almacén en una plataforma de supermercado online: caso Instacart Market Basket Analysis

**Curso:** Bases de Datos No Estructuradas, Maestría en Informática, PUCP
**Integrantes:** [Nombre 1], [Nombre 2]

---

## 1. Descripción

El presente proyecto aborda el diseño de una solución basada en bases de datos no estructuradas para una plataforma de supermercado online. El caso de estudio se construye a partir del dataset *Instacart Market Basket Analysis* (Kaggle), que registra el historial de usuarios, órdenes, productos, pasillos, departamentos y patrones de recompra. Este conjunto de datos permite reproducir un escenario de comercio electrónico de productos de supermercado, en el que coexisten dos perspectivas: la del cliente final y la del personal de almacén.

Desde la perspectiva del cliente, el reto consiste en ofrecer una experiencia de compra ágil: consultar productos, navegar por categorías, gestionar un carrito, generar pedidos y revisar el historial de compras. Desde la perspectiva operativa, el personal de almacén requiere visibilidad sobre los pedidos pendientes, la ubicación lógica de los productos (pasillo/departamento) y el estado de preparación de cada paquete, de modo que un pedido no se modele únicamente como una lista de productos, sino también como una unidad de trabajo para el almacén.

El dataset de Instacart cubre parcialmente ambos frentes: la información de usuarios, órdenes y productos sustenta el modelado del comportamiento de compra, mientras que pasillos y departamentos permiten organizar los productos desde una óptica logística. Dado que el dataset fue diseñado originalmente para análisis de comportamiento y no para operar una plataforma real, se enriquecerá con atributos adicionales (precio, stock, estado del pedido, estado de preparación, zona de almacenamiento, dirección de entrega simulada, método de pago y prioridad de atención) únicamente cuando sean necesarios para sustentar un requerimiento funcional o justificar el uso de las bases de datos elegidas.

En conjunto, el proyecto propone una arquitectura NoSQL combinando **MongoDB** (para el modelado flexible de catálogo, pedidos e historial) y **Redis** (para operaciones de alta velocidad como carrito de compras y estado de preparación en tiempo real), demostrando cómo este tipo de tecnologías responde a necesidades de flexibilidad, escalabilidad y eficiencia en un entorno de supermercado online.

> 📌 **[DIAGRAMA 1 — Arquitectura general]**
> Cliente / App → Capa de APIs → MongoDB (catálogo, pedidos, historial) + Redis (carrito, estado en tiempo real). Mostrar también al personal de almacén como segundo consumidor de las APIs.

---

## 2. Requerimientos

### 2.1 Requerimientos funcionales

**Cliente final**
- RF01: El sistema debe permitir consultar el catálogo de productos, organizado por categorías (pasillo/departamento).
- RF02: El sistema debe permitir agregar, modificar y eliminar productos de un carrito de compras.
- RF03: El sistema debe permitir generar un pedido a partir del contenido del carrito.
- RF04: El sistema debe permitir al cliente consultar el estado de un pedido en curso (registrado, en preparación, despachado, entregado).
- RF05: El sistema debe permitir al cliente consultar su historial de pedidos anteriores.

**Almacén**
- RF06: El sistema debe permitir al personal de almacén visualizar los pedidos pendientes de preparación.
- RF07: El sistema debe permitir agrupar los productos de un pedido según su pasillo/departamento, para facilitar el picking.
- RF08: El sistema debe permitir actualizar el estado de preparación de un pedido (pendiente, en preparación, listo para despacho).

### 2.2 Requerimientos no funcionales
- RNF01: **Disponibilidad** — el sistema debe mantenerse operativo y responder a consultas de catálogo y carrito incluso ante fallos parciales de infraestructura.
- RNF02: **Escalabilidad** — el sistema debe soportar el crecimiento del volumen de usuarios, productos y pedidos sin degradar el servicio.
- RNF03: **Desempeño** — las operaciones de carrito y consulta de estado de pedido (alta frecuencia) deben responder con baja latencia.
- RNF04: **Flexibilidad de esquema** — el modelo de datos debe permitir incorporar nuevos atributos de producto o pedido sin requerir migraciones costosas.
- RNF05: **Consistencia eventual aceptable** — para operaciones no críticas (catálogo, historial) se acepta un retraso breve en la propagación de cambios, priorizando disponibilidad.

*(El cómo se garantiza cada uno de estos NFR —en términos de CAP theorem— se desarrolla en la sección 3.)*

---

## 3. Elección de bases de datos no estructuradas

### 3.1 Elección de bases de datos

**MongoDB (orientada a documentos)**
Se elige para modelar catálogo, pedidos e historial de compras porque:
- El esquema de productos y pedidos varía y se enriquece con atributos adicionales (RNF04), lo que un esquema flexible basado en documentos soporta sin migraciones.
- Permite representar de forma natural un pedido como un documento que embebe sus productos, evitando joins costosos al consultar historial.
- Su motor de agregación facilita las consultas operativas del almacén (agrupar productos de un pedido por pasillo/departamento, RF07).

**Redis (clave-valor en memoria)**
Se elige para el carrito de compras y el estado de preparación en tiempo real porque:
- El carrito es una estructura de acceso muy frecuente, de corta duración y por usuario; Redis ofrece la latencia mínima que exige RNF03.
- Soporta expiración automática (TTL), útil para carritos abandonados.
- Su modelo simple de clave-valor es suficiente, ya que el carrito no requiere consultas complejas, solo lecturas/escrituras rápidas.

### 3.2 CAP theorem

Dado que RNF01 (disponibilidad) y RNF02 (escalabilidad) son prioritarios para la experiencia de compra, y que RNF05 acepta consistencia eventual en operaciones no críticas (catálogo, historial), **ambas bases de datos se configuran priorizando el lado AP (disponibilidad + tolerancia a particiones)**:

- **MongoDB** se despliega como *replica set*. Las escrituras van al nodo primario, pero las lecturas de catálogo e historial pueden resolverse contra secundarios (`readPreference: secondaryPreferred`), priorizando disponibilidad sobre consistencia estricta. Ante una partición, el sistema sigue respondiendo lecturas aunque algún nodo esté desactualizado.
- **Redis** se despliega con replicación asíncrona maestro-réplica. Las escrituras del carrito se confirman en el nodo maestro sin esperar la propagación a réplicas, priorizando baja latencia y disponibilidad; ante una falla del maestro, una réplica lo sustituye aunque pueda perder los últimos milisegundos de escritura (aceptable para un carrito, no para un pedido ya confirmado).

**Excepción justificada:** la creación del pedido (al confirmar el carrito) es una operación crítica de negocio (no debe duplicarse ni perderse), por lo que en ese punto específico se prioriza consistencia sobre disponibilidad (ver flujo en 3.3), sin que esto cambie la orientación general AP de la arquitectura.

### 3.3 Consistencia entre MongoDB y Redis

El punto donde ambas bases deben mantenerse consistentes es la **confirmación del pedido** (el carrito en Redis se convierte en un pedido en MongoDB). El flujo implementado es:

1. **Pre-check de idempotency:** antes de ejecutar nada, el backend busca en MongoDB si la `Idempotency-Key` recibida en el header ya existe. Si existe, devuelve el pedido original con HTTP 409 sin reejecutar ninguna operación. Esto protege contra reintentos de red duplicados.
2. El backend lee el contenido actual del carrito desde Redis (`HGETALL carrito:{usuario_id}`). Si el carrito está vacío o no existe, devuelve HTTP 400.
3. El backend valida el stock de cada producto en MongoDB y crea el documento de pedido con estado `registrado`, embebiendo un snapshot de los productos (nombre, precio y pasillo al momento de la compra) y la `idempotency_key` única.
4. Si la escritura en MongoDB es exitosa, el backend escribe en Redis el estado inicial del pedido: `SET pedido_estado:{pedido_id} "registrado"` con TTL 24h. Esto habilita RF04 (consulta de estado en tiempo real con latencia O(1)).
5. El backend elimina la clave del carrito en Redis (`DEL carrito:{usuario_id}`). Si esta eliminación falla, el carrito caduca igualmente por su TTL de 24h. Para que el usuario no perciba este fallo, el frontend limpia el carrito de forma optimista en cuanto recibe la respuesta 201, sin esperar la confirmación del borrado en Redis.

**Casos de fallo:**
- Si falla el paso 3 (MongoDB): el carrito permanece intacto en Redis y el cliente puede reintentar; el `idempotency_key` garantiza que un reintento exitoso no genere un pedido duplicado.
- Si falla el paso 4 (Redis, escritura de estado): el pedido ya quedó persistido en MongoDB; el endpoint de detalle de pedido (`GET /pedidos/{id}`) puede leer el campo `estado` directamente de MongoDB como fallback.
- Si falla el paso 5 (Redis, eliminación de carrito): el TTL de 24h limpia el carrito; es el único caso donde el frontend actúa de forma optimista.

Con este diseño, Redis nunca es la fuente de verdad del pedido confirmado (solo del carrito en curso y del estado en tiempo real), y MongoDB nunca depende de Redis para garantizar la integridad de un pedido ya creado.

> 📌 **[DIAGRAMA 2 — Flujo de consistencia Redis → MongoDB]**
> Diagrama de secuencia con los 5 pasos descritos arriba (leer carrito → validar/crear pedido → eliminar carrito → casos de falla en pasos 3 y 2).

---

## 4. Modelado de datos

### 4.1 MongoDB

**Criterio embebido vs. referencia:** se embebe cuando el dato pertenece a un solo documento y se escribe una sola vez (caso `pedidos`↔productos: cada producto dentro de un pedido es un snapshot único de ese pedido, que nunca se actualiza después de creado). Se referencia cuando el dato es compartido por muchos documentos y se actualiza de forma independiente (caso `productos`↔`pasillos`↔`departamentos`: un pasillo puede agrupar cientos de productos, y si se embebiera el pasillo completo dentro de cada producto, actualizar un solo atributo del pasillo —p. ej. su encargado de área— obligaría a actualizar todos esos productos a la vez, una anomalía de actualización clásica). Como solución híbrida, se referencia la colección completa de `pasillos`/`departamentos`, pero se denormaliza únicamente su `nombre` dentro de `producto` (campo de solo lectura, prácticamente inmutable) para evitar joins en la consulta operativa más frecuente del almacén (RF07).

**Espacio de nombres:** `supermercado_db`

**Colecciones (5):**

| Colección | Propósito | Volumen esperado |
|---|---|---|
| `usuarios` | Datos del cliente | Alto |
| `productos` | Catálogo, con pasillo/departamento denormalizados | Alto |
| `pedidos` | Pedido con productos embebidos (snapshot) | Muy alto |
| `pasillos` | Catálogo de referencia (para filtros de navegación) | Bajo, estático |
| `departamentos` | Catálogo de referencia (para filtros de navegación) | Bajo, estático |

`pasillos` y `departamentos` se mantienen como colecciones de referencia. Más allá de poblar filtros de navegación, ahora contienen atributos operativos propios (zona de almacenamiento, encargado de área, conteo de productos) que el almacén consulta directamente, lo que justifica que sean colecciones independientes y no solo un atributo embebido. El nombre del pasillo/departamento se denormaliza además dentro de cada producto, para que las consultas operativas del almacén (RF07) no requieran join en el caso de uso más frecuente.

**Diseño de llaves**
- `usuarios._id`: ObjectId autogenerado.
- `productos._id`: ObjectId autogenerado; se indexa `pasillo_id` y `departamento_id` para agrupaciones rápidas.
- `pedidos._id`: ObjectId autogenerado; se indexa `usuario_id` y `estado`.
- `pasillos._id` / `departamentos._id`: enteros (igual que el dataset Instacart original), para mantener trazabilidad con la fuente.

**Diseño de documentos JSON**

```json
// usuarios
{
  "_id": ObjectId("..."),
  "nombre": "Ana Torres",
  "email": "ana.torres@example.com",
  "direcciones": [
    { "etiqueta": "casa", "direccion": "Av. Siempre Viva 123, Lima" }
  ],
  "metodo_pago_predeterminado": "tarjeta"
}
```

```json
// productos
{
  "_id": ObjectId("..."),
  "nombre": "Leche Entera 1L",
  "precio": 4.50,
  "stock": 120,
  "pasillo_id": 84,
  "pasillo_nombre": "lácteos",
  "departamento_id": 16,
  "departamento_nombre": "dairy eggs"
}
```

```json
// pedidos
{
  "_id": ObjectId("..."),
  "usuario_id": ObjectId("..."),
  "estado": "en_preparacion",
  "fecha_creacion": "2026-06-29T10:00:00Z",
  "direccion_entrega": "Av. Siempre Viva 123, Lima",
  "metodo_pago": "tarjeta",
  "productos": [
    {
      "producto_id": ObjectId("..."),
      "nombre": "Leche Entera 1L",
      "precio_unitario": 4.50,
      "cantidad": 2,
      "pasillo_id": 84,
      "pasillo_nombre": "lácteos"
    }
  ],
  "total": 9.00
}
```

```json
// pasillos
{
  "_id": 84,
  "nombre": "lácteos",
  "departamento_id": 16,
  "zona_almacen": "Zona B - Refrigerados",
  "encargado_area": "Juan Pérez",
  "cantidad_productos": 245
}
```

```json
// departamentos
{
  "_id": 16,
  "nombre": "dairy eggs",
  "zona_almacen": "Ala Norte",
  "encargado_area": "María Gómez",
  "cantidad_productos": 1320,
  "cantidad_pasillos": 6
}
```

**Diseño de nodos y relaciones**
No aplica: el proyecto no utiliza una base de datos orientada a grafos. Las relaciones entre entidades se modelan mediante embebido (pedido↔productos) y referencia simple por ID (producto↔pasillo↔departamento), como se detalla arriba.

> 📌 **[DIAGRAMA 3 — Modelo de datos / documentos]**
> Diagrama tipo entidad-relación adaptado a documentos: `productos` referencia (línea punteada) a `pasillos`/`departamentos`; `pedidos` embebe (línea sólida, "contiene") un arreglo de productos-snapshot. Distinguir visualmente embebido vs. referencia.

### 4.2 Redis

**Espacio de nombres (prefijos de clave):**

| Prefijo | Tipo de estructura | Contenido |
|---|---|---|
| `carrito:{usuario_id}` | Hash | `{producto_id: cantidad}` del carrito en curso |
| `pedido_estado:{pedido_id}` | String | Estado en tiempo real para consulta rápida del almacén |
| `sesion:{usuario_id}` | String | Token de sesión activa |

**Diseño de llaves:** se usa el patrón `entidad:identificador` para mantener namespaces claros y permitir `SCAN carrito:*` en mantenimiento. El `usuario_id` y `pedido_id` corresponden a los mismos ObjectId usados en MongoDB, para que ambas bases sean trazables entre sí.

**Ejemplo:**
```
HSET carrito:64f1a2... producto_64f9b1... 2
HSET carrito:64f1a2... producto_64f9c4... 1
EXPIRE carrito:64f1a2... 86400   # TTL 24h, carrito abandonado

SET pedido_estado:64f2c3... "en_preparacion"
```

**Diseño de nodos y relaciones**
No aplica (Redis no es una base de grafos). La relación con MongoDB es por convención de ID compartido, no por una relación nativa de la base.

---

## 5. Particionamiento e Indexación

### 5.1 Particionamiento (sharding)

Se evalúa la necesidad de particionar bajo el criterio de RNF02 (escalabilidad ante crecimiento de volumen).

| Colección | ¿Se particiona? | Justificación |
|---|---|---|
| `pedidos` | **Sí** | Es la colección de mayor volumen y crecimiento continuo (cada compra genera un documento). Sin partición, un solo nodo terminaría limitando tanto el almacenamiento como el throughput de escritura. |
| `productos` | No | Volumen moderado y relativamente estable; un único nodo (replicado) es suficiente. |
| `usuarios` | No | Volumen bajo respecto a `pedidos`; no justifica la complejidad operativa de un clúster fragmentado. |
| `pasillos` / `departamentos` | No | Catálogos pequeños y casi estáticos. |

**Shard key para `pedidos`:** `usuario_id` (hasheado).
- Distribuye las escrituras de forma pareja entre shards (evita "hot shard" por usuarios muy activos o por fecha reciente).
- La consulta más frecuente sobre esta colección es "historial de pedidos de un usuario" (RF05) y "pedidos pendientes" (RF06 vía índice, ver 5.2); al hashear por `usuario_id`, el primer caso se resuelve consultando un solo shard en lugar de todos (sin fan-out).

**Redis:** si el volumen de carritos/sesiones lo justifica, se puede desplegar **Redis Cluster**. Como las claves ya siguen el patrón `entidad:{id}`, Redis distribuye automáticamente cada clave a un *hash slot* según su identificador, sin necesidad de rediseñar el esquema de llaves.

### 5.2 Indexación

Definidos a partir de las operaciones de búsqueda que exigen los requerimientos funcionales:

| Colección | Índice | RF que lo justifica |
|---|---|---|
| `productos` | `{ pasillo_id: 1 }`, `{ departamento_id: 1 }` | RF07 (agrupar productos por pasillo/depto para picking) |
| `productos` | Índice de texto en `nombre` | RF01 (búsqueda de productos en catálogo) |
| `pedidos` | `{ usuario_id: 1, fecha_creacion: -1 }` (compuesto) | RF05 (historial del usuario, ordenado por fecha) |
| `pedidos` | `{ estado: 1 }` | RF06 (almacén consulta pedidos pendientes) |
| `pedidos` | `idempotency_key` (único, sparse) | RF03 (prevención de pedidos duplicados por reintentos de red) |
| `usuarios` | `{ email: 1 }` (único) | Autenticación / login |

El índice `idempotency_key` se define como **sparse** porque solo los pedidos creados a través del endpoint de confirmación incluyen este campo; un índice normal en un campo ausente indexaría `null` en documentos sin él, generando colisiones falsas.

El índice compuesto `{ usuario_id: 1, fecha_creacion: -1 }` también sustenta la **paginación por cursor**: el parámetro `before` (ISO 8601) traduce a `fecha_creacion < before`, evitando el problema clásico de la paginación por offset donde inserciones concurrentes desplazan páginas y causan que el usuario vea items repetidos o se salte otros. Con el cursor, cada página retoma exactamente desde el último elemento visto.

En Redis no se definen índices adicionales: el acceso es siempre directo por clave (`O(1)`), que es justamente la razón por la que se eligió para carrito y estado en tiempo real (RNF03).

---

## 6. Diseño de APIs

Se eligieron 4 APIs que cubren los flujos de negocio más críticos del sistema y el monitoreo de infraestructura. Cada API agrupa los endpoints necesarios para responder completamente a su requerimiento funcional.

### 6.1 API 1 — Gestión del carrito de compras

Responde a RF02 (gestionar carrito) y RF03 (generar pedido). Opera principalmente sobre Redis, excepto la confirmación del pedido que cruza a MongoDB (ver flujo en sección 3.3).

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/carritos/{usuario_id}` | Ver contenido actual del carrito |
| `POST` | `/api/v1/carritos/{usuario_id}/productos` | Agregar producto al carrito |
| `PUT` | `/api/v1/carritos/{usuario_id}/productos/{producto_id}` | Actualizar cantidad de un producto |
| `DELETE` | `/api/v1/carritos/{usuario_id}/productos/{producto_id}` | Eliminar producto del carrito |
| `POST` | `/api/v1/carritos/{usuario_id}/confirmar` | Confirmar carrito y generar pedido |

**Detalle del endpoint principal: `POST /api/v1/carritos/{usuario_id}/confirmar`**

| | |
|---|---|
| **Headers** | `Idempotency-Key` (obligatorio) |
| **Request body** | `{ "direccion_entrega": "string", "metodo_pago": "tarjeta\|efectivo" }` |
| **Respuesta 201** | `{ "pedido_id": "...", "estado": "registrado", "total": 9.00, "productos": [...] }` |
| **Respuesta 400** | Carrito vacío o inexistente en Redis |
| **Respuesta 409** | `Idempotency-Key` ya usado (se retorna el pedido existente) |
| **Respuesta 422** | Producto sin stock suficiente |

### 6.2 API 2 — Operación de almacén

Responde a RF06 (ver pedidos pendientes), RF07 (agrupar por pasillo) y RF08 (actualizar estado de preparación). Opera sobre MongoDB.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/almacen/pedidos/pendientes` | Listar pedidos pendientes agrupados por pasillo (picking view) |
| `GET` | `/api/v1/almacen/pedidos` | Cola de pedidos pendientes individuales (vista de gestión) |
| `PATCH` | `/api/v1/almacen/pedidos/{pedido_id}/estado` | Actualizar estado de preparación del pedido |

**Detalle: `GET /api/v1/almacen/pedidos/pendientes`**

| | |
|---|---|
| **Query params** | `pasillo_id` (filtro opcional) |
| **Lógica interna** | Usa índice `{estado: 1}` + agregación `$unwind`+`$group` sobre productos embebidos |
| **Respuesta 200** | `{ "pasillo_id": 84, "pasillo_nombre": "lácteos", "productos_a_preparar": [{ "producto_id": "...", "nombre": "...", "cantidad_total": 5, "pedidos": ["..."] }] }` |
| **Respuesta 204** | Sin pedidos pendientes |

**Detalle: `PATCH /api/v1/almacen/pedidos/{pedido_id}/estado`**

| | |
|---|---|
| **Request body** | `{ "estado": "en_preparacion\|listo_para_despacho" }` |
| **Lógica interna** | Actualiza campo `estado` en MongoDB + actualiza `pedido_estado:{pedido_id}` en Redis |
| **Respuesta 200** | `{ "pedido_id": "...", "estado": "listo_para_despacho" }` |
| **Respuesta 404** | Pedido no encontrado |
| **Respuesta 422** | Transición de estado inválida |

### 6.3 API 3 — Historial y seguimiento de pedidos

Responde a RF04 (seguimiento de estado en curso) y RF05 (historial de compras). Opera sobre MongoDB usando el índice compuesto `{usuario_id: 1, fecha_creacion: -1}`.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/usuarios/{usuario_id}/pedidos` | Historial de pedidos del usuario paginado |
| `GET` | `/api/v1/usuarios/{usuario_id}/pedidos/{pedido_id}` | Detalle completo de un pedido |

**Detalle: `GET /api/v1/usuarios/{usuario_id}/pedidos`**

| | |
|---|---|
| **Query params** | `estado` (filtro opcional), `limit` (default 20), `before` (cursor de paginación) |
| **Respuesta 200** | `{ "pedidos": [{ "pedido_id": "...", "fecha_creacion": "...", "estado": "...", "total": 9.00 }], "siguiente_cursor": "2026-06-01T..." }` |
| **Respuesta 404** | Usuario no existe |

**Detalle: `GET /api/v1/usuarios/{usuario_id}/pedidos/{pedido_id}`**

| | |
|---|---|
| **Respuesta 200** | Documento completo del pedido incluyendo productos embebidos, estado, total y dirección |
| **Respuesta 404** | Pedido no encontrado o no pertenece al usuario |

### 6.4 API 4 — Monitoreo de infraestructura

No responde a un requerimiento funcional de negocio sino al propósito de **observabilidad**: exponer en tiempo real el estado de la infraestructura NoSQL para demostrar visualmente el comportamiento AP (que las lecturas continúan en secundarios durante una elección de primario, y que la replicación Redis es asíncrona pero casi instantánea). Esta API es consumida por el tab "🔬 Infraestructura" del frontend.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/infra/mongo/replica-set` | Estado de los 3 nodos: rol (PRIMARY/SECONDARY), health y lag de replicación en segundos |
| `GET` | `/api/v1/infra/mongo/indices` | Índices activos por colección con su tipo y campos |
| `GET` | `/api/v1/infra/redis/info` | Estado de replicación master/replica: rol, `connected_slaves`, offsets, `master_link_status` |
| `GET` | `/api/v1/infra/redis/claves` | Claves activas con tipo, TTL y valor resumido (usa `SCAN` para no bloquear) |

**Justificación de diseño:** usar `SCAN` (en lugar de `KEYS *`) en el endpoint de claves Redis es obligatorio en producción porque `KEYS` bloquea el event loop de Redis; `SCAN` itera por lotes sin bloqueo, aunque no garantiza un snapshot atómico (aceptable para un endpoint de monitoreo).

Las 4 APIs se implementan con documentación OpenAPI/Swagger completa (sección 7), accesible en `http://localhost:8000/docs`.

> 📌 **[DIAGRAMA 4 — Secuencia de APIs 2 y 3]**
> Diagrama de secuencia para API 2 (almacén→API→MongoDB, agregación por pasillo) y API 3 (cliente→API→MongoDB, índice usuario+fecha). La API 1 está cubierta por el Diagrama 2.

---

## 7. Implementación de APIs

### 7.1 Stack tecnológico

| Componente | Tecnología | Versión | Rol |
|---|---|---|---|
| Lenguaje | Python | 3.11 | Backend |
| Framework API | FastAPI | 0.115.6 | REST + OpenAPI/Swagger automático |
| Driver MongoDB | Motor | 3.6.0 | Cliente async basado en PyMongo + asyncio |
| Driver Redis | redis-py | 5.2.1 | Cliente async para Redis |
| Validación | Pydantic | 2.10.4 | Modelos de datos y esquemas de request/response |
| Servidor ASGI | Uvicorn | 0.34.0 | Servidor de producción para FastAPI |
| Configuración | python-dotenv | 1.0.1 | Variables de entorno desde `.env` |

**Justificación de FastAPI:** genera automáticamente la documentación OpenAPI/Swagger (`/docs`) a partir de los tipos y modelos Pydantic, sin configuración adicional. Su soporte nativo de `async/await` es compatible con los drivers async de MongoDB y Redis, evitando bloqueos en el event loop.

### 7.2 Estructura del proyecto

```
app/
├── main.py          # Inicialización FastAPI + lifespan (setup/teardown de conexiones)
├── db/
│   ├── mongo.py     # Motor async client; readPreference=secondaryPreferred hardcoded
│   └── redis.py     # redis-py async client; decode_responses=True
├── models/          # Esquemas Pydantic: validación de entrada y forma de respuesta
├── routes/          # Routers FastAPI (reciben HTTP, delegan a services, retornan respuesta)
└── services/        # Lógica de negocio y acceso a DB (toda la interacción con Mongo/Redis)
```

**Justificación del patrón routes/services:** mantener los routes delgados —sin lógica de negocio ni acceso directo a DB— permite testear los servicios de forma independiente del framework HTTP. También evita que cambios en la capa de transporte (p. ej. añadir WebSockets) requieran modificar la lógica de negocio.

Las conexiones a MongoDB y Redis se inicializan una sola vez en el `lifespan` de FastAPI (contexto de startup/shutdown), y se inyectan en los servicios vía dependencias, garantizando que no se creen conexiones por request.

### 7.3 Infraestructura de despliegue

El sistema se orquesta con **Docker Compose**, que levanta 7 servicios en la red `supermercado-net`:

| Servicio | Imagen | Puerto | Rol |
|---|---|---|---|
| `api` | Python 3.11-slim | 8000 | FastAPI con uvicorn (hot-reload en desarrollo) |
| `mongo-primary` | mongo:6.0 | 27017 | Nodo PRIMARY del replica set |
| `mongo-secondary1` | mongo:6.0 | interno | Nodo SECONDARY 1 |
| `mongo-secondary2` | mongo:6.0 | interno | Nodo SECONDARY 2 |
| `mongo-init` | mongo:6.0 | — | Ejecuta `rs.initiate()` al arrancar (corre una sola vez) |
| `redis-master` | redis:7 | 6379 | Master Redis (todas las escrituras) |
| `redis-replica` | redis:7 | interno | Réplica async (solo lectura) |

Todos los datos persisten en volúmenes Docker nombrados, de modo que `docker-compose down` no destruye la base de datos; solo `docker-compose down -v` elimina los volúmenes.

**Justificación del servicio `mongo-init`:** la inicialización del replica set (`rs.initiate()`) requiere que los 3 nodos de MongoDB estén en red. El servicio `mongo-init` espera a que los nodos estén listos (healthcheck), ejecuta la inicialización vía `mongosh` y termina. El servicio `api` depende de `mongo-init` para garantizar que el replica set esté elegido antes de aceptar tráfico.

### 7.4 Inicialización del sistema

```bash
# 1. Configurar variables de entorno
cp .env.example .env

# 2. Levantar toda la infraestructura
docker-compose up -d
# El replica set MongoDB y la replicación Redis se configuran automáticamente

# 3. Poblar la base de datos (solo la primera vez)
docker exec -it supermercado-nosql-api-1 python scripts/seed.py
# Carga: 134 pasillos, 21 departamentos, 250 productos, 15 usuarios de prueba
# Crea todos los índices vía scripts/create_indexes.py

# 4. Acceder al sistema
# UI interactiva: http://localhost:8000/static/index.html
# Swagger/OpenAPI: http://localhost:8000/docs
# Health check:   http://localhost:8000/health
```

### 7.5 Patrones de implementación clave

**Confirmación de pedido con idempotency** (`app/services/carrito_service.py`):

El endpoint `POST /api/v1/carritos/{usuario_id}/confirmar` implementa el flujo de 5 pasos descrito en la sección 3.3. La clave técnica es el header `Idempotency-Key` (UUID generado por el cliente): el servicio primero busca ese valor en el índice único y sparse de `pedidos`; si ya existe, retorna HTTP 409 con el pedido original sin ejecutar ninguna operación adicional, haciendo el endpoint **seguro para reintentos** ante cortes de red.

**Agregación para picking** (`app/services/almacen_service.py`):

El pipeline de MongoDB para `GET /almacen/pedidos/pendientes` usa la siguiente secuencia:
```
$match {estado: {$in: ["registrado", "en_preparacion"]}}
→ $unwind $productos
→ $group por {pasillo_id, producto_id} → sum cantidades
→ $group por pasillo_id → forma array de productos
→ $lookup a pasillos → obtiene zona y encargado
→ $sort por zona_almacen
```
Este pipeline aprovecha tanto el índice `{estado: 1}` (para el `$match` inicial) como el campo denormalizado `pasillo_id` dentro del array de productos embebidos. El `$lookup` final a `pasillos` es aceptable porque se ejecuta sobre un resultado ya filtrado y agrupado (pocos documentos), no sobre la colección completa.

**Escritura dual para actualizaciones de estado** (`app/services/almacen_service.py`):

Al actualizar el estado de un pedido (`PATCH /almacen/pedidos/{id}/estado`), el servicio escribe primero en MongoDB (`$set {estado: ...}`, fuente de verdad permanente) y luego en Redis (`SET pedido_estado:{id} ...` con TTL 24h, cache de acceso rápido). Si la escritura en Redis falla, se registra en logs pero no interrumpe la respuesta — la consistencia final se mantiene porque el endpoint de detalle de pedido puede leer de MongoDB como fallback.

**Estado en tiempo real con fallback** (`app/services/pedido_service.py`):

`GET /usuarios/{uid}/pedidos/{pedido_id}` consulta Redis primero (`GET pedido_estado:{id}`). Si la clave existe, la incluye en la respuesta como `estado_redis` (latencia O(1)). Si no existe (TTL expirado o Redis no disponible), usa el campo `estado` persistido en el documento MongoDB, garantizando que el endpoint nunca falle por la ausencia de Redis.

**Paginación por cursor** (`app/services/pedido_service.py`):

`GET /usuarios/{uid}/pedidos` acepta un parámetro `before` (timestamp ISO 8601). La query resultante es `{usuario_id: uid, fecha_creacion: {$lt: before}}` con `sort({fecha_creacion: -1})` y `limit(n)`, usando el índice compuesto. El cursor para la siguiente página es el `fecha_creacion` del último elemento retornado. Esta técnica es inmune a inserciones concurrentes: a diferencia del offset que se recalcula desde el inicio, el cursor apunta a una posición absoluta en el orden de la colección.

**Enriquecimiento del carrito** (`app/services/carrito_service.py`):

`GET /carritos/{uid}` no almacena datos de producto en Redis (solo IDs y cantidades). Al leer el carrito, el servicio obtiene todos los `producto_id` del hash Redis y hace **una sola consulta** a MongoDB con `{_id: {$in: [ids]}}` para obtener nombre, precio y stock actual. Este enfoque evita la duplicación de datos en Redis y garantiza que el carrito muestre siempre el precio y stock más reciente del catálogo.
