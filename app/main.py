from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.db import mongo, redis
from app.routes import almacen, carritos, infra, pedidos, productos


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await mongo.connect()
    await redis.connect()
    yield
    await mongo.disconnect()
    await redis.disconnect()


app = FastAPI(
    title="Supermercado Online API",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(pedidos.router)
app.include_router(almacen.router)
app.include_router(carritos.router)
app.include_router(productos.router)
app.include_router(infra.router)


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}


app.mount("/static", StaticFiles(directory="static"), name="static")
