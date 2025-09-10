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


async def test_simple_ingest(client: AsyncClient):
    """Test simple ingestion."""
    payload = {
        "id": "test_bet",
        "nonce": 1,
        "amount": 10.0,
        "payoutMultiplier": 2.0,
        "payout": 20.0,
        "difficulty": "easy",
        "clientSeed": "test_client",
        "serverSeedHashed": "test_hash"
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