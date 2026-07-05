#!/usr/bin/env python3
"""
Seed script reducido para demo en vivo.

Carga: 134 pasillos, 21 departamentos, 250 productos (1 por pasillo + relleno),
15 usuarios mock. La colección pedidos queda vacía para demostrar el flujo completo.

Archivos requeridos en data/:
    aisles.csv, departments.csv, products.csv

Uso:
    python scripts/seed.py
"""

import asyncio
import csv
import json
import os
import random
import time
import unicodedata
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGO_URI = os.getenv("MONGO_SHARD0_URI", "mongodb://shard0-primary:27017/?replicaSet=rs0")
DB_NAME = "supermercado_db"
DATA_DIR = Path("data")
STATIC_DIR = Path("static")
BATCH_SIZE = 1000
MAX_PRODUCTOS = 250

random.seed(42)

ZONAS = ["Zona A", "Zona B", "Zona C", "Zona D"]
ENCARGADOS = [
    "Carlos Reyes", "Ana López", "Pedro García", "María Soto", "Jorge Díaz"
]
DIRECCIONES = [
    "Av. Javier Prado 1234, San Isidro",
    "Jr. Carabaya 456, Cercado de Lima",
    "Av. La Marina 789, San Miguel",
    "Calle Los Álamos 321, Miraflores",
    "Av. Arequipa 654, Lince",
    "Jr. de la Unión 890, Cercado de Lima",
    "Av. Brasil 345, Jesús María",
    "Av. Universitaria 1801, Los Olivos",
    "Calle Monte Rosa 180, Surco",
    "Av. Benavides 5211, Miraflores",
]

USUARIOS_MOCK = [
    ("Ana Torres", "ana.torres", "cliente"),
    ("Carlos Mendoza", "carlos.mendoza", "cliente"),
    ("María García", "maria.garcia", "cliente"),
    ("Luis Quispe", "luis.quispe", "cliente"),
    ("Rosa Flores", "rosa.flores", "cliente"),
    ("Jorge Díaz", "jorge.diaz", "cliente"),
    ("Patricia Vega", "patricia.vega", "cliente"),
    ("Roberto Sánchez", "roberto.sanchez", "cliente"),
    ("Carmen López", "carmen.lopez", "cliente"),
    ("Miguel Ríos", "miguel.rios", "cliente"),
    ("Lucía Ramírez", "lucia.ramirez", "cliente"),
    ("Eduardo Castro", "eduardo.castro", "cliente"),
    ("Sofía Morales", "sofia.morales", "cliente"),
    ("Andrés Herrera", "andres.herrera", "cliente"),
    ("Valeria Núñez", "valeria.nunez", "cliente"),
    # Trabajadores de almacén
    ("Juan Pérez", "juan.perez", "trabajador"),
    ("María Gómez", "maria.gomez", "trabajador"),
]

TRABAJADORES_MOCK = [
    ("Juan Pérez", "juan.perez", "trabajador"),
    ("María Gómez", "maria.gomez", "trabajador"),
]


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def leer_csv(filename: str) -> list[dict]:
    path = DATA_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Archivo no encontrado: {path}")
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


async def insertar_lotes(collection, docs: list, label: str) -> list:
    """Inserta docs en lotes de BATCH_SIZE. Retorna inserted_ids en el mismo orden."""
    inserted_ids = []
    total = len(docs)
    for i in range(0, total, BATCH_SIZE):
        lote = docs[i : i + BATCH_SIZE]
        result = await collection.insert_many(lote, ordered=False)
        inserted_ids.extend(result.inserted_ids)
        print(f"    [{label}] {min(i + BATCH_SIZE, total):>8,} / {total:,}")
    return inserted_ids


# ---------------------------------------------------------------------------
# Funciones de seed por colección
# ---------------------------------------------------------------------------

