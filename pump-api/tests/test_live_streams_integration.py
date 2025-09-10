"""
Integration tests for live streams API endpoints.

Tests complete ingestion workflow with various payloads, concurrent request handling,
tail endpoint semantics with since_id ordering, and null date_time and duplicate handling.
"""

import asyncio
import json
import pytest
from datetime import datetime, timezone
from uuid import UUID
from httpx import AsyncClient
from sqlmodel import SQLModel, select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db import get_session
from app.core.config import get_settings
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
async def client(test_db, monkeypatch):
    """Create test client with test database."""
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.ext.asyncio import AsyncSession

    TestSessionLocal = sessionmaker(test_db, class_=AsyncSession, expire_on_commit=False)

    async def get_test_session():
        async with TestSessionLocal() as session:
            yield session

    # Override the dependency
    app.dependency_overrides[get_session] = get_test_session

    # Mock rate limiter dependency to always allow requests
    def mock_rate_limit_dependency():
        async def _rate_limit():
            return None  # No rate limiting

        return _rate_limit

    monkeypatch.setattr(
        "app.routers.live_streams.get_rate_limit_dependency", mock_rate_limit_dependency
    )

    try:
        async with AsyncClient(app=app, base_url="http://test") as ac:
            yield ac
    finally:
        # Clean up
        app.dependency_overrides.clear()


@pytest.fixture
def sample_bet_payload():
    """Sample bet payload for testing."""
    return {
        "id": "bet_123456",
        "dateTime": "2025-09-08T20:31:11.123Z",
        "nonce": 12345,
        "amount": 0.2,
        "payout": 2240.13,
        "difficulty": "expert",
        "roundTarget": 400.02,
        "roundResult": 11200.65,
        "clientSeed": "abcd-123",
        "serverSeedHashed": "1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890",
    }


