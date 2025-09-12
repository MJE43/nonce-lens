"""
Tests for the bucket_2dp column migration and hit-centric analysis indexes.
"""

import pytest
import asyncio
from uuid import uuid4
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.db import engine, create_db_and_tables
from app.models.live_streams import LiveStream, LiveBet
from app.migrations.add_bucket_2dp_column import (
    check_column_exists,
    check_index_exists,
    add_bucket_2dp_column,
    create_hit_analysis_indexes,
)


@pytest.fixture
async def setup_test_db():
    """Set up test database with tables."""
    await create_db_and_tables()
    yield
    # Cleanup is handled by pytest-asyncio


@pytest.mark.asyncio
async def test_bucket_2dp_column_exists(setup_test_db):
    """Test that bucket_2dp column exists after migration."""
    # Run migration
    await add_bucket_2dp_column(engine)
    
    # Check column exists
    exists = await check_column_exists(engine, "live_bets", "bucket_2dp")
    assert exists, "bucket_2dp column should exist after migration"


@pytest.mark.asyncio
async def test_hit_analysis_indexes_created(setup_test_db):
    """Test that hit analysis indexes are created."""
    # Run migration
    await add_bucket_2dp_column(engine)
    await create_hit_analysis_indexes(engine)
    
    # Check indexes exist
    expected_indexes = [
        "idx_live_bets_hit_analysis",
        "idx_live_bets_nonce_range",
    ]
    
    for index_name in expected_indexes:
        exists = await check_index_exists(engine, index_name)
        assert exists, f"Index {index_name} should exist after migration"


@pytest.mark.asyncio
async def test_bucket_2dp_calculation(setup_test_db):
    """Test that bucket_2dp is calculated correctly."""
    # Run migration first
    await add_bucket_2dp_column(engine)
    await create_hit_analysis_indexes(engine)
    
    # Create test data
    stream_id = uuid4()
    
    async with engine.begin() as conn:
        # Insert test stream
        await conn.execute(
            text("""
                INSERT INTO live_streams (id, server_seed_hashed, client_seed, created_at, last_seen_at)
                VALUES (:stream_id, :hash, :client, datetime('now'), datetime('now'))
            """),
            {
                "stream_id": str(stream_id),
                "hash": f"test_hash_calc_{stream_id}",
                "client": f"test_client_calc_{stream_id}"
            }
        )
        
        # Insert test bet with specific round_result
        await conn.execute(
            text("""
                INSERT INTO live_bets (
                    stream_id, antebot_bet_id, nonce, amount, payout, 
                    difficulty, round_result
                ) VALUES (
                    :stream_id, 'test_bet_1', 1, 100.0, 1120000.0, 
                    'expert', 11200.123456
                )
            """),
            {"stream_id": str(stream_id)}
        )
        
        # Check that bucket_2dp is calculated correctly
        result = await conn.execute(
            text("SELECT bucket_2dp FROM live_bets WHERE antebot_bet_id = 'test_bet_1'")
        )
        bucket_value = (result.fetchone())[0]
        
        # Should be rounded to 2 decimal places
        assert bucket_value == 11200.12, f"Expected 11200.12, got {bucket_value}"


