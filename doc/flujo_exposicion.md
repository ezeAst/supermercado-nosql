# Guión de exposición — Plataforma de Supermercado Online NoSQL

**Curso:** Bases de Datos No Estructuradas, Maestría en Informática, PUCP  
**Frontend (React):** `http://localhost:5173`  
**API / Swagger:** `http://localhost:8000/docs`

---

## Bloque 1 — Arquitectura + Demo de resiliencia (6–8 min)

> Desde la pantalla de login, click en **"Ver infraestructura (sin sesión)"** y activar auto-refresh cada 5s.

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

## Bloque 2 — Inicio de sesión (1 min)

> La app ahora requiere autenticación. Desde la pantalla de login, click en **"Cliente demo"** o **"Trabajador demo"**. Credenciales: email = nombre + `@demo.supermercado.pe`, password = nombre en minúsculas sin espacios.

> `POST /api/v1/auth/login` → valida contra MongoDB. Retorna token base64 con `user_id` y `rol`. Sesión en `localStorage`.

---

## Bloque 3 — Vista cliente (5–7 min)

> Ingresar con **Cliente demo**. El sidebar tiene 4 secciones: Productos, Carrito, Historial, Mi Perfil.

### 3.1 Catálogo y búsqueda

1. Ir a **Productos** → el catálogo se carga automáticamente desde `GET /api/v1/productos`.

2. **Buscar por texto**: usar el buscador con "leche":
   - Internamente llama `GET /api/v1/productos?search=leche`
   - Usa el **índice de texto** en `nombre` con ranking por `$meta: textScore`.

### 3.2 Carrito en Redis

3. Ir a **Carrito** o agregar directo desde Productos con el botón "+":
   - Cada click llama `POST /api/v1/carritos/{uid}/productos`
   - Redis ejecuta `HINCRBY carrito:{uid} {producto_id} 1` → hash con TTL de 24h.

4. Ir a **🔬 Infraestructura → Redis claves activas** (desde login, sin cerrar sesión) → mostrar:
   - Clave `carrito:{uid}` de tipo `hash`.
   - Campos: `{producto_id: cantidad}`.
   - TTL ~86400 segundos.

### 3.3 Confirmación del pedido — flujo de 5 pasos

5. Ir a **Carrito**, llenar dirección y método de pago, **Confirmar pedido**:
   - El backend ejecuta el **flujo de consistencia Redis → MongoDB**:
     1. Lee el carrito con `HGETALL carrito:{uid}` desde Redis.
     2. Valida stock de cada producto en MongoDB.
     3. Inserta el documento de pedido en MongoDB con `idempotency_key` único y cada producto con `estado_pasillo: "pendiente"` (previene duplicados ante reintentos).
     4. Escribe `SET pedido_estado:{pedido_id} "registrado"` en Redis (TTL 24h).
     5. Elimina `carrito:{uid}` de Redis con `DEL`.

6. Volver a **Redis claves activas** → verificar:
   - La clave `carrito:{uid}` desapareció.
   - Apareció `pedido_estado:{pedido_id}` = `registrado` de tipo `string`.

### 3.4 Estado en tiempo real (RF04)

7. **Detalle del pedido** → en Historial, click en "Ver" sobre el pedido recién creado:
   - Llama `GET /api/v1/usuarios/{uid}/pedidos/{pedido_id}`
   - La respuesta incluye el campo `estado_redis: "registrado"` — **leído desde Redis**, no consultando el campo `estado` de MongoDB.
   - Esto demuestra RF04: consulta de estado en tiempo real con latencia O(1).

### 3.5 Historial paginado

8. **Historial** → lista los pedidos del usuario:
   - Llama `GET /api/v1/usuarios/{uid}/pedidos?limit=20`
   - Usa el índice compuesto `{usuario_id: 1, fecha_creacion: -1}`.
   - Paginación por cursor ISO 8601.

### 3.6 Mi Perfil

9. Ir a **Mi Perfil** → muestra datos del usuario, email, rol e ID.

---

## Bloque 4 — Vista almacén (5–6 min)

> Volver al login e ingresar con **Trabajador demo**. El sidebar tiene "Cola de Pedidos".

### 4.1 Cola de pedidos con filtros

1. La cola lista pedidos con botones de filtro por estado (Todos / registrado / en_preparacion / listo_para_despacho / despachado):
   - Llama `GET /api/v1/almacen/pedidos?estado=X`

### 4.2 Detalle de pedido — estado por producto

2. Click en **"Detalle"** sobre un pedido:
   - Muestra Total, Estado del pedido y Cant. de productos.
   - Sección **"Cambiar estado del pedido"** con botones para avanzar 1 paso o retroceder (confirmación al despachar).
   - **Productos**: tabla con cada producto, pasillo y chip de estado clickeable para alternar `en_pasillo` ↔ `listo`.
   - `PATCH /api/v1/almacen/pedidos/{id}/productos/{pid}/estado`
   - Si todos los productos quedan en `listo`, el pedido se promueve automáticamente a `listo_para_despacho`.

### 4.3 Pedidos pendientes — agregación MongoDB

3. `GET /api/v1/almacen/pedidos/pendientes`
   - Pipeline: `$match {estado: registrado|en_preparacion} → $unwind → $group por pasillo → $lookup a pasillos`
   - Muestra productos agrupados por pasillo para picking.

### 4.4 Escritura dual MongoDB + Redis

4. Al cambiar estado: MongoDB `$set` + Redis `SET pedido_estado:{id}`. El cliente ve el cambio en tiempo real (RF04).

---

## Bloque 4 — Cierre (1–2 min)

**Resumen del diseño NoSQL:**

| Decisión | Justificación |
|----------|--------------|
| MongoDB para catálogo y pedidos | Esquema flexible, embedding de productos como snapshot, agregaciones para picking |
| Redis para carrito y estado | Latencia O(1), TTL automático, estructura suficiente (hash/string) |
| Replica set MongoDB (AP) | Disponibilidad ante fallos de nodo; lecturas distribuidas entre secundarios |
| Replicación Redis async (AP) | Baja latencia en escrituras de carrito; réplica como respaldo ante falla del master |
| `estado_pasillo` por producto | Permite picking granular sin modificar el modelo de datos |
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
