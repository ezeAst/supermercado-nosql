# Guión de exposición — Plataforma de Supermercado Online NoSQL

**Curso:** Bases de Datos No Estructuradas, Maestría en Informática, PUCP  
**Sistema:** `http://localhost:8000/static/index.html`  
**Swagger:** `http://localhost:8000/docs`

---

## Bloque 1 — Arquitectura + Demo de resiliencia (6–8 min)

> Abrir tab **🔬 Infraestructura** y activar auto-refresh cada 5s.

### Parte A — Demo de elección de primario MongoDB (AP en acción)

> Esta demo demuestra visualmente por qué se eligió la orientación AP.

**Paso 1:** Con los 3 nodos visibles y auto-refresh activo, bajar el primario:
```bash
docker stop supermercado-nosql-mongo-primary-1
```

**Paso 2:** Observar el tab — en aproximadamente **10–15 segundos** uno de los SECONDARY es elegido nuevo PRIMARY. El borde verde del panel cambia de nodo. Esto es la **elección de Raft** del replica set.

**Paso 3:** Con el primario original caído, demostrar que la app sigue respondiendo:
- Buscar un producto en el catálogo → responde (lectura en secundario).
- Agregar un producto al carrito → responde (operación Redis, no afectada por MongoDB).

> Mensaje clave: la app mantiene disponibilidad incluso ante la caída de un nodo primario. Esto es AP en acción.

**Paso 4:** Reiniciar el nodo caído:
```bash
docker start supermercado-nosql-mongo-primary-1
```

**Paso 5:** Refrescar el tab — el nodo vuelve como SECONDARY (el nuevo primario conserva su rol). El cluster se recuperó solo, sin intervención manual.

---

### Parte B — Demo de replicación Redis en tiempo real

**Paso 1:** Escribir una clave directamente en el master:
```bash
docker exec supermercado-nosql-redis-master-1 redis-cli SET demo:clave "hola desde master"
```

**Paso 2:** Leer esa clave desde la réplica:
```bash
docker exec supermercado-nosql-redis-replica-1 redis-cli GET demo:clave
# respuesta esperada: "hola desde master"
```

> Mensaje clave: la réplica recibe los datos del master de forma asíncrona. Si el master falla, la réplica ya tiene los datos.

**Paso 3:** Refrescar el tab de Infraestructura → verificar que el `slave_repl_offset` de la réplica coincide con el `master_repl_offset` (sincronización completada).

**Paso 4:** Limpiar la clave de demo:
```bash
docker exec supermercado-nosql-redis-master-1 redis-cli DEL demo:clave
```

---

## Bloque 2 — Vista cliente (5–7 min)

> Ir al tab **🛒 Vista Cliente**.

### 2.1 Catálogo y búsqueda

1. **Seleccionar usuario** del dropdown → el sistema carga la lista de usuarios desde la colección `usuarios` en MongoDB.

2. **Buscar por texto**: usar el buscador del catálogo con "leche":
   - Internamente llama `GET /api/v1/productos?search=leche`
   - Usa el **índice de texto** en `nombre` con ranking por `$meta: textScore`.

3. **Filtrar por pasillo**: seleccionar un pasillo del filtro:
   - Llama `GET /api/v1/productos?pasillo_id=84`
   - Usa el **índice `{pasillo_id: 1}`** para filtrar sin scan completo.

### 2.2 Carrito en Redis

4. **Agregar 2–3 productos** al carrito con el botón "+ Agregar":
   - Cada click llama `POST /api/v1/carritos/{uid}/productos`
   - Redis ejecuta `HINCRBY carrito:{uid} {producto_id} 1` → hash con TTL de 24h.

5. Ir al tab **🔬 Infraestructura → Redis claves activas** → mostrar:
   - Clave `carrito:{uid}` de tipo `hash`.
   - Campos: `{producto_id: cantidad}`.
   - TTL ~86400 segundos.

### 2.3 Confirmación del pedido — flujo de 5 pasos

6. **Confirmar pedido** (botón verde):
   - El backend ejecuta el **flujo de consistencia Redis → MongoDB**:
     1. Lee el carrito con `HGETALL carrito:{uid}` desde Redis.
     2. Valida stock de cada producto en MongoDB.
     3. Inserta el documento de pedido en MongoDB con `idempotency_key` único (previene duplicados ante reintentos).
     4. Escribe `SET pedido_estado:{pedido_id} "registrado"` en Redis (TTL 24h).
     5. Elimina `carrito:{uid}` de Redis con `DEL`.

7. Volver a **Redis claves activas** → verificar:
   - La clave `carrito:{uid}` desapareció.
   - Apareció `pedido_estado:{pedido_id}` = `registrado` de tipo `string`.

### 2.4 Estado en tiempo real (RF04)

