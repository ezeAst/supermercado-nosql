import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from dotenv import load_dotenv

load_dotenv()

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    if _client is None:
        raise RuntimeError("MongoDB client not initialized")
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()["supermercado_db"]


async def connect() -> None:
    global _client
    uri = os.getenv("MONGO_URI")
    if not uri:
        raise ValueError("MONGO_URI env var is not set")
    _client = AsyncIOMotorClient(
        uri,
        readPreference="secondaryPreferred",
    )
    await _client.admin.command("ping")


async def disconnect() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