class TestIngestionEndpoint:
    """Test the ingestion endpoint with various scenarios."""

    async def test_ingest_bet_success_new_stream(self, client: AsyncClient, sample_bet_payload):
        """Test successful bet ingestion that creates a new stream."""
        response = await client.post("/live/ingest", json=sample_bet_payload)

        if response.status_code != 200:
            print(f"Response status: {response.status_code}")
            print(f"Response body: {response.text}")

        assert response.status_code == 200
        data = response.json()

        # Check response structure
        assert "streamId" in data
        assert "accepted" in data
        assert data["accepted"] is True
        assert isinstance(UUID(data["streamId"]), UUID)

    async def test_ingest_bet_success_existing_stream(self, client: AsyncClient, sample_bet_payload):
        """Test successful bet ingestion to existing stream."""
        # First ingestion creates stream
        response1 = await client.post("/live/ingest", json=sample_bet_payload)
        assert response1.status_code == 200
        stream_id_1 = response1.json()["streamId"]

        # Second ingestion with different bet ID but same seed pair
        payload2 = sample_bet_payload.copy()
        payload2["id"] = "bet_789012"
        payload2["nonce"] = 12346

        response2 = await client.post("/live/ingest", json=payload2)
        assert response2.status_code == 200
        data2 = response2.json()

        # Should use same stream
        assert data2["streamId"] == stream_id_1
        assert data2["accepted"] is True

    async def test_ingest_bet_duplicate_handling(self, client: AsyncClient, sample_bet_payload):
        """Test idempotent handling of duplicate bets."""
        # First ingestion
        response1 = await client.post("/live/ingest", json=sample_bet_payload)
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["accepted"] is True

        # Duplicate ingestion (same bet ID and stream)
        response2 = await client.post("/live/ingest", json=sample_bet_payload)
        assert response2.status_code == 200
        data2 = response2.json()

        # Should return same stream ID but accepted=false
        assert data2["streamId"] == data1["streamId"]
        assert data2["accepted"] is False

    async def test_ingest_bet_null_datetime_handling(self, client: AsyncClient, sample_bet_payload):
        """Test handling of null or invalid dateTime values."""
        # Test with null dateTime
        payload_null = sample_bet_payload.copy()
        payload_null["dateTime"] = None
        payload_null["id"] = "bet_null_datetime"

        response = await client.post("/live/ingest", json=payload_null)
        assert response.status_code == 200
        assert response.json()["accepted"] is True

        # Test with invalid dateTime format
        payload_invalid = sample_bet_payload.copy()
        payload_invalid["dateTime"] = "invalid-date-format"
        payload_invalid["id"] = "bet_invalid_datetime"

        response = await client.post("/live/ingest", json=payload_invalid)
        assert response.status_code == 200
        assert response.json()["accepted"] is True

    async def test_ingest_bet_validation_errors(self, client: AsyncClient, sample_bet_payload):
        """Test validation errors in bet ingestion."""
        # Missing required field
        payload_missing = sample_bet_payload.copy()
        del payload_missing["nonce"]

        response = await client.post("/live/ingest", json=payload_missing)
        assert response.status_code == 422

        # Invalid nonce (< 1)
        payload_invalid_nonce = sample_bet_payload.copy()
        payload_invalid_nonce["nonce"] = 0
        payload_invalid_nonce["id"] = "bet_invalid_nonce"

        response = await client.post("/live/ingest", json=payload_invalid_nonce)
        assert response.status_code == 422

        # Invalid difficulty
        payload_invalid_difficulty = sample_bet_payload.copy()
        payload_invalid_difficulty["difficulty"] = "invalid"
        payload_invalid_difficulty["id"] = "bet_invalid_difficulty"

        response = await client.post("/live/ingest", json=payload_invalid_difficulty)
        assert response.status_code == 422

    async def test_ingest_bet_constraint_violations(self, client: AsyncClient, sample_bet_payload):
        """Test database constraint violation handling."""
        # Negative amount
        payload_negative_amount = sample_bet_payload.copy()
        payload_negative_amount["amount"] = -10.0
        payload_negative_amount["id"] = "bet_negative_amount"

        response = await client.post("/live/ingest", json=payload_negative_amount)
        assert response.status_code == 422
        assert "Amount must be greater than or equal to 0" in response.json()["detail"]

        # Negative payout
        payload_negative_payout = sample_bet_payload.copy()
        payload_negative_payout["payout"] = -5.0
        payload_negative_payout["id"] = "bet_negative_payout"

        response = await client.post("/live/ingest", json=payload_negative_payout)
        assert response.status_code == 422
        assert "Payout must be greater than or equal to 0" in response.json()["detail"]

    async def test_ingest_bet_without_token(self, client: AsyncClient, sample_bet_payload):
        """Test ingestion without token when none is configured."""
        # Should succeed when no token is configured
        response = await client.post("/live/ingest", json=sample_bet_payload)
        assert response.status_code == 200

    async def test_ingest_bet_with_token_authentication(self, client: AsyncClient, sample_bet_payload, monkeypatch):
        """Test token authentication for ingestion."""
        # Mock settings to require token
        from app.core.config import Settings

        def mock_get_settings():
            return Settings(
                database_url="sqlite+aiosqlite:///:memory:",
                api_cors_origins=["http://localhost:5173"],
                max_nonces=500000,
                ingest_token="test-secret-token",
                api_host="127.0.0.1",
                api_port=8000,
                ingest_rate_limit=1000000,
            )

        monkeypatch.setattr("app.routers.live_streams.get_settings", mock_get_settings)

        # Request without token should fail
        response = await client.post("/live/ingest", json=sample_bet_payload)
        assert response.status_code == 401
        assert "X-Ingest-Token header is required" in response.json()["detail"]

        # Request with wrong token should fail
        headers = {"X-Ingest-Token": "wrong-token"}
        response = await client.post("/live/ingest", json=sample_bet_payload, headers=headers)
        assert response.status_code == 401
        assert "Invalid ingest token" in response.json()["detail"]

        # Request with correct token should succeed
        headers = {"X-Ingest-Token": "test-secret-token"}
        response = await client.post("/live/ingest", json=sample_bet_payload, headers=headers)
        assert response.status_code == 200

    async def test_concurrent_ingestion_requests(self, client: AsyncClient, sample_bet_payload):
        """Test concurrent ingestion requests for race conditions."""
        # Create multiple payloads with same stream but different bet IDs
        payloads = []
        for i in range(5):
            payload = sample_bet_payload.copy()
            payload["id"] = f"concurrent_bet_{i}"
            payload["nonce"] = 12345 + i
            payloads.append(payload)

        # Send all requests concurrently
        tasks = [client.post("/live/ingest", json=payload) for payload in payloads]
        responses = await asyncio.gather(*tasks)

        # All should succeed
        for i, response in enumerate(responses):
            if response.status_code != 200:
                print(
                    f"Response {i} failed with {response.status_code}: {response.text}"
                )
            assert response.status_code == 200
            assert response.json()["accepted"] is True

        # All should have same stream ID
        stream_ids = [response.json()["streamId"] for response in responses]
        assert len(set(stream_ids)) == 1  # All same stream ID

    async def test_concurrent_duplicate_requests(self, client: AsyncClient, sample_bet_payload):
        """Test concurrent duplicate requests for idempotency."""
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

        import app.routers.live_streams as live_mod

        live_mod.get_settings = mock_get_settings
        # Send same payload multiple times concurrently
        tasks = [client.post("/live/ingest", json=sample_bet_payload) for _ in range(3)]
        responses = await asyncio.gather(*tasks)

        # One should be accepted, others should be duplicates
        accepted_count = sum(1 for r in responses if r.json()["accepted"])
        duplicate_count = sum(1 for r in responses if not r.json()["accepted"])

        assert accepted_count == 1
        assert duplicate_count == 2

        # All should have same stream ID
        stream_ids = [response.json()["streamId"] for response in responses]
        assert len(set(stream_ids)) == 1