@pytest.mark.asyncio
async def test_hit_query_performance(setup_test_db):
    """Test that hit queries work efficiently with the new indexes."""
    # Run migration first
    await add_bucket_2dp_column(engine)
    await create_hit_analysis_indexes(engine)
    
    # Create test data
    stream_id = uuid4()
    
    async with engine.begin() as conn:
        # Insert test stream
        await conn.execute(
            text("""
                INSERT INTO live_streams (id, server_seed_hashed, client_seed, created_at, last_seen_at)
                VALUES (:stream_id, :hash, :client, datetime('now'), datetime('now'))
            """),
            {
                "stream_id": str(stream_id),
                "hash": f"test_hash_perf_{stream_id}",
                "client": f"test_client_perf_{stream_id}"
            }
        )
        
        # Insert multiple test bets
        test_bets = [
            (1, 1000.00),
            (5, 1000.00),
            (10, 2000.00),
            (15, 1000.00),
            (20, 3000.00),
        ]
        
        for nonce, result in test_bets:
            await conn.execute(
                text("""
                    INSERT INTO live_bets (
                        stream_id, antebot_bet_id, nonce, amount, payout, 
                        difficulty, round_result
                    ) VALUES (
                        :stream_id, :bet_id, :nonce, 100.0, :payout, 
                        'expert', :result
                    )
                """),
                {
                    "stream_id": str(stream_id),
                    "bet_id": f"test_bet_{nonce}",
                    "nonce": nonce,
                    "payout": result,
                    "result": result
                }
            )
        
        # Test hit query with bucket filter
        result = await conn.execute(
            text("""
                SELECT nonce, bucket_2dp, 
                       nonce - LAG(nonce) OVER (PARTITION BY bucket_2dp ORDER BY nonce) as distance
                FROM live_bets 
                WHERE stream_id = :stream_id 
                  AND bucket_2dp = 1000.00 
                ORDER BY nonce
            """),
            {"stream_id": str(stream_id)}
        )
        
        hits = result.fetchall()
        
        # Should find 3 hits with bucket 1000.00
        assert len(hits) == 3, f"Expected 3 hits, got {len(hits)}"
        
        # Check distances are calculated correctly
        expected_distances = [None, 4, 10]  # First hit has no previous, then gaps of 4 and 10
        actual_distances = [hit[2] for hit in hits]
        
        assert actual_distances == expected_distances, f"Expected {expected_distances}, got {actual_distances}"


@pytest.mark.asyncio
async def test_statistics_query(setup_test_db):
    """Test that statistics queries work with the new schema."""
    # Run migration first
    await add_bucket_2dp_column(engine)
    await create_hit_analysis_indexes(engine)
    
    # Create test data
    stream_id = uuid4()
    
    async with engine.begin() as conn:
        # Insert test stream
        await conn.execute(
            text("""
                INSERT INTO live_streams (id, server_seed_hashed, client_seed, created_at, last_seen_at)
                VALUES (:stream_id, :hash, :client, datetime('now'), datetime('now'))
            """),
            {
                "stream_id": str(stream_id),
                "hash": f"test_hash_stats_{stream_id}",
                "client": f"test_client_stats_{stream_id}"
            }
        )
        
        # Insert test bets with known distances
        test_bets = [
            (1, 1000.00),   # First hit
            (6, 1000.00),   # Distance: 5
            (16, 1000.00),  # Distance: 10
            (31, 1000.00),  # Distance: 15
        ]
        
        for nonce, result in test_bets:
            await conn.execute(
                text("""
                    INSERT INTO live_bets (
                        stream_id, antebot_bet_id, nonce, amount, payout, 
                        difficulty, round_result
                    ) VALUES (
                        :stream_id, :bet_id, :nonce, 100.0, :payout, 
                        'expert', :result
                    )
                """),
                {
                    "stream_id": str(stream_id),
                    "bet_id": f"test_bet_{nonce}",
                    "nonce": nonce,
                    "payout": result,
                    "result": result
                }
            )
        
        # Test statistics query
        result = await conn.execute(
            text("""
                SELECT COUNT(*) as count,
                       AVG(distance) as mean_distance,
                       MIN(distance) as min_distance,
                       MAX(distance) as max_distance
                FROM (
                    SELECT nonce - LAG(nonce) OVER (PARTITION BY bucket_2dp ORDER BY nonce) as distance
                    FROM live_bets 
                    WHERE stream_id = :stream_id 
                      AND bucket_2dp = 1000.00 
                ) distances
                WHERE distance IS NOT NULL
            """),
            {"stream_id": str(stream_id)}
        )
        
        stats = result.fetchone()
        count, mean_distance, min_distance, max_distance = stats
        
        # Should have 3 distances (excluding first hit)
        assert count == 3, f"Expected 3 distances, got {count}"
        
        # Mean should be (5 + 10 + 15) / 3 = 10
        assert abs(mean_distance - 10.0) < 0.001, f"Expected mean ~10.0, got {mean_distance}"
        
        # Min and max should be 5 and 15
        assert min_distance == 5, f"Expected min 5, got {min_distance}"
        assert max_distance == 15, f"Expected max 15, got {max_distance}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])