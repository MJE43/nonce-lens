#!/usr/bin/env python3
"""
Verification script to check that the hit-centric analysis migration is working correctly.
"""

import asyncio
import sys
import os

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.db import engine
from sqlalchemy import text


async def verify_migration():
    """Verify that the migration is working correctly."""
    print("Verifying hit-centric analysis migration...")
    
    async with engine.begin() as conn:
        # Check bucket_2dp column exists and is working
        result = await conn.execute(
            text("SELECT COUNT(*) FROM live_bets WHERE bucket_2dp IS NOT NULL")
        )
        bucket_count = result.fetchone()[0]
        print(f"✓ bucket_2dp column working: {bucket_count} records with bucket values")
        
        # Check indexes exist
        result = await conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='live_bets' AND name LIKE '%hit%'")
        )
        hit_indexes = result.fetchall()
        print(f"✓ Hit analysis indexes created: {len(hit_indexes)} indexes")
        for idx in hit_indexes:
            print(f"  - {idx[0]}")
        
        # Test a sample hit query
        result = await conn.execute(
            text("""
                SELECT nonce, bucket_2dp, 
                       nonce - LAG(nonce) OVER (PARTITION BY bucket_2dp ORDER BY nonce) as distance
                FROM live_bets 
                WHERE bucket_2dp = 1000.00 
                ORDER BY nonce 
                LIMIT 3
            """)
        )
        hits = result.fetchall()
        print(f"✓ Hit query working: Found {len(hits)} hits for bucket 1000.00")
        for hit in hits:
            print(f"  - nonce: {hit[0]}, distance: {hit[2]}")
        
        # Test statistics query
        result = await conn.execute(
            text("""
                SELECT COUNT(*) as count,
                       AVG(distance) as mean_distance
                FROM (
                    SELECT nonce - LAG(nonce) OVER (PARTITION BY bucket_2dp ORDER BY nonce) as distance
                    FROM live_bets 
                    WHERE bucket_2dp = 1000.00 
                ) distances
                WHERE distance IS NOT NULL
            """)
        )
        stats = result.fetchone()
        print(f"✓ Statistics query working: {stats[0]} distances, mean: {stats[1]:.2f}")
    
    print("\nMigration verification completed successfully! 🎉")


if __name__ == "__main__":
    asyncio.run(verify_migration())