class TestTailEndpoint:
    """Test tail endpoint semantics with since_id ordering."""

    async def _create_test_stream_with_bets(self, client: AsyncClient, bet_count: int = 5):
        """Helper to create a stream with multiple bets."""
        stream_id = None
        bet_ids = []

        for i in range(bet_count):
            payload = {
                "id": f"tail_bet_{i}",
                "dateTime": "2025-09-08T20:31:11.123Z",
                "nonce": i + 1,
                "amount": 10.0,
                "payout": 20.0 + (i * 10),
                "difficulty": "easy",
                "roundTarget": 100.0,
                "roundResult": 2.0 + i,
                "clientSeed": "tail_client",
                "serverSeedHashed": "tail_hash_123",
            }

            response = await client.post("/live/ingest", json=payload)
            assert response.status_code == 200

            if stream_id is None:
                stream_id = response.json()["streamId"]

            bet_ids.append(f"tail_bet_{i}")

        return stream_id, bet_ids

    async def test_tail_endpoint_basic_functionality(self, client: AsyncClient):
        """Test basic tail endpoint functionality."""
        stream_id, _ = await self._create_test_stream_with_bets(client, 3)

        # Get all bets from beginning
        response = await client.get(f"/live/streams/{stream_id}/tail?since_id=0")
        assert response.status_code == 200

        data = response.json()
        assert "bets" in data
        assert "last_id" in data
        assert "has_more" in data
        assert len(data["bets"]) == 3
        assert data["has_more"] is False
        assert data["last_id"] is not None

    async def test_tail_endpoint_incremental_updates(self, client: AsyncClient):
        """Test incremental updates with since_id parameter."""
        stream_id, _ = await self._create_test_stream_with_bets(client, 3)

        # Get first batch
        response1 = await client.get(f"/live/streams/{stream_id}/tail?since_id=0")
        data1 = response1.json()
        first_last_id = data1["last_id"]

        # Add more bets
        for i in range(3, 6):
            payload = {
                "id": f"tail_bet_{i}",
                "nonce": i + 1,
                "amount": 10.0,
                "payout": 20.0,
                "difficulty": "easy",
                "roundResult": 2.0,
                "clientSeed": "tail_client",
                "serverSeedHashed": "tail_hash_123",
            }
            await client.post("/live/ingest", json=payload)

        # Get incremental update
        response2 = await client.get(f"/live/streams/{stream_id}/tail?since_id={first_last_id}")
        data2 = response2.json()

        # Should only get new bets
        assert len(data2["bets"]) == 3
        assert data2["last_id"] > first_last_id

    async def test_tail_endpoint_ordering(self, client: AsyncClient):
        """Test that tail endpoint returns bets ordered by id ASC."""
        stream_id, _ = await self._create_test_stream_with_bets(client, 5)

        response = await client.get(f"/live/streams/{stream_id}/tail?since_id=0")
        data = response.json()

        # Check that IDs are in ascending order
        bet_ids = [bet["id"] for bet in data["bets"]]
        assert bet_ids == sorted(bet_ids)

    async def test_tail_endpoint_no_new_bets(self, client: AsyncClient):
        """Test tail endpoint when no new bets are available."""
        stream_id, _ = await self._create_test_stream_with_bets(client, 3)

        # Get all bets
        response1 = await client.get(f"/live/streams/{stream_id}/tail?since_id=0")
        last_id = response1.json()["last_id"]

        # Request with current last_id (no new bets)
        response2 = await client.get(f"/live/streams/{stream_id}/tail?since_id={last_id}")
        data2 = response2.json()

        assert len(data2["bets"]) == 0
        assert data2["last_id"] is None
        assert data2["has_more"] is False

    async def test_tail_endpoint_invalid_stream(self, client: AsyncClient):
        """Test tail endpoint with non-existent stream."""
        fake_stream_id = "12345678-1234-1234-1234-123456789012"
        response = await client.get(f"/live/streams/{fake_stream_id}/tail?since_id=0")
        assert response.status_code == 404

    async def test_tail_endpoint_invalid_since_id(self, client: AsyncClient):
        """Test tail endpoint with invalid since_id parameter."""
        stream_id, _ = await self._create_test_stream_with_bets(client, 3)

        # Negative since_id
        response = await client.get(f"/live/streams/{stream_id}/tail?since_id=-1")
        assert response.status_code == 400
        assert "since_id cannot be negative" in response.json()["detail"]


