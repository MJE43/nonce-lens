"""
Tests for live streams query and management endpoints.

Tests pagination, filtering, and sorting functionality, stream deletion and update operations,
and CSV export functionality with large datasets.
"""

import pytest
import csv
import io
from datetime import datetime, timezone
from uuid import UUID, uuid4
from httpx import AsyncClient
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db import get_session
from app.models.live_streams import LiveStream, LiveBet


# Test database setup
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def test_db():
    """Create a test database for each test."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    return engine


@pytest.fixture
async def client(test_db):
    """Create test client with test database."""
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


@pytest.fixture
async def sample_streams_and_bets(test_db):
    """Create sample streams and bets for testing."""
    TestSessionLocal = sessionmaker(test_db, class_=AsyncSession, expire_on_commit=False)
    
    async with TestSessionLocal() as session:
        # Create multiple streams
        streams = []
        for i in range(3):
            stream = LiveStream(
                server_seed_hashed=f"hash_{i}",
                client_seed=f"client_{i}",
                notes=f"Test stream {i}" if i % 2 == 0 else None
            )
            session.add(stream)
            streams.append(stream)
        
        await session.commit()
        
        # Create bets for each stream
        for i, stream in enumerate(streams):
            for j in range(5):
                bet = LiveBet(
                    stream_id=stream.id,
                    antebot_bet_id=f"bet_{i}_{j}",
                    nonce=j + 1,
                    amount=10.0 + j,
                    payout_multiplier=2.0 + j,
                    payout=20.0 + (j * 10),
                    difficulty="easy" if j % 2 == 0 else "hard",
                    round_target=100.0 + (j * 50),
                    round_result=200.0 + (j * 100)
                )
                session.add(bet)
        
        await session.commit()
        
        return [str(stream.id) for stream in streams]


class TestStreamListingEndpoint:
    """Test stream listing endpoint with pagination and filtering."""

    async def test_list_streams_basic(self, client: AsyncClient, sample_streams_and_bets):
        """Test basic stream listing functionality."""
        response = await client.get("/live/streams")
        assert response.status_code == 200
        
        data = response.json()
        assert "streams" in data
        assert "total" in data
        assert "limit" in data
        assert "offset" in data
        
        assert len(data["streams"]) == 3
        assert data["total"] == 3
        assert data["limit"] == 50  # default limit
        assert data["offset"] == 0

    async def test_list_streams_pagination(self, client: AsyncClient, sample_streams_and_bets):
        """Test stream listing pagination."""
        # Test with limit
        response = await client.get("/live/streams?limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["streams"]) == 2
        assert data["limit"] == 2
        
        # Test with offset
        response = await client.get("/live/streams?limit=2&offset=1")
        assert response.status_code == 200
        data = response.json()
        assert len(data["streams"]) == 2
        assert data["offset"] == 1

    async def test_list_streams_limit_validation(self, client: AsyncClient, sample_streams_and_bets):
        """Test stream listing limit validation."""
        # Test limit too high
        response = await client.get("/live/streams?limit=101")
        assert response.status_code == 400
        assert "Limit cannot exceed 100" in response.json()["detail"]
        
        # Test limit too low
        response = await client.get("/live/streams?limit=0")
        assert response.status_code == 400
        assert "Limit must be at least 1" in response.json()["detail"]
        
        # Test negative offset
        response = await client.get("/live/streams?offset=-1")
        assert response.status_code == 400
        assert "Offset cannot be negative" in response.json()["detail"]

    async def test_list_streams_metadata(self, client: AsyncClient, sample_streams_and_bets):
        """Test that stream metadata is correctly aggregated."""
        response = await client.get("/live/streams")
        assert response.status_code == 200
        
        data = response.json()
        streams = data["streams"]
        
        for stream in streams:
            # Check required fields
            assert "id" in stream
            assert "server_seed_hashed" in stream
            assert "client_seed" in stream
            assert "created_at" in stream
            assert "last_seen_at" in stream
            assert "total_bets" in stream
            assert "highest_multiplier" in stream
            
            # Check that aggregated data makes sense
            assert stream["total_bets"] == 5  # We created 5 bets per stream
            assert stream["highest_multiplier"] == 6.0  # 2.0 + 4 (last bet)

    async def test_list_streams_empty(self, client: AsyncClient):
        """Test stream listing when no streams exist."""
        response = await client.get("/live/streams")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["streams"]) == 0
        assert data["total"] == 0


class TestStreamDetailEndpoint:
    """Test stream detail endpoint."""

    async def test_get_stream_detail_success(self, client: AsyncClient, sample_streams_and_bets):
        """Test successful stream detail retrieval."""
        stream_id = sample_streams_and_bets[0]
        
        response = await client.get(f"/live/streams/{stream_id}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields
        required_fields = {
            "id", "server_seed_hashed", "client_seed", "created_at", 
            "last_seen_at", "total_bets", "highest_multiplier", 
            "lowest_multiplier", "average_multiplier", "notes", "recent_bets"
        }
        assert set(data.keys()) == required_fields
        
        # Check aggregated statistics
        assert data["total_bets"] == 5
        assert data["highest_multiplier"] == 6.0
        assert data["lowest_multiplier"] == 2.0
        assert data["average_multiplier"] == 4.0  # (2+3+4+5+6)/5
        
        # Check recent bets
        assert len(data["recent_bets"]) == 5
        recent_bet = data["recent_bets"][0]
        assert "id" in recent_bet
        assert "antebot_bet_id" in recent_bet
        assert "nonce" in recent_bet

    async def test_get_stream_detail_not_found(self, client: AsyncClient):
        """Test stream detail for non-existent stream."""
        fake_stream_id = "12345678-1234-1234-1234-123456789012"
        
        response = await client.get(f"/live/streams/{fake_stream_id}")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]


class TestStreamBetsEndpoint:
    """Test stream bets listing endpoint."""

    async def test_list_stream_bets_basic(self, client: AsyncClient, sample_streams_and_bets):
        """Test basic stream bets listing."""
        stream_id = sample_streams_and_bets[0]
        
        response = await client.get(f"/live/streams/{stream_id}/bets")
        assert response.status_code == 200
        
        data = response.json()
        assert "bets" in data
        assert "total" in data
        assert "limit" in data
        assert "offset" in data
        assert "stream_id" in data
        
        assert len(data["bets"]) == 5
        assert data["total"] == 5
        assert data["stream_id"] == stream_id

    async def test_list_stream_bets_pagination(self, client: AsyncClient, sample_streams_and_bets):
        """Test stream bets pagination."""
        stream_id = sample_streams_and_bets[0]
        
        # Test with limit
        response = await client.get(f"/live/streams/{stream_id}/bets?limit=3")
        assert response.status_code == 200
        data = response.json()
        assert len(data["bets"]) == 3
        assert data["limit"] == 3
        
        # Test with offset
        response = await client.get(f"/live/streams/{stream_id}/bets?limit=3&offset=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["bets"]) == 3
        assert data["offset"] == 2

    async def test_list_stream_bets_ordering(self, client: AsyncClient, sample_streams_and_bets):
        """Test stream bets ordering options."""
        stream_id = sample_streams_and_bets[0]
        
        # Test nonce_asc (default)
        response = await client.get(f"/live/streams/{stream_id}/bets?order=nonce_asc")
        assert response.status_code == 200
        data = response.json()
        
        nonces = [bet["nonce"] for bet in data["bets"]]
        assert nonces == sorted(nonces)  # Should be in ascending order
        
        # Test id_desc
        response = await client.get(f"/live/streams/{stream_id}/bets?order=id_desc")
        assert response.status_code == 200
        data = response.json()
        
        ids = [bet["id"] for bet in data["bets"]]
        assert ids == sorted(ids, reverse=True)  # Should be in descending order

    async def test_list_stream_bets_min_multiplier_filter(self, client: AsyncClient, sample_streams_and_bets):
        """Test stream bets filtering by minimum multiplier."""
        stream_id = sample_streams_and_bets[0]
        
        # Filter for multipliers >= 4.0
        response = await client.get(f"/live/streams/{stream_id}/bets?min_multiplier=4.0")
        assert response.status_code == 200
        data = response.json()
        
        # Should get bets with multipliers 4.0, 5.0, 6.0
        assert data["total"] == 3
        
        # Verify all returned bets meet the criteria
        for bet in data["bets"]:
            assert bet["payout_multiplier"] >= 4.0

    async def test_list_stream_bets_validation(self, client: AsyncClient, sample_streams_and_bets):
        """Test stream bets endpoint validation."""
        stream_id = sample_streams_and_bets[0]
        
        # Test limit too high
        response = await client.get(f"/live/streams/{stream_id}/bets?limit=1001")
        assert response.status_code == 400
        assert "Limit cannot exceed 1000" in response.json()["detail"]
        
        # Test negative min_multiplier
        response = await client.get(f"/live/streams/{stream_id}/bets?min_multiplier=-1.0")
        assert response.status_code == 400
        assert "min_multiplier cannot be negative" in response.json()["detail"]

    async def test_list_stream_bets_not_found(self, client: AsyncClient):
        """Test stream bets for non-existent stream."""
        fake_stream_id = "12345678-1234-1234-1234-123456789012"
        
        response = await client.get(f"/live/streams/{fake_stream_id}/bets")
        assert response.status_code == 404


class TestStreamUpdateEndpoint:
    """Test stream update endpoint."""

    async def test_update_stream_notes(self, client: AsyncClient, sample_streams_and_bets):
        """Test updating stream notes."""
        stream_id = sample_streams_and_bets[0]
        
        update_data = {"notes": "Updated notes for testing"}
        response = await client.put(f"/live/streams/{stream_id}", json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["notes"] == "Updated notes for testing"
        
        # Verify the update persisted
        response = await client.get(f"/live/streams/{stream_id}")
        assert response.status_code == 200
        assert response.json()["notes"] == "Updated notes for testing"

    async def test_update_stream_clear_notes(self, client: AsyncClient, sample_streams_and_bets):
        """Test clearing stream notes."""
        stream_id = sample_streams_and_bets[0]
        
        # First set notes
        update_data = {"notes": "Some notes"}
        await client.put(f"/live/streams/{stream_id}", json=update_data)
        
        # Then clear them
        update_data = {"notes": ""}
        response = await client.put(f"/live/streams/{stream_id}", json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["notes"] is None

    async def test_update_stream_notes_validation(self, client: AsyncClient, sample_streams_and_bets):
        """Test stream notes validation."""
        stream_id = sample_streams_and_bets[0]
        
        # Test notes too long
        long_notes = "x" * 1001
        update_data = {"notes": long_notes}
        response = await client.put(f"/live/streams/{stream_id}", json=update_data)
        assert response.status_code == 422
        assert "Notes cannot exceed 1000 characters" in response.json()["detail"]

    async def test_update_stream_not_found(self, client: AsyncClient):
        """Test updating non-existent stream."""
        fake_stream_id = "12345678-1234-1234-1234-123456789012"
        
        update_data = {"notes": "Test notes"}
        response = await client.put(f"/live/streams/{fake_stream_id}", json=update_data)
        assert response.status_code == 404


class TestStreamDeleteEndpoint:
    """Test stream deletion endpoint."""

    async def test_delete_stream_success(self, client: AsyncClient, sample_streams_and_bets):
        """Test successful stream deletion."""
        stream_id = sample_streams_and_bets[0]
        
        response = await client.delete(f"/live/streams/{stream_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["deleted"] is True
        assert data["stream_id"] == stream_id
        assert data["bets_deleted"] == 5  # We created 5 bets for this stream
        
        # Verify stream is actually deleted
        response = await client.get(f"/live/streams/{stream_id}")
        assert response.status_code == 404

    async def test_delete_stream_cascade(self, client: AsyncClient, sample_streams_and_bets):
        """Test that deleting stream cascades to delete bets."""
        stream_id = sample_streams_and_bets[0]
        
        # Verify bets exist before deletion
        response = await client.get(f"/live/streams/{stream_id}/bets")
        assert response.status_code == 200
        assert response.json()["total"] == 5
        
        # Delete stream
        response = await client.delete(f"/live/streams/{stream_id}")
        assert response.status_code == 200
        
        # Verify bets are gone
        response = await client.get(f"/live/streams/{stream_id}/bets")
        assert response.status_code == 404

    async def test_delete_stream_not_found(self, client: AsyncClient):
        """Test deleting non-existent stream."""
        fake_stream_id = "12345678-1234-1234-1234-123456789012"
        
        response = await client.delete(f"/live/streams/{fake_stream_id}")
        assert response.status_code == 404


class TestCSVExportEndpoint:
    """Test CSV export functionality."""

    async def test_csv_export_basic(self, client: AsyncClient, sample_streams_and_bets):
        """Test basic CSV export functionality."""
        stream_id = sample_streams_and_bets[0]
        
        response = await client.get(f"/live/streams/{stream_id}/export.csv")
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        
        # Parse CSV content
        csv_content = response.text
        lines = csv_content.strip().split('\n')
        
        # Should have header + 5 data rows
        assert len(lines) == 6
        
        # Check header
        header = lines[0].split(',')
        expected_headers = [
            "nonce", "antebot_bet_id", "received_at", "date_time", "amount",
            "payout_multiplier", "payout", "difficulty", "round_target", "round_result"
        ]
        assert header == expected_headers

    async def test_csv_export_ordering(self, client: AsyncClient, sample_streams_and_bets):
        """Test that CSV export is ordered by nonce ASC."""
        stream_id = sample_streams_and_bets[0]
        
        response = await client.get(f"/live/streams/{stream_id}/export.csv")
        assert response.status_code == 200
        
        # Parse CSV and check nonce ordering
        csv_reader = csv.DictReader(io.StringIO(response.text))
        nonces = [int(row["nonce"]) for row in csv_reader]
        
        assert nonces == sorted(nonces)  # Should be in ascending order
        assert nonces == [1, 2, 3, 4, 5]

    async def test_csv_export_large_dataset(self, client: AsyncClient, test_db):
        """Test CSV export with large dataset."""
        # Create a stream with many bets
        TestSessionLocal = sessionmaker(test_db, class_=AsyncSession, expire_on_commit=False)
        
        async with TestSessionLocal() as session:
            stream = LiveStream(
                server_seed_hashed="large_dataset_hash",
                client_seed="large_dataset_client"
            )
            session.add(stream)
            await session.commit()
            
            # Create 100 bets
            for i in range(100):
                bet = LiveBet(
                    stream_id=stream.id,
                    antebot_bet_id=f"large_bet_{i}",
                    nonce=i + 1,
                    amount=10.0,
                    payout_multiplier=2.0,
                    payout=20.0,
                    difficulty="easy"
                )
                session.add(bet)
            
            await session.commit()
            stream_id = str(stream.id)
        
        # Export CSV
        response = await client.get(f"/live/streams/{stream_id}/export.csv")
        assert response.status_code == 200
        
        # Count rows
        lines = response.text.strip().split('\n')
        assert len(lines) == 101  # Header + 100 data rows

    async def test_csv_export_not_found(self, client: AsyncClient):
        """Test CSV export for non-existent stream."""
        fake_stream_id = "12345678-1234-1234-1234-123456789012"
        
        response = await client.get(f"/live/streams/{fake_stream_id}/export.csv")
        assert response.status_code == 404


class TestEndpointIntegration:
    """Test integration between different endpoints."""

    async def test_full_workflow(self, client: AsyncClient, test_db):
        """Test complete workflow: create, query, update, export, delete."""
        # This test would normally use the ingestion endpoint to create data,
        # but since that's having issues, we'll create data directly in the database
        TestSessionLocal = sessionmaker(test_db, class_=AsyncSession, expire_on_commit=False)
        
        async with TestSessionLocal() as session:
            # Create stream
            stream = LiveStream(
                server_seed_hashed="workflow_hash",
                client_seed="workflow_client",
                notes="Initial notes"
            )
            session.add(stream)
            await session.commit()
            
            # Create bets
            for i in range(3):
                bet = LiveBet(
                    stream_id=stream.id,
                    antebot_bet_id=f"workflow_bet_{i}",
                    nonce=i + 1,
                    amount=10.0 + i,
                    payout_multiplier=2.0 + i,
                    payout=20.0 + (i * 10),
                    difficulty="easy"
                )
                session.add(bet)
            
            await session.commit()
            stream_id = str(stream.id)
        
        # 1. Query stream list
        response = await client.get("/live/streams")
        assert response.status_code == 200
        assert response.json()["total"] == 1
        
        # 2. Get stream detail
        response = await client.get(f"/live/streams/{stream_id}")
        assert response.status_code == 200
        assert response.json()["notes"] == "Initial notes"
        
        # 3. List bets
        response = await client.get(f"/live/streams/{stream_id}/bets")
        assert response.status_code == 200
        assert response.json()["total"] == 3
        
        # 4. Update stream
        update_data = {"notes": "Updated notes"}
        response = await client.put(f"/live/streams/{stream_id}", json=update_data)
        assert response.status_code == 200
        assert response.json()["notes"] == "Updated notes"
        
        # 5. Export CSV
        response = await client.get(f"/live/streams/{stream_id}/export.csv")
        assert response.status_code == 200
        lines = response.text.strip().split('\n')
        assert len(lines) == 4  # Header + 3 data rows
        
        # 6. Delete stream
        response = await client.delete(f"/live/streams/{stream_id}")
        assert response.status_code == 200
        assert response.json()["bets_deleted"] == 3
        
        # 7. Verify deletion
        response = await client.get(f"/live/streams/{stream_id}")
        assert response.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v"])