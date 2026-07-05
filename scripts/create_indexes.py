#!/usr/bin/env python3
"""
Crea todos los índices de supermercado_db en MongoDB.
Puede ejecutarse varias veces: MongoDB ignora índices que ya existen.

Uso:
    python scripts/create_indexes.py
"""

import asyncio
import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGO_URI = os.getenv("MONGO_SHARD0_URI", "mongodb://shard0-primary:27017/?replicaSet=rs0")
DB_NAME = "supermercado_db"


async def main() -> None:
    print(f"Conectando a {MONGO_URI} ({DB_NAME})...")
    client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]

    # ── usuarios ─────────────────────────────────────────────────────────────
    name = await db.usuarios.create_index("email", unique=True)
    print(f"  [usuarios]      {name}  →  email (unique)")

    # ── productos ─────────────────────────────────────────────────────────────
    name = await db.productos.create_index("pasillo_id")
    print(f"  [productos]     {name}  →  pasillo_id")

    name = await db.productos.create_index("departamento_id")
    print(f"  [productos]     {name}  →  departamento_id")

    name = await db.productos.create_index([("nombre", "text")], name="productos_nombre_text")
    print(f"  [productos]     {name}  →  nombre (text)")

    # ── pedidos ───────────────────────────────────────────────────────────────
    name = await db.pedidos.create_index(
        [("usuario_id", 1), ("fecha_creacion", -1)],
        name="pedidos_usuario_fecha",
    )
    print(f"  [pedidos]       {name}  →  usuario_id ASC, fecha_creacion DESC")

    name = await db.pedidos.create_index("estado", name="pedidos_estado")
    print(f"  [pedidos]       {name}  →  estado")

    # idempotency_key: sparse porque solo los pedidos confirmados lo tienen
    name = await db.pedidos.create_index(
        "idempotency_key",
        unique=True,
        sparse=True,
        name="pedidos_idempotency",
    )
    print(f"  [pedidos]       {name}  →  idempotency_key (unique, sparse)")

    client.close()
    print("\nTodos los índices creados correctamente.")


if __name__ == "__main__":
    asyncio.run(main())