class TestCompleteIngestionWorkflow:
    """Test complete ingestion workflow with various payload scenarios."""

    async def test_workflow_multiple_streams(self, client: AsyncClient):
        """Test workflow creating multiple streams with different seed pairs."""
        # Create bets for different seed pairs
        seed_pairs = [
            ("hash1", "client1"),
            ("hash2", "client2"),
            ("hash1", "client2"),  # Same server, different client
            ("hash2", "client1"),  # Same client, different server
        ]

        stream_ids = []

        for i, (server_hash, client_seed) in enumerate(seed_pairs):
            payload = {
                "id": f"workflow_bet_{i}",
                "nonce": 1,
                "amount": 10.0,
                "payout": 20.0,
                "difficulty": "easy",
                "roundResult": 2.0,
                "clientSeed": client_seed,
                "serverSeedHashed": server_hash,
            }

            response = await client.post("/live/ingest", json=payload)
            assert response.status_code == 200
            stream_ids.append(response.json()["streamId"])

        # Should have 4 different streams
        assert len(set(stream_ids)) == 4

    async def test_workflow_with_all_difficulty_levels(self, client: AsyncClient):
        """Test workflow with all supported difficulty levels."""
        difficulties = ["easy", "medium", "hard", "expert"]

        for i, difficulty in enumerate(difficulties):
            payload = {
                "id": f"difficulty_bet_{i}",
                "nonce": i + 1,
                "amount": 10.0,
                "payout": 20.0,
                "difficulty": difficulty,
                "roundResult": 2.0,
                "clientSeed": "difficulty_client",
                "serverSeedHashed": "difficulty_hash",
            }

            response = await client.post("/live/ingest", json=payload)
            assert response.status_code == 200
            assert response.json()["accepted"] is True

    async def test_workflow_with_optional_fields(self, client: AsyncClient):
        """Test workflow with various combinations of optional fields."""
        test_cases = [
            # All optional fields present
            {
                "id": "optional_1",
                "dateTime": "2025-09-08T20:31:11.123Z",
                "nonce": 1,
                "amount": 10.0,
                "payout": 20.0,
                "difficulty": "easy",
                "roundTarget": 100.0,
                "roundResult": 2.0,
                "clientSeed": "optional_client",
                "serverSeedHashed": "optional_hash",
            },
            # No optional fields
            {
                "id": "optional_2",
                "nonce": 2,
                "amount": 10.0,
                "payout": 20.0,
                "difficulty": "easy",
                "roundResult": 2.0,
                "clientSeed": "optional_client",
                "serverSeedHashed": "optional_hash",
            },
            # Only some optional fields
            {
                "id": "optional_3",
                "dateTime": "2025-09-08T20:31:11.123Z",
                "nonce": 3,
                "amount": 10.0,
                "payout": 20.0,
                "difficulty": "easy",
                "roundTarget": 150.0,
                "roundResult": 2.0,
                "clientSeed": "optional_client",
                "serverSeedHashed": "optional_hash",
            },
        ]

        for payload in test_cases:
            response = await client.post("/live/ingest", json=payload)
            assert response.status_code == 200
            assert response.json()["accepted"] is True

    async def test_workflow_datetime_timezone_handling(self, client: AsyncClient):
        """Test workflow with various datetime formats and timezones."""
        datetime_formats = [
            "2025-09-08T20:31:11.123Z",  # UTC with Z
            "2025-09-08T20:31:11.123+00:00",  # UTC with offset
            "2025-09-08T15:31:11.123-05:00",  # EST timezone
            "2025-09-08T20:31:11",  # No timezone (should assume UTC)
        ]

        for i, datetime_str in enumerate(datetime_formats):
            payload = {
                "id": f"datetime_bet_{i}",
                "dateTime": datetime_str,
                "nonce": i + 1,
                "amount": 10.0,
                "payout": 20.0,
                "difficulty": "easy",
                "roundResult": 2.0,
                "clientSeed": "datetime_client",
                "serverSeedHashed": "datetime_hash",
            }

            response = await client.post("/live/ingest", json=payload)
            assert response.status_code == 200
            assert response.json()["accepted"] is True


