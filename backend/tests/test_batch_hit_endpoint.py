"""
Tests for the batch hit query endpoint.

This module tests the /live/streams/{stream_id}/hits/batch endpoint
for concurrent bucket analysis scenarios.
"""

import pytest
from uuid import uuid4
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

from app.main import app
from app.db import get_session
from app.models.live_streams import LiveStream, LiveBet
from datetime import datetime


# Test database setup
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def test_db():
    """Create a test database for each test."""
    from app.migrations.add_bucket_2dp_column import add_bucket_2dp_column, create_hit_analysis_indexes
    
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    
    # Run migration to add bucket_2dp column and indexes
    await add_bucket_2dp_column(engine)
    await create_hit_analysis_indexes(engine)

    return engine


@pytest.fixture
async def session(test_db):
    """Create a test session."""
    TestSessionLocal = sessionmaker(test_db, class_=AsyncSession, expire_on_commit=False)
    async with TestSessionLocal() as session:
        yield session


@pytest.fixture
async def client(test_db, monkeypatch):
    """Create test client with test database."""
    TestSessionLocal = sessionmaker(test_db, class_=AsyncSession, expire_on_commit=False)

    async def get_test_session():
        async with TestSessionLocal() as session:
            yield session

    # Override the dependency
    app.dependency_overrides[get_session] = get_test_session

    # Mock rate limiter dependency to always allow requests
    def mock_rate_limit_dependency():
        return lambda: None

    monkeypatch.setattr("app.routers.live_streams.get_rate_limit_dependency", mock_rate_limit_dependency)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