async def seed_pasillos(db, aisles: list[dict]) -> dict[int, object]:
    """Retorna {aisle_id_csv: ObjectId_mongo}."""
    t0 = time.time()
    docs = [
        {
            "nombre": row["aisle"],
            "zona_almacen": random.choice(ZONAS),
            "encargado_area": random.choice(ENCARGADOS),
        }
        for row in aisles
    ]
    ids = await insertar_lotes(db.pasillos, docs, "pasillos")
    mapping = {int(aisles[i]["aisle_id"]): ids[i] for i in range(len(aisles))}
    print(f"  OK {len(docs):,} pasillos  ({time.time()-t0:.1f}s)")
    return mapping


async def seed_departamentos(
    db,
    departments: list[dict],
    aisle_dept: dict[int, int],
) -> dict[int, object]:
    """Retorna {dept_id_csv: ObjectId_mongo}."""
    t0 = time.time()

    dept_aisle_count: dict[int, set] = defaultdict(set)
    for aisle_id, dept_id in aisle_dept.items():
        dept_aisle_count[dept_id].add(aisle_id)

    docs = [
        {
            "nombre": row["department"],
            "zona_almacen": random.choice(ZONAS),
            "encargado_area": random.choice(ENCARGADOS),
            "cantidad_pasillos": len(dept_aisle_count.get(int(row["department_id"]), set())),
        }
        for row in departments
    ]
    ids = await insertar_lotes(db.departamentos, docs, "departamentos")
    mapping = {int(departments[i]["department_id"]): ids[i] for i in range(len(departments))}
    print(f"  OK {len(docs):,} departamentos  ({time.time()-t0:.1f}s)")
    return mapping


async def seed_productos(
    db,
    products: list[dict],
    aisles: list[dict],
    departments: list[dict],
    pasillo_map: dict[int, object],
    dept_map: dict[int, object],
) -> None:
    """Selecciona MAX_PRODUCTOS con al menos 1 por pasillo para variedad visual."""
    t0 = time.time()
    aisle_nombre = {int(r["aisle_id"]): r["aisle"] for r in aisles}
    dept_nombre = {int(r["department_id"]): r["department"] for r in departments}

    # 1 producto aleatorio por pasillo (cubre todos los 134 pasillos)
    by_aisle: dict[int, list[dict]] = defaultdict(list)
    for row in products:
        by_aisle[int(row["aisle_id"])].append(row)

    selected: list[dict] = [random.choice(rows) for rows in by_aisle.values()]

    # Completar hasta MAX_PRODUCTOS con productos adicionales aleatorios
    selected_ids = {r["product_id"] for r in selected}
    remaining = [r for r in products if r["product_id"] not in selected_ids]
    random.shuffle(remaining)
    needed = MAX_PRODUCTOS - len(selected)
    if needed > 0:
        selected.extend(remaining[:needed])

    docs = []
    for row in selected:
        aid = int(row["aisle_id"])
        did = int(row["department_id"])
        docs.append(
            {
                "nombre": row["product_name"],
                "precio": round(random.uniform(1.5, 50.0), 2),
                "stock": random.randint(10, 500),  # stock mínimo 10 para evitar fallos en demo
                "pasillo_id": str(pasillo_map[aid]),
                "pasillo_nombre": aisle_nombre[aid],
                "departamento_id": str(dept_map[did]),
                "departamento_nombre": dept_nombre[did],
            }
        )

    await insertar_lotes(db.productos, docs, "productos")
    print(f"  OK {len(docs):,} productos  ({time.time()-t0:.1f}s)")


async def seed_usuarios(db) -> list[dict]:
    """Crea 15 usuarios mock hardcodeados. Retorna lista serializable para el frontend."""
    t0 = time.time()
    docs = [
        {
            "nombre": nombre,
            "email": f"{alias}@demo.supermercado.pe",
            "telefono": None,
            "direccion": random.choice(DIRECCIONES),
            "password": unicodedata.normalize("NFKD", nombre).encode("ascii", "ignore").decode().lower().replace(" ", ""),
            "rol": rol,
        }
        for nombre, alias, rol in USUARIOS_MOCK
    ]
    ids = await insertar_lotes(db.usuarios, docs, "usuarios")
    result = [
        {
            "_id": str(ids[i]),
            "nombre": docs[i]["nombre"],
            "email": docs[i]["email"],
            "direccion": docs[i]["direccion"],
            "rol": docs[i]["rol"],
        }
        for i in range(len(docs))
    ]
    print(f"  OK {len(docs):,} usuarios  ({time.time()-t0:.1f}s)")
    return result