class TestMetricsEndpoint:
    """Test the metrics endpoint for pre-aggregated analytics."""

    async def test_metrics_endpoint_empty_stream(self, client: AsyncClient):
        """Test metrics endpoint with a stream that has no bets."""
        # First create a stream by ingesting a bet
        payload = {
            "id": "metrics_test_bet",
            "dateTime": "2025-09-08T20:31:11.123Z",
            "nonce": 1,
            "amount": 10.0,
            "payout": 20.0,
            "difficulty": "easy",
            "roundResult": 2.0,
            "clientSeed": "metrics_client",
            "serverSeedHashed": "metrics_hash",
        }

        ingest_response = await client.post("/live/ingest", json=payload)
        assert ingest_response.status_code == 200
        stream_id = ingest_response.json()["streamId"]

        # Test metrics endpoint
        response = await client.get(f"/live/streams/{stream_id}/metrics")
        assert response.status_code == 200

        data = response.json()
        assert "stream_id" in data
        assert "total_bets" in data
        assert "highest_multiplier" in data
        assert "hit_rate" in data
        assert "multiplier_stats" in data
        assert "density_buckets" in data
        assert "top_peaks" in data

        assert data["stream_id"] == stream_id
        assert data["total_bets"] == 1
        assert data["highest_multiplier"] == 2.0

    async def test_metrics_endpoint_with_pinned_multipliers(self, client: AsyncClient):
        """Test metrics endpoint with pinned multipliers parameter."""
        # Disable rate limiting for this test to allow multiple ingests
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

        import app.routers.live_streams as live_mod

        live_mod.get_settings = mock_get_settings
        # Create multiple bets with different multipliers
        base_payload = {
            "dateTime": "2025-09-08T20:31:11.123Z",
            "amount": 10.0,
            "payout": 20.0,
            "difficulty": "easy",
            "clientSeed": "pinned_client",
            "serverSeedHashed": "pinned_hash"
        }

        # Create bets with different multipliers
        multipliers = [2.0, 5.0, 10.0, 2.0, 5.0]  # Some duplicates for gap calculation
        stream_id = None

        for i, mult in enumerate(multipliers):
            payload = {
                **base_payload,
                "id": f"pinned_bet_{i}",
                "nonce": i + 1,
                "roundResult": mult,
                "payout": base_payload["amount"] * mult,
            }

            ingest_response = await client.post("/live/ingest", json=payload)
            assert ingest_response.status_code == 200
            if stream_id is None:
                stream_id = ingest_response.json()["streamId"]

        # Test metrics with pinned multipliers
        response = await client.get(
            f"/live/streams/{stream_id}/metrics",
            params={"multipliers": [2.0, 5.0]}
        )

        if response.status_code != 200:
            print(f"Response status: {response.status_code}")
            print(f"Response body: {response.text}")

        assert response.status_code == 200

        data = response.json()
        assert data["total_bets"] == 5
        assert data["highest_multiplier"] == 10.0
        assert len(data["multiplier_stats"]) == 2  # Only requested multipliers

        # Check that we have stats for both requested multipliers
        multiplier_values = [stat["multiplier"] for stat in data["multiplier_stats"]]
        assert 2.0 in multiplier_values
        assert 5.0 in multiplier_values

    async def test_metrics_endpoint_nonexistent_stream(self, client: AsyncClient):
        """Test metrics endpoint with nonexistent stream ID."""
        fake_uuid = "00000000-0000-0000-0000-000000000000"
        response = await client.get(f"/live/streams/{fake_uuid}/metrics")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
