"""
Migration script to add bucket_2dp generated column and indexes for hit-centric analysis.

This migration:
1. Adds a generated bucket_2dp column to live_bets table
2. Creates composite indexes for efficient hit queries
3. Populates existing data with bucket values
4. Verifies index performance
"""

import asyncio
import time
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from ..db import engine
from ..core.config import get_settings


async def check_column_exists(engine: AsyncEngine, table_name: str, column_name: str) -> bool:
    """Check if a column exists in the given table."""
    async with engine.begin() as conn:
        # For generated columns, PRAGMA table_info might not show them in all SQLite versions
        # So we'll check the table schema directly
        try:
            result = await conn.execute(
                text(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table_name}'")
            )
            schema = result.fetchone()
            if schema:
                return column_name in schema[0]
            return False
        except Exception:
            # Fallback to PRAGMA table_info
            result = await conn.execute(
                text(f"PRAGMA table_info({table_name})")
            )
            columns = result.fetchall()
            return any(col[1] == column_name for col in columns)


async def check_index_exists(engine: AsyncEngine, index_name: str) -> bool:
    """Check if an index exists."""
    async with engine.begin() as conn:
        try:
            result = await conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='index' AND name=:index_name"),
                {"index_name": index_name}
            )
            return result.fetchone() is not None
        except OperationalError:
            return False


async def add_bucket_2dp_column(engine: AsyncEngine) -> None:
    """Add the bucket_2dp generated column to live_bets table."""
    print("Adding bucket_2dp column to live_bets table...")
    
    # Check if column already exists
    if await check_column_exists(engine, "live_bets", "bucket_2dp"):
        print("bucket_2dp column already exists, skipping...")
        return
    
    async with engine.begin() as conn:
        # SQLite doesn't support adding generated columns directly
        # We need to create a new table and copy data
        
        # First, create a backup of the original table
        await conn.execute(text("""
            CREATE TABLE live_bets_backup AS 
            SELECT * FROM live_bets
        """))
        
        # Drop the original table
        await conn.execute(text("DROP TABLE live_bets"))
        
        # Create the new table with the bucket_2dp column
        await conn.execute(text("""
            CREATE TABLE live_bets (
                id INTEGER PRIMARY KEY,
                stream_id TEXT NOT NULL,
                antebot_bet_id TEXT NOT NULL,
                received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                date_time TIMESTAMP,
                nonce INTEGER NOT NULL CHECK (nonce >= 1),
                amount REAL NOT NULL CHECK (amount >= 0),
                payout REAL NOT NULL CHECK (payout >= 0),
                difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
                round_target REAL CHECK (round_target IS NULL OR round_target > 0),
                round_result REAL NOT NULL CHECK (round_result >= 0),
                bucket_2dp REAL GENERATED ALWAYS AS (ROUND(round_result, 2)) STORED,
                FOREIGN KEY (stream_id) REFERENCES live_streams(id) ON DELETE CASCADE
            )
        """))
        
        # Copy data back from backup
        await conn.execute(text("""
            INSERT INTO live_bets (
                id, stream_id, antebot_bet_id, received_at, date_time, 
                nonce, amount, payout, difficulty, round_target, round_result
            )
            SELECT 
                id, stream_id, antebot_bet_id, received_at, date_time,
                nonce, amount, payout, difficulty, round_target, round_result
            FROM live_bets_backup
        """))
        
        # Drop the backup table
        await conn.execute(text("DROP TABLE live_bets_backup"))
        
        print("bucket_2dp column added successfully!")


async def create_hit_analysis_indexes(engine: AsyncEngine) -> None:
    """Create composite indexes for efficient hit queries."""
    print("Creating composite indexes for hit analysis...")
    
    indexes = [
        ("idx_live_bets_hit_analysis", "CREATE INDEX IF NOT EXISTS idx_live_bets_hit_analysis ON live_bets (stream_id, bucket_2dp, nonce)"),
        ("idx_live_bets_nonce_range", "CREATE INDEX IF NOT EXISTS idx_live_bets_nonce_range ON live_bets (stream_id, nonce, bucket_2dp)"),
        ("idx_live_bets_stream_id", "CREATE INDEX IF NOT EXISTS idx_live_bets_stream_id ON live_bets (stream_id, id)"),
        ("idx_live_bets_stream_nonce", "CREATE INDEX IF NOT EXISTS idx_live_bets_stream_nonce ON live_bets (stream_id, nonce)"),
        ("idx_live_bets_stream_result", "CREATE INDEX IF NOT EXISTS idx_live_bets_stream_result ON live_bets (stream_id, round_result)"),
        ("idx_live_bets_unique_bet", "CREATE UNIQUE INDEX IF NOT EXISTS idx_live_bets_unique_bet ON live_bets (stream_id, antebot_bet_id)"),
    ]
    
    async with engine.begin() as conn:
        for index_name, create_sql in indexes:
            if not await check_index_exists(engine, index_name):
                print(f"Creating index: {index_name}")
                await conn.execute(text(create_sql))
            else:
                print(f"Index {index_name} already exists, skipping...")
    
    print("All indexes created successfully!")


async def verify_index_performance(engine: AsyncEngine) -> None:
    """Verify that the indexes are working correctly for hit queries."""
    print("Verifying index performance...")
    
    async with engine.begin() as conn:
        # Check if we have any data to test with
        result = await conn.execute(text("SELECT COUNT(*) FROM live_bets"))
        count = (result.fetchone())[0]
        
        if count == 0:
            print("No data in live_bets table, skipping performance verification")
            return
        
        print(f"Found {count} records in live_bets table")
        
        # Test query performance for hit analysis
        test_queries = [
            # Hit query with bucket filter
            """
            SELECT nonce, bucket_2dp, 
                   nonce - LAG(nonce) OVER (PARTITION BY bucket_2dp ORDER BY nonce) as distance
            FROM live_bets 
            WHERE stream_id = (SELECT id FROM live_streams LIMIT 1) 
              AND bucket_2dp = 1000.00 
              AND nonce BETWEEN 0 AND 10000
            ORDER BY nonce
            LIMIT 100
            """,
            
            # Statistics query
            """
            SELECT COUNT(*) as count,
                   AVG(distance) as mean_distance,
                   MIN(distance) as min_distance,
                   MAX(distance) as max_distance
            FROM (
                SELECT nonce - LAG(nonce) OVER (PARTITION BY bucket_2dp ORDER BY nonce) as distance
                FROM live_bets 
                WHERE stream_id = (SELECT id FROM live_streams LIMIT 1) 
                  AND bucket_2dp = 1000.00 
                  AND nonce BETWEEN 0 AND 10000
            ) distances
            WHERE distance IS NOT NULL
            """,
        ]
        
        for i, query in enumerate(test_queries, 1):
            start_time = time.time()
            try:
                result = await conn.execute(text(query))
                result.fetchall()
                end_time = time.time()
                query_time = (end_time - start_time) * 1000  # Convert to milliseconds
                print(f"Test query {i} completed in {query_time:.2f}ms")
            except Exception as e:
                print(f"Test query {i} failed: {e}")
    
    print("Index performance verification completed!")


async def run_migration() -> None:
    """Run the complete migration."""
    print("Starting hit-centric analysis database migration...")
    
    try:
        # Step 1: Add bucket_2dp column
        await add_bucket_2dp_column(engine)
        
        # Step 2: Create indexes
        await create_hit_analysis_indexes(engine)
        
        # Step 3: Verify performance
        await verify_index_performance(engine)
        
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(run_migration())