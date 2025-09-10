"""
Minimal test to debug live streams integration issues.
"""

import pytest
from httpx import AsyncClient
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db import get_session


@pytest.fixture
async def test_db():
    """Create a test database."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=True)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    return engine


@pytest.fixture
async def client(test_db):
    """Create test client."""
    TestSessionLocal = sessionmaker(test_db, class_=AsyncSession, expire_on_commit=False)

    async def get_test_session():
        async with TestSessionLocal() as session:
            yield session

    app.dependency_overrides[get_session] = get_test_session

    try:
        async with AsyncClient(app=app, base_url="http://test") as ac:
            yield ac
    finally:
        app.dependency_overrides.clear()


async def test_health_check(client: AsyncClient):
    """Test health check works."""
    response = await client.get("/healthz")
    assert response.status_code == 200


async def test_simple_ingest(client: AsyncClient, monkeypatch):
    """Test simple ingestion."""
    # Disable rate limiting for this test
    from app.core.config import Settings
    from app.routers.live_streams import get_settings as _orig_get_settings

    def mock_get_settings():
        s = _orig_get_settings()
        return Settings(
            database_url="sqlite+aiosqlite:///:memory:",
            api_cors_origins=s.api_cors_origins,
            max_nonces=s.max_nonces,
            ingest_token=None,
            api_host=s.api_host,
            api_port=s.api_port,
            ingest_rate_limit=1000000,
        )

    monkeypatch.setattr("app.routers.live_streams.get_settings", mock_get_settings)

    # Mock rate limiter dependency to always allow requests
    def mock_rate_limit_dependency():
        async def _rate_limit():
            return None  # No rate limiting

        return _rate_limit

    monkeypatch.setattr(
        "app.routers.live_streams.get_rate_limit_dependency", mock_rate_limit_dependency
    )

    payload = {
        "id": "test_bet",
        "nonce": 1,
        "amount": 10.0,
        "payout": 20.0,
        "difficulty": "easy",
        "roundResult": 2.0,
        "clientSeed": "test_client",
        "serverSeedHashed": "test_hash",
    }

    response = await client.post("/live/ingest", json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")

    if response.status_code == 200:
        data = response.json()
        print(f"Data: {data}")

    assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