8. **Detalle del pedido** → en el historial, hacer click en el pedido recién creado:
   - Llama `GET /api/v1/usuarios/{uid}/pedidos/{pedido_id}`
   - La respuesta incluye el campo `estado_redis: "registrado"` — **leído desde Redis**, no consultando el campo `estado` de MongoDB.
   - Esto demuestra RF04: consulta de estado en tiempo real con latencia O(1).

### 2.5 Historial paginado

9. **Historial de pedidos** → sección inferior izquierda:
   - Llama `GET /api/v1/usuarios/{uid}/pedidos?limit=20`
   - Usa el índice compuesto `{usuario_id: 1, fecha_creacion: -1}`.
   - Paginación por cursor ISO 8601 (no por offset) para evitar problemas con inserciones concurrentes.

---

## Bloque 3 — Vista almacén (4–5 min)

> Ir al tab **🏭 Vista Almacén**.

### 3.1 Pedidos pendientes — agregación MongoDB

1. Recargar la sección de pedidos pendientes:
   - Llama `GET /api/v1/almacen/pedidos/pendientes`
   - Pipeline de agregación:
     ```
     $match {estado: {$in: ["registrado", "en_preparacion"]}}
     → $unwind $productos
     → $group por pasillo_id (suma cantidades)
     → $lookup a pasillos (zona, encargado)
     ```
   - Muestra los productos del pedido confirmado en el bloque anterior, agrupados por pasillo.

2. Mostrar la **vista de picking**: para el operario de almacén, cada tarjeta de pasillo muestra qué productos recoger y cuántas unidades — sin necesidad de abrir cada pedido individual.

### 3.2 Actualización de estado — escritura dual MongoDB + Redis

3. **Cambiar estado a `en_preparacion`** (botón "Iniciar preparación"):
   - Llama `PATCH /api/v1/almacen/pedidos/{pedido_id}/estado`
   - El backend actualiza **dos sistemas simultáneamente**:
     - MongoDB: `$set {estado: "en_preparacion"}` (fuente de verdad permanente).
     - Redis: `SET pedido_estado:{id} "en_preparacion"` con TTL 24h (cache de acceso rápido).

4. Ir a **🔬 Infraestructura → Redis claves activas** → la clave `pedido_estado:{id}` ahora muestra `en_preparacion`.

### 3.3 RF04 en tiempo real — cliente ve el cambio

5. Ir al tab **🛒 Vista Cliente** → recargar el detalle del mismo pedido:
   - El campo `estado_redis` ahora muestra `en_preparacion`.
   - El cliente ve el cambio de estado **sin que el almacén haya tocado la vista del cliente** — la comunicación ocurre a través de Redis.

6. **Cambiar a `listo`** en el tab de almacén:
   - El pedido desaparece de la lista de "pedidos pendientes" (ya no cumple el `$match`).
   - La cola de almacén queda limpia.

---

## Bloque 4 — Cierre (1–2 min)

**Resumen del diseño NoSQL:**

| Decisión | Justificación |
|----------|--------------|
| MongoDB para catálogo y pedidos | Esquema flexible, embedding de productos como snapshot, agregaciones para picking |
| Redis para carrito y estado | Latencia O(1), TTL automático, estructura suficiente (hash/string) |
| Replica set MongoDB (AP) | Disponibilidad ante fallos de nodo; lecturas distribuidas entre secundarios |
| Replicación Redis async (AP) | Baja latencia en escrituras de carrito; réplica como respaldo ante falla del master |
| `idempotency_key` | Garantiza que un pedido no se duplique ante reintentos de red |
| Embedding en pedidos | El snapshot preserva el precio y nombre al momento de la compra, independiente de futuros cambios en catálogo |
| Denormalización de nombre en productos | Evita `$lookup` a pasillos en la consulta de picking más frecuente |

**Mensaje de cierre:**
- Redis nunca es la fuente de verdad de un pedido ya confirmado — solo del carrito en curso y del estado en tiempo real.
- MongoDB nunca depende de Redis para garantizar la integridad de un pedido ya creado.
- El `idempotency_key` resuelve la inconsistencia transitoria durante la ventana entre el fallo de MongoDB y el reintento del cliente.

---

## Comandos de referencia rápida

```bash
# Bajar primario MongoDB (demo de elección)
docker stop supermercado-nosql-mongo-primary-1

# Volver a levantar primario
docker start supermercado-nosql-mongo-primary-1

# Escribir en master Redis (demo de replicación)
docker exec supermercado-nosql-redis-master-1 redis-cli SET demo:clave "hola desde master"

# Leer desde réplica Redis
docker exec supermercado-nosql-redis-replica-1 redis-cli GET demo:clave

# Limpiar clave demo
docker exec supermercado-nosql-redis-master-1 redis-cli DEL demo:clave

# Limpiar todos los datos Redis (inicio de demo)
docker exec supermercado-nosql-redis-master-1 redis-cli FLUSHDB

# Ver logs en tiempo real
docker logs -f supermercado-nosql-api-1
docker logs -f supermercado-nosql-mongo-primary-1
```
