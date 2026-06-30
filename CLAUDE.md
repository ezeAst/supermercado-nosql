# CLAUDE.md

Proyecto: plataforma de supermercado online usando MongoDB + Redis

## Stack
- Python 3.11, FastAPI
- Motor (cliente async de MongoDB)
- redis-py

## MongoDB
- Corre en replica set: 1 primario + 2 secundarios.
- Siempre usar `readPreference=secondaryPreferred` para lecturas de catálogo e historial.
- Solo escrituras críticas van al primario.
- Base de datos: `supermercado_db`
- Colecciones: `usuarios`, `productos`, `pedidos`, `pasillos`, `departamentos`

## Redis
- Corre en modo maestro-réplica asíncrona.
- Se usa SOLO para carrito (Hash, TTL 24h) y estado de pedido en tiempo real (String).
- Claves:
  - `carrito:{usuario_id}` (Hash)
  - `pedido_estado:{pedido_id}` (String)
  - `sesion:{usuario_id}` (String)

## Patrón de modelado
- `pedidos` embebe `productos` (snapshot).
- `productos` referencia `pasillos`/`departamentos` por ID pero denormaliza su nombre.

## APIs
- Todas las APIs deben seguir OpenAPI/Swagger con descripción, parámetros, ejemplos de request y response, y códigos de error.

## Buenas prácticas
- Usar async/await siempre.
- Manejar errores con `HTTPException`.
- Separar lógica en `services` (no en `routes`).
- Usar variables de entorno para credenciales (nunca hardcodear).