class TestBatchHitEndpoint:
    """Test the batch hit query endpoint."""

    @pytest.fixture
    async def sample_stream_with_multi_bucket_data(self, session: AsyncSession):
        """Create a stream with hits across multiple buckets for testing."""
        # Create stream
        stream = LiveStream(
            server_seed_hashed="test_hash_batch",
            client_seed="test_client_batch",
            created_at=datetime.utcnow(),
            last_seen_at=datetime.utcnow()
        )
        session.add(stream)
        await session.commit()
        await session.refresh(stream)

        # Create bets with multiple buckets
        test_bets = [
            # Bucket 1000.00 hits
            {"nonce": 100, "round_result": 1000.00},
            {"nonce": 300, "round_result": 1000.00},
            {"nonce": 600, "round_result": 1000.00},
            
            # Bucket 2000.00 hits
            {"nonce": 150, "round_result": 2000.00},
            {"nonce": 450, "round_result": 2000.00},
            
            # Bucket 11200.00 hits (rare)
            {"nonce": 200, "round_result": 11200.00},
            {"nonce": 800, "round_result": 11200.00},
            
            # Other multipliers (should not appear in results)
            {"nonce": 50, "round_result": 1.50},
            {"nonce": 250, "round_result": 3.25},
            {"nonce": 500, "round_result": 5.00},
        ]

        for i, bet_data in enumerate(test_bets):
            try:
                bet = LiveBet(
                    stream_id=stream.id,
                    antebot_bet_id=f"batch_test_{i}",
                    received_at=datetime.utcnow(),
                    nonce=bet_data["nonce"],
                    amount=10.0,
                    payout=bet_data["round_result"] * 10.0,
                    difficulty="medium",
                    round_result=bet_data["round_result"]
                )
                session.add(bet)
                print(f"Added bet {i}: nonce={bet_data['nonce']}, result={bet_data['round_result']}")
            except Exception as e:
                print(f"Error creating bet {i}: {e}")

        try:
            await session.commit()
            print("Committed bets successfully")
        except Exception as e:
            print(f"Error committing bets: {e}")
            await session.rollback()
        
        # Debug: Check if data was created
        from sqlalchemy import text
        result = await session.execute(
            text("SELECT nonce, round_result, bucket_2dp FROM live_bets WHERE stream_id = :stream_id ORDER BY nonce"),
            {"stream_id": str(stream.id)}
        )
        rows = result.fetchall()
        print(f"Debug - Created {len(rows)} bets:")
        for row in rows:
            print(f"  Nonce: {row.nonce}, round_result: {row.round_result}, bucket_2dp: {row.bucket_2dp}")
        
        return stream

    async def test_batch_hits_success_multiple_buckets(
        self, client: AsyncClient
    ):
        """Test successful batch query for multiple buckets."""
        # Create test data using the ingest endpoint (same as other tests)
        test_bets = [
            # Bucket 1000.00 hits
            {"id": "batch_bet1", "nonce": 100, "amount": 1.0, "payout": 1000.0, "difficulty": "medium", "roundResult": 1000.00},
            {"id": "batch_bet2", "nonce": 300, "amount": 1.0, "payout": 1000.0, "difficulty": "medium", "roundResult": 1000.00},
            {"id": "batch_bet3", "nonce": 600, "amount": 1.0, "payout": 1000.0, "difficulty": "medium", "roundResult": 1000.00},
            
            # Bucket 2000.00 hits
            {"id": "batch_bet4", "nonce": 150, "amount": 1.0, "payout": 2000.0, "difficulty": "medium", "roundResult": 2000.00},
            {"id": "batch_bet5", "nonce": 450, "amount": 1.0, "payout": 2000.0, "difficulty": "medium", "roundResult": 2000.00},
            
            # Bucket 11200.00 hits (rare)
            {"id": "batch_bet6", "nonce": 200, "amount": 1.0, "payout": 11200.0, "difficulty": "expert", "roundResult": 11200.00},
            {"id": "batch_bet7", "nonce": 800, "amount": 1.0, "payout": 11200.0, "difficulty": "expert", "roundResult": 11200.00},
            
            # Other multipliers (should not appear in results)
            {"id": "batch_bet8", "nonce": 50, "amount": 1.0, "payout": 1.5, "difficulty": "easy", "roundResult": 1.50},
            {"id": "batch_bet9", "nonce": 250, "amount": 1.0, "payout": 3.25, "difficulty": "easy", "roundResult": 3.25},
            {"id": "batch_bet10", "nonce": 500, "amount": 1.0, "payout": 5.0, "difficulty": "easy", "roundResult": 5.00},
        ]
        
        stream_data = {
            "server_seed_hashed": "test_hash_batch_123",
            "client_seed": "test_client_batch_456"
        }
        
        stream_id = None
        
        # Ingest all test bets
        for bet in test_bets:
            ingest_data = {
                "id": bet["id"],
                "dateTime": datetime.utcnow().isoformat() + "Z",
                "nonce": bet["nonce"],
                "amount": bet["amount"],
                "payout": bet["payout"],
                "difficulty": bet["difficulty"],
                "roundTarget": None,
                "roundResult": bet["roundResult"],
                "clientSeed": stream_data["client_seed"],
                "serverSeedHashed": stream_data["server_seed_hashed"]
            }
            
            response = await client.post("/live/ingest", json=ingest_data)
            assert response.status_code == 200
            
            result = response.json()
            if stream_id is None:
                stream_id = result["streamId"]
        
        # Debug: Check what data was actually stored
        debug_response = await client.get(f"/live/streams/{stream_id}/bets", params={"limit": 20})
        if debug_response.status_code == 200:
            debug_data = debug_response.json()
            print(f"Debug: Found {len(debug_data['bets'])} bets in stream")
            for bet in debug_data['bets'][:5]:  # Show first 5 bets
                print(f"  Bet: nonce={bet['nonce']}, round_result={bet['round_result']}")
        
        # First test the regular hit endpoint to see if it works
        print(f"Testing regular hit endpoint for stream {stream_id}")
        regular_response = await client.get(
            f"/live/streams/{stream_id}/hits",
            params={"bucket": 1000.00, "include_distance": True}
        )
        print(f"Regular hit endpoint status: {regular_response.status_code}")
        if regular_response.status_code == 200:
            regular_data = regular_response.json()
            print(f"Regular hit endpoint found {len(regular_data['hits'])} hits")
        else:
            print(f"Regular hit endpoint error: {regular_response.json()}")
        
        response = await client.get(
            f"/live/streams/{stream_id}/hits/batch",
            params={
                "buckets": "1000.00,2000.00,11200.00",
                "limit_per_bucket": 100
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Debug output
        print(f"Batch response data: {data}")
        
        # Verify response structure
        assert "hits_by_bucket" in data
        assert "stats_by_bucket" in data
        
        hits_by_bucket = data["hits_by_bucket"]
        stats_by_bucket = data["stats_by_bucket"]
        
        # Verify all requested buckets are present
        assert "1000.0" in hits_by_bucket
        assert "2000.0" in hits_by_bucket
        assert "11200.0" in hits_by_bucket
        
        # Verify hit counts
        assert len(hits_by_bucket["1000.0"]) == 3  # 3 hits for 1000.00
        assert len(hits_by_bucket["2000.0"]) == 2  # 2 hits for 2000.00
        assert len(hits_by_bucket["11200.0"]) == 2  # 2 hits for 11200.00
        
        # Verify hits are ordered by nonce
        for bucket_hits in hits_by_bucket.values():
            nonces = [hit["nonce"] for hit in bucket_hits]
            assert nonces == sorted(nonces)
        
        # Verify distance calculations
        bucket_1000_hits = hits_by_bucket["1000.0"]
        assert bucket_1000_hits[0]["distance_prev"] is None  # First hit has no previous
        assert bucket_1000_hits[1]["distance_prev"] == 200  # 300 - 100
        assert bucket_1000_hits[2]["distance_prev"] == 300  # 600 - 300
        
        # Verify statistics are calculated
        assert "1000.0" in stats_by_bucket
        assert "2000.0" in stats_by_bucket
        assert "11200.0" in stats_by_bucket
        
        # Check statistics for bucket 1000.0 (has 2 distances: 200, 300)
        stats_1000 = stats_by_bucket["1000.0"]
        assert stats_1000["count"] == 2
        assert stats_1000["mean"] == 250.0  # (200 + 300) / 2
        assert stats_1000["min"] == 200
        assert stats_1000["max"] == 300
        assert stats_1000["method"] == "exact"

    async def test_batch_hits_with_range_filtering(
        self, client: AsyncClient, sample_stream_with_multi_bucket_data: LiveStream
    ):
        """Test batch query with nonce range filtering."""
        stream_id = sample_stream_with_multi_bucket_data.id
        
        response = await client.get(
            f"/live/streams/{stream_id}/hits/batch",
            params={
                "buckets": "1000.00,2000.00",
                "after_nonce": 200,
                "before_nonce": 700,
                "limit_per_bucket": 100
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        hits_by_bucket = data["hits_by_bucket"]
        
        # Should only include hits in range [200, 700)
        # Bucket 1000.00: nonce 300, 600 (both in range)
        # Bucket 2000.00: nonce 450 (in range)
        assert len(hits_by_bucket["1000.0"]) == 2
        assert len(hits_by_bucket["2000.0"]) == 1
        
        # Verify nonces are within range
        for bucket_hits in hits_by_bucket.values():
            for hit in bucket_hits:
                assert 200 <= hit["nonce"] < 700

    async def test_batch_hits_limit_per_bucket(
        self, client: AsyncClient, sample_stream_with_multi_bucket_data: LiveStream
    ):
        """Test that limit_per_bucket is respected."""
        stream_id = sample_stream_with_multi_bucket_data.id
        
        response = await client.get(
            f"/live/streams/{stream_id}/hits/batch",
            params={
                "buckets": "1000.00",
                "limit_per_bucket": 2  # Limit to 2 hits
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        hits_by_bucket = data["hits_by_bucket"]
        
        # Should only return first 2 hits (by nonce order)
        assert len(hits_by_bucket["1000.0"]) == 2
        assert hits_by_bucket["1000.0"][0]["nonce"] == 100
        assert hits_by_bucket["1000.0"][1]["nonce"] == 300

    async def test_batch_hits_empty_buckets(
        self, client: AsyncClient, sample_stream_with_multi_bucket_data: LiveStream
    ):
        """Test batch query with buckets that have no hits."""
        stream_id = sample_stream_with_multi_bucket_data.id
        
        response = await client.get(
            f"/live/streams/{stream_id}/hits/batch",
            params={
                "buckets": "1000.00,99999.00",  # 99999.00 has no hits
                "limit_per_bucket": 100
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        hits_by_bucket = data["hits_by_bucket"]
        stats_by_bucket = data["stats_by_bucket"]
        
        # Bucket 1000.00 should have hits
        assert len(hits_by_bucket["1000.0"]) == 3
        
        # Bucket 99999.00 should be empty
        assert len(hits_by_bucket["99999.0"]) == 0
        
        # Statistics for empty bucket should reflect no data
        stats_empty = stats_by_bucket["99999.0"]
        assert stats_empty["count"] == 0
        assert stats_empty["median"] is None
        assert stats_empty["mean"] is None
        assert stats_empty["min"] is None
        assert stats_empty["max"] is None

    async def test_batch_hits_validation_errors(self, client: AsyncClient):
        """Test validation errors for batch hit endpoint."""
        fake_stream_id = uuid4()
        
        # Test invalid buckets parameter
        response = await client.get(
            f"/live/streams/{fake_stream_id}/hits/batch",
            params={"buckets": "invalid,not_a_number"}
        )
        assert response.status_code == 400
        assert "Invalid bucket values" in response.json()["detail"]
        
        # Test empty buckets
        response = await client.get(
            f"/live/streams/{fake_stream_id}/hits/batch",
            params={"buckets": ""}
        )
        assert response.status_code == 400
        assert "At least one bucket value must be provided" in response.json()["detail"]
        
        # Test too many buckets
        many_buckets = ",".join([str(i) for i in range(25)])  # 25 buckets (over limit of 20)
        response = await client.get(
            f"/live/streams/{fake_stream_id}/hits/batch",
            params={"buckets": many_buckets}
        )
        assert response.status_code == 400
        assert "Maximum 20 buckets allowed" in response.json()["detail"]
        
        # Test negative bucket
        response = await client.get(
            f"/live/streams/{fake_stream_id}/hits/batch",
            params={"buckets": "1000.00,-500.00"}
        )
        assert response.status_code == 400
        assert "cannot be negative" in response.json()["detail"]
        
        # Test invalid nonce range
        response = await client.get(
            f"/live/streams/{fake_stream_id}/hits/batch",
            params={
                "buckets": "1000.00",
                "after_nonce": 1000,
                "before_nonce": 500  # before_nonce <= after_nonce
            }
        )
        assert response.status_code == 400
        assert "before_nonce must be greater than after_nonce" in response.json()["detail"]

    async def test_batch_hits_stream_not_found(self, client: AsyncClient):
        """Test batch query for non-existent stream."""
        fake_stream_id = uuid4()
        
        response = await client.get(
            f"/live/streams/{fake_stream_id}/hits/batch",
            params={"buckets": "1000.00"}
        )
        
        assert response.status_code == 404
        assert f"Stream with ID {fake_stream_id} not found" in response.json()["detail"]

    async def test_batch_hits_concurrent_analysis_scenario(
        self, client: AsyncClient, sample_stream_with_multi_bucket_data: LiveStream
    ):
        """Test concurrent bucket analysis scenario as specified in requirements."""
        stream_id = sample_stream_with_multi_bucket_data.id
        
        # Simulate analyzing multiple rare multipliers simultaneously
        response = await client.get(
            f"/live/streams/{stream_id}/hits/batch",
            params={
                "buckets": "11200.00,2000.00,1000.00",  # Mix of rare and common
                "after_nonce": 0,
                "before_nonce": 1000,
                "limit_per_bucket": 500
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify we can analyze multiple buckets efficiently
        hits_by_bucket = data["hits_by_bucket"]
        stats_by_bucket = data["stats_by_bucket"]
        
        # All requested buckets should be present
        assert "11200.0" in hits_by_bucket
        assert "2000.0" in hits_by_bucket
        assert "1000.0" in hits_by_bucket
        
        # Each bucket should have its own statistics
        for bucket in ["11200.0", "2000.0", "1000.0"]:
            assert bucket in stats_by_bucket
            assert "count" in stats_by_bucket[bucket]
            assert "method" in stats_by_bucket[bucket]
            assert stats_by_bucket[bucket]["method"] == "exact"
        
        # Verify the response enables concurrent analysis
        # (i.e., all data needed for multiple bucket analysis is present)
        total_hits = sum(len(hits) for hits in hits_by_bucket.values())
        assert total_hits > 0  # Should have some hits across all buckets

    async def test_batch_hits_performance_with_many_buckets(
        self, client: AsyncClient, sample_stream_with_multi_bucket_data: LiveStream
    ):
        """Test performance with maximum allowed buckets."""
        stream_id = sample_stream_with_multi_bucket_data.id
        
        # Create 20 buckets (maximum allowed)
        buckets = [f"{1000 + i * 100}.00" for i in range(20)]
        buckets_param = ",".join(buckets)
        
        response = await client.get(
            f"/live/streams/{stream_id}/hits/batch",
            params={
                "buckets": buckets_param,
                "limit_per_bucket": 10
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should handle all 20 buckets without error
        assert len(data["hits_by_bucket"]) == 20
        assert len(data["stats_by_bucket"]) == 20
        
        # Most buckets will be empty (no hits), but structure should be consistent
        for bucket_str in data["hits_by_bucket"]:
            assert isinstance(data["hits_by_bucket"][bucket_str], list)
            assert bucket_str in data["stats_by_bucket"]
            assert "count" in data["stats_by_bucket"][bucket_str]