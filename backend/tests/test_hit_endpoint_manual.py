#!/usr/bin/env python3
"""
Manual test script for the hit query endpoint.
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
    """Create test data for the hit endpoint."""
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

        # Create test bets with specific multipliers for testing
        bet_data = [
            (100, 1000.00, "bet_100"),
            (300, 1000.00, "bet_300"),
            (700, 1000.00, "bet_700"),
            (1500, 1000.00, "bet_1500"),
            (500, 2000.00, "bet_500"),
            (800, 2000.00, "bet_800"),
            (1200, 11200.00, "bet_1200"),  # Rare multiplier
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
        print(f"Created test stream: {stream.id}")
        return stream.id


def test_hit_endpoint(stream_id):
    """Test the hit endpoint with various scenarios."""
    client = TestClient(app)

    print(f"\nTesting hit endpoint with stream: {stream_id}")

    # Test 1: Basic hit query for bucket 1000.00
    print("\n1. Testing basic hit query for bucket 1000.00...")
    response = client.get(
        f"/live/streams/{stream_id}/hits",
        params={"bucket": 1000.00, "include_distance": True},
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Hits found: {len(data['hits'])}")
        print(f"Total in range: {data['total_in_range']}")
        print("Hit details:")
        for hit in data["hits"]:
            print(
                f"  Nonce: {hit['nonce']}, Bucket: {hit['bucket']}, Distance: {hit['distance_prev']}"
            )
    else:
        print(f"Error: {response.json()}")

    # Test 2: Query for bucket 2000.00
    print("\n2. Testing query for bucket 2000.00...")
    response = client.get(
        f"/live/streams/{stream_id}/hits",
        params={"bucket": 2000.00, "include_distance": True},
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Hits found: {len(data['hits'])}")
        for hit in data["hits"]:
            print(
                f"  Nonce: {hit['nonce']}, Bucket: {hit['bucket']}, Distance: {hit['distance_prev']}"
            )
    else:
        print(f"Error: {response.json()}")

    # Test 3: Query for rare multiplier 11200.00
    print("\n3. Testing query for rare multiplier 11200.00...")
    response = client.get(
        f"/live/streams/{stream_id}/hits",
        params={"bucket": 11200.00, "include_distance": True},
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Hits found: {len(data['hits'])}")
        for hit in data["hits"]:
            print(
                f"  Nonce: {hit['nonce']}, Bucket: {hit['bucket']}, Distance: {hit['distance_prev']}"
            )
    else:
        print(f"Error: {response.json()}")

    # Test 4: Query with range boundaries
    print("\n4. Testing range boundary handling...")
    response = client.get(
        f"/live/streams/{stream_id}/hits",
        params={
            "bucket": 1000.00,
            "after_nonce": 250,
            "before_nonce": 1000,
            "include_distance": True,
        },
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Hits found: {len(data['hits'])}")
        print(f"Previous nonce before range: {data['prev_nonce_before_range']}")
        for hit in data["hits"]:
            print(
                f"  Nonce: {hit['nonce']}, Bucket: {hit['bucket']}, Distance: {hit['distance_prev']}"
            )
    else:
        print(f"Error: {response.json()}")

    # Test 5: Query without distance calculation
    print("\n5. Testing without distance calculation...")
    response = client.get(
        f"/live/streams/{stream_id}/hits",
        params={"bucket": 1000.00, "include_distance": False},
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Hits found: {len(data['hits'])}")
        for hit in data["hits"]:
            print(
                f"  Nonce: {hit['nonce']}, Bucket: {hit['bucket']}, Distance: {hit['distance_prev']}"
            )
    else:
        print(f"Error: {response.json()}")

    # Test 6: Error handling
    print("\n6. Testing error handling...")

    # Negative bucket
    response = client.get(f"/live/streams/{stream_id}/hits", params={"bucket": -100.00})
    print(
        f"Negative bucket - Status: {response.status_code}, Error: {response.json()['detail'] if response.status_code != 200 else 'No error'}"
    )

    # Invalid range
    response = client.get(
        f"/live/streams/{stream_id}/hits",
        params={"bucket": 1000.00, "after_nonce": 1000, "before_nonce": 500},
    )
    print(
        f"Invalid range - Status: {response.status_code}, Error: {response.json()['detail'] if response.status_code != 200 else 'No error'}"
    )

    # Non-existent stream
    fake_stream_id = uuid4()
    response = client.get(
        f"/live/streams/{fake_stream_id}/hits", params={"bucket": 1000.00}
    )
    print(
        f"Non-existent stream - Status: {response.status_code}, Error: {response.json()['detail'] if response.status_code != 200 else 'No error'}"
    )


async def main():
    """Main test function."""
    try:
        # Create test data
        stream_id = await create_test_data()

        # Test the endpoint
        test_hit_endpoint(stream_id)

        print("\n✅ All tests completed successfully!")

    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
