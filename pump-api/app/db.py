from __future__ import annotations

from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import event

from .core.config import get_settings


settings = get_settings()


engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=False,
    connect_args=(
        {"check_same_thread": False}
        if settings.database_url.startswith("sqlite+")
        else {}
    ),
)

# Enable SQLite foreign key enforcement
if settings.database_url.startswith("sqlite+"):

    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):  # type: ignore[unused-ignore]
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def create_db_and_tables() -> None:
    # Ensure models are imported so SQLModel metadata is populated
    from .models import runs as _models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def get_session():
    async with AsyncSessionLocal() as session:
        yield session