async def crear_indices(db) -> None:
    t0 = time.time()

    await db.usuarios.create_index("email", unique=True)
    await db.pasillos.create_index("nombre")
    await db.departamentos.create_index("nombre")
    await db.productos.create_index("pasillo_id")
    await db.productos.create_index("departamento_id")
    await db.productos.create_index([("nombre", "text")], name="productos_nombre_text")
    await db.pedidos.create_index(
        [("usuario_id", 1), ("fecha_creacion", -1)],
        name="pedidos_usuario_fecha",
    )
    await db.pedidos.create_index("estado", name="pedidos_estado")
    await db.pedidos.create_index(
        "idempotency_key",
        sparse=True,
        unique=True,
        name="pedidos_idempotency",
    )

    print(f"  OK Indices creados  ({time.time()-t0:.1f}s)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main() -> None:
    t_total = time.time()
    print("=" * 54)
    print("  Supermercado NoSQL - Seed Script (demo)")
    print(f"  URI : {MONGO_URI}")
    print(f"  DB  : {DB_NAME}")
    print("=" * 54)

    required = ["aisles.csv", "departments.csv", "products.csv"]
    for f in required:
        if not (DATA_DIR / f).exists():
            raise SystemExit(f"ERROR: Archivo no encontrado: {DATA_DIR / f}")

    STATIC_DIR.mkdir(exist_ok=True)

    client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]

    print("\nLimpiando colecciones existentes...")
    for col in ["pasillos", "departamentos", "productos", "pedidos", "usuarios"]:
        await db[col].drop()

    print("\nLeyendo CSVs...")
    aisles = leer_csv("aisles.csv")
    departments = leer_csv("departments.csv")
    products = leer_csv("products.csv")
    aisle_dept: dict[int, int] = {
        int(r["aisle_id"]): int(r["department_id"]) for r in products
    }
    print(f"  {len(aisles)} pasillos, {len(departments)} departamentos, {len(products):,} productos en CSV")

    print("\n--- Insertando colecciones ---")
    pasillo_map = await seed_pasillos(db, aisles)
    dept_map = await seed_departamentos(db, departments, aisle_dept)
    await seed_productos(db, products, aisles, departments, pasillo_map, dept_map)
    usuarios = await seed_usuarios(db)
    # pedidos: la colección queda vacía (solo se hizo drop arriba)

    print("\n--- Creando índices ---")
    await crear_indices(db)

    # Crear índices de pedidos también en Shard 1
    print("\n--- Creando índices en Shard 1 ---")
    MONGO_SHARD1_URI = os.getenv("MONGO_SHARD1_URI", "mongodb://shard1-primary:27019/?replicaSet=rs1")
    client_shard1 = AsyncIOMotorClient(MONGO_SHARD1_URI, serverSelectionTimeoutMS=5000)
    db_shard1 = client_shard1[DB_NAME]
    await db_shard1.pedidos.create_index(
        [("usuario_id", 1), ("fecha_creacion", -1)],
        name="pedidos_usuario_fecha",
    )
    await db_shard1.pedidos.create_index("estado", name="pedidos_estado")
    await db_shard1.pedidos.create_index("idempotency_key", sparse=True, unique=True, name="pedidos_idempotency")
    print("  OK índices Shard 1")
    client_shard1.close()

    # Guardar usuarios.json para el selector del frontend
    usuarios_path = STATIC_DIR / "usuarios.json"
    with open(usuarios_path, "w", encoding="utf-8") as f:
        json.dump(usuarios, f, ensure_ascii=False, indent=2)
    print(f"\nGuardado: {usuarios_path}")

    # Resumen final
    print("\n=== Resumen final ===")
    for col in ["usuarios", "productos", "pedidos", "pasillos", "departamentos"]:
        count = await db[col].count_documents({})
        print(f"  {col:<14}: {count:>6,}")

    client.close()
    print(f"\nSeed completado en {time.time()-t_total:.1f}s")


if __name__ == "__main__":
    asyncio.run(main())
