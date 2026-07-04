# Supermercado NoSQL

Plataforma de supermercado online con FastAPI, MongoDB (replica set) y Redis (maestro-réplica).

## Stack

- **API**: Python 3.11 + FastAPI + Uvicorn
- **Base de datos**: MongoDB 6.0 (replica set: 1 primario + 2 secundarios)
- **Caché / Carrito**: Redis 7 (maestro + réplica)
- **Infraestructura**: Docker + Docker Compose

## Requisitos previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo
- Git

## Levantar el proyecto

### 1. Clonar el repositorio

```bash
git clone https://github.com/a20213298/supermercado-nosql.git
cd supermercado-nosql
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

> El `.env` por defecto ya apunta a los servicios de Docker, no hace falta cambiarlo.

### 3. Subir los datos de Instacart (solo la primera vez)

Los archivos CSV grandes (`orders.csv`, `order_products__prior.csv`) **no están en el repo** por su tamaño (>100 MB). Descárgalos desde [Kaggle - Instacart Market Basket Analysis](https://www.kaggle.com/competitions/instacart-market-basket-analysis/data) y colócalos en la carpeta `data/`:

```
data/
├── aisles.csv                  ✅ incluido
├── departments.csv             ✅ incluido
├── products.csv                ✅ incluido
├── order_products__train.csv   ✅ incluido
├── orders.csv                  ⬇️ descargar de Kaggle
└── order_products__prior.csv   ⬇️ descargar de Kaggle
```

### 4. Iniciar los contenedores

```bash
docker compose up -d
```

Espera ~15 segundos para que MongoDB inicialice el replica set.

### 5. Poblar la base de datos (seed)

```bash
docker compose exec api python scripts/seed.py
```

### 6. Crear índices

```bash
docker compose exec api python scripts/create_indexes.py
```

### 7. Acceder a la aplicación

| Recurso | URL |
|---------|-----|
| Frontend demo | http://localhost:5173 |
| API docs (Swagger) | http://localhost:8000/docs |
| API docs (Redoc) | http://localhost:8000/redoc |

## Estructura del proyecto

```
supermercado-nosql/
├── app/
│   ├── db/          # Conexiones MongoDB y Redis
│   ├── models/      # Esquemas Pydantic
│   ├── routes/      # Endpoints FastAPI
│   └── services/    # Lógica de negocio
├── data/            # Archivos CSV de Instacart
├── doc/             # Documentación del proyecto
├── frontend/        # Frontend en react
├── scripts/         # seed.py y create_indexes.py
├── static/          # Frontend HTML
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

## Colecciones MongoDB (`supermercado_db`)

| Colección | Descripción |
|-----------|-------------|
| `usuarios` | Clientes registrados |
| `productos` | Catálogo con nombre de pasillo/departamento denormalizado |
| `pedidos` | Historial con snapshot de productos |
| `pasillos` | Referencia de pasillos |
| `departamentos` | Referencia de departamentos |

## Claves Redis

| Clave | Tipo | TTL |
|-------|------|-----|
| `carrito:{usuario_id}` | Hash | 24 h |
| `pedido_estado:{pedido_id}` | String | — |
| `sesion:{usuario_id}` | String | — |

## Detener el proyecto

```bash
docker compose down
```

Para eliminar también los volúmenes (borra los datos):

```bash
docker compose down -v
```
