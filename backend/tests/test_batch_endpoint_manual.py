#!/usr/bin/env python3
"""
Manual test script for the batch hit query endpoint.
"""

import asyncio
import sys
from datetime import datetime
from uuid import uuid4
from fastapi.testclient import TestClient

# Add the app directory to the Python path
sys.path.insert(0, "app")

from app.main import app
from app.db import get_session
from app.models.live_streams import LiveStream, LiveBet
from sqlalchemy.ext.asyncio import AsyncSession


async def create_test_data():
    """Create test data for the batch hit endpoint."""
    print("Creating test data...")

    # Get database session
    from app.db import engine

    async with AsyncSession(engine) as session:
        # Create a test stream
        stream = LiveStream(
            id=uuid4(),
            server_seed_hashed=f"test_seed_{uuid4()}",
            client_seed=f"test_client_{uuid4()}",
            created_at=datetime.utcnow(),
            last_seen_at=datetime.utcnow(),
        )
        session.add(stream)
        await session.commit()
        await session.refresh(stream)

        # Create test bets with multiple buckets
        bet_data = [
            # Bucket 1000.00 hits
            (100, 1000.00, "bet_100"),
            (300, 1000.00, "bet_300"),
            (600, 1000.00, "bet_600"),
            
            # Bucket 2000.00 hits
            (150, 2000.00, "bet_150"),
            (450, 2000.00, "bet_450"),
            
            # Bucket 11200.00 hits (rare)
            (200, 11200.00, "bet_200"),
            (800, 11200.00, "bet_800"),
            
            # Other multipliers (should not appear in results)
            (50, 1.50, "bet_50"),
            (250, 3.25, "bet_250"),
            (500, 5.00, "bet_500"),
        ]

        for nonce, multiplier, bet_id in bet_data:
            bet = LiveBet(
                stream_id=stream.id,
                antebot_bet_id=bet_id,
                received_at=datetime.utcnow(),
                date_time=datetime.utcnow(),
                nonce=nonce,
                amount=10.0,
                payout=10.0 * multiplier,
                difficulty="medium",
                round_target=None,
                round_result=multiplier,
            )
            session.add(bet)

        await session.commit()
        await session.refresh(stream)
        stream_id = stream.id
        
        # Debug: Check if data was created correctly
        from sqlalchemy import text
        result = await session.execute(
            text("SELECT nonce, round_result, bucket_2dp FROM live_bets WHERE stream_id = :stream_id ORDER BY nonce"),
            {"stream_id": str(stream_id)}
        )
        rows = result.fetchall()
        print(f"Created test stream: {stream_id}")
        print("Debug - Created bets:")
        for row in rows:
            print(f"  Nonce: {row.nonce}, round_result: {row.round_result}, bucket_2dp: {row.bucket_2dp}")
        
        return stream_id


def test_batch_endpoint(stream_id):
    """Test the batch hit endpoint with various scenarios."""
    client = TestClient(app)

    print(f"\nTesting batch hit endpoint with stream: {stream_id}")

    # Test 1: Basic batch query for multiple buckets
    print("\n1. Testing basic batch query for multiple buckets...")
    response = client.get(
        f"/live/streams/{stream_id}/hits/batch",
        params={
            "buckets": "1000.00,2000.00,11200.00",
            "limit_per_bucket": 100
        }
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("Response structure:")
        print(f"  hits_by_bucket keys: {list(data['hits_by_bucket'].keys())}")
        print(f"  stats_by_bucket keys: {list(data['stats_by_bucket'].keys())}")
        
        for bucket, hits in data['hits_by_bucket'].items():
            print(f"\nBucket {bucket}:")
            print(f"  Hits found: {len(hits)}")
            for hit in hits:
                print(f"    Nonce: {hit['nonce']}, Distance: {hit['distance_prev']}")
            
            # Show statistics
            stats = data['stats_by_bucket'][bucket]
            print(f"  Statistics: count={stats['count']}, mean={stats['mean']}, median={stats['median']}")
    else:
        print(f"Error: {response.json()}")

    # Test 2: Batch query with range filtering
    print("\n2. Testing batch query with range filtering...")
    response = client.get(
        f"/live/streams/{stream_id}/hits/batch",
        params={
            "buckets": "1000.00,2000.00",
            "after_nonce": 200,
            "before_nonce": 700,
            "limit_per_bucket": 100
        }
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        for bucket, hits in data['hits_by_bucket'].items():
            print(f"Bucket {bucket} (range 200-700): {len(hits)} hits")
            for hit in hits:
                print(f"  Nonce: {hit['nonce']} (in range: {200 <= hit['nonce'] < 700})")
    else:
        print(f"Error: {response.json()}")

    # Test 3: Batch query with limit per bucket
    print("\n3. Testing limit per bucket...")
    response = client.get(
        f"/live/streams/{stream_id}/hits/batch",
        params={
            "buckets": "1000.00",
            "limit_per_bucket": 2
        }
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        hits = data['hits_by_bucket']['1000.0']
        print(f"Limited to 2 hits: {len(hits)} hits returned")
        for hit in hits:
            print(f"  Nonce: {hit['nonce']}")
    else:
        print(f"Error: {response.json()}")

    # Test 4: Error handling
    print("\n4. Testing error handling...")

    # Invalid buckets
    response = client.get(
        f"/live/streams/{stream_id}/hits/batch",
        params={"buckets": "invalid,not_a_number"}
    )
    print(f"Invalid buckets - Status: {response.status_code}")
    if response.status_code != 200:
        print(f"  Error: {response.json()['detail']}")

    # Empty buckets
    response = client.get(
        f"/live/streams/{stream_id}/hits/batch",
        params={"buckets": ""}
    )
    print(f"Empty buckets - Status: {response.status_code}")
    if response.status_code != 200:
        print(f"  Error: {response.json()['detail']}")

    # Too many buckets
    many_buckets = ",".join([str(i) for i in range(25)])
    response = client.get(
        f"/live/streams/{stream_id}/hits/batch",
        params={"buckets": many_buckets}
    )
    print(f"Too many buckets - Status: {response.status_code}")
    if response.status_code != 200:
        print(f"  Error: {response.json()['detail']}")

    # Negative bucket
    response = client.get(
        f"/live/streams/{stream_id}/hits/batch",
        params={"buckets": "1000.00,-500.00"}
    )
    print(f"Negative bucket - Status: {response.status_code}")
    if response.status_code != 200:
        print(f"  Error: {response.json()['detail']}")

    # Invalid range
    response = client.get(
        f"/live/streams/{stream_id}/hits/batch",
        params={
            "buckets": "1000.00",
            "after_nonce": 1000,
            "before_nonce": 500
        }
    )
    print(f"Invalid range - Status: {response.status_code}")
    if response.status_code != 200:
        print(f"  Error: {response.json()['detail']}")

    # Non-existent stream
    fake_stream_id = uuid4()
    response = client.get(
        f"/live/streams/{fake_stream_id}/hits/batch",
        params={"buckets": "1000.00"}
    )
    print(f"Non-existent stream - Status: {response.status_code}")
    if response.status_code != 200:
        print(f"  Error: {response.json()['detail']}")


async def main():
    """Main test function."""
    try:
        # Create test data
        stream_id = await create_test_data()

        # Test the endpoint
        test_batch_endpoint(stream_id)

        print("\n✅ All tests completed successfully!")

    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())