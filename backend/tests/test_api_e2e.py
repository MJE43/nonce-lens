"""
End-to-end API tests for the Pump Analyzer Web API.

These tests validate the complete API functionality including:
- Run creation and persistence
- Run listing with filters
- Run details retrieval
- Hits pagination and filtering
- CSV export endpoints
- Verify endpoint
- Error handling and validation
"""

import json
import pytest
from httpx import AsyncClient
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine

from app.main import app
from app.db import get_session
from app.engine.pump import ENGINE_VERSION
from app.models.runs import Run, Hit
from uuid import uuid4
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession


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
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.ext.asyncio import AsyncSession

    TestSessionLocal = sessionmaker(test_db, class_=AsyncSession, expire_on_commit=False)

    async def get_test_session():
        async with TestSessionLocal() as session:
            yield session

    app.dependency_overrides[get_session] = get_test_session

    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


class TestHealthCheck:
    """Test basic health check endpoint."""

    async def test_health_check(self, client: AsyncClient):
        """Test health check endpoint."""
        response = await client.get("/healthz")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestRunCreation:
    """Test run creation endpoint."""

    async def test_create_run_success(self, client: AsyncClient):
        """Test successful run creation."""
        payload = {
            "server_seed": "test_server_seed_123",
            "client_seed": "test_client",
            "start": 1,
            "end": 10,
            "difficulty": "easy",
            "targets": [1.0, 2.0, 5.0]
        }

        response = await client.post("/runs", json=payload)
        assert response.status_code == 201

        data = response.json()

        # Check response structure
        required_fields = {
            "id", "created_at", "server_seed_sha256", "server_seed",
            "client_seed", "nonce_start", "nonce_end", "difficulty",
            "targets", "duration_ms", "engine_version", "summary"
        }
        assert set(data.keys()) == required_fields

        # Check values
        assert data["server_seed"] == payload["server_seed"]
        assert data["client_seed"] == payload["client_seed"]
        assert data["nonce_start"] == payload["start"]
        assert data["nonce_end"] == payload["end"]
        assert data["difficulty"] == payload["difficulty"]
        assert data["targets"] == sorted(payload["targets"])  # Should be sorted
        assert data["engine_version"] == ENGINE_VERSION
        assert isinstance(data["duration_ms"], int)
        assert data["duration_ms"] >= 0

        # Check summary structure
        summary = data["summary"]
        summary_fields = {
            "count", "duration_ms", "difficulty", "start", "end",
            "targets", "max_multiplier", "median_multiplier",
            "counts_by_target", "top_max"
        }
        assert set(summary.keys()) == summary_fields
        assert summary["count"] == 10
        assert summary["start"] == 1
        assert summary["end"] == 10

    async def test_create_run_validation_errors(self, client: AsyncClient):
        """Test validation errors in run creation."""

        # Empty server seed
        response = await client.post("/runs", json={
            "server_seed": "",
            "client_seed": "test",
            "start": 1,
            "end": 10,
            "difficulty": "easy",
            "targets": [1.0]
        })
        assert response.status_code == 422
        error = response.json()["error"]
        assert error["field"] == "server_seed"

        # Invalid difficulty
        response = await client.post("/runs", json={
            "server_seed": "test_server",
            "client_seed": "test",
            "start": 1,
            "end": 10,
            "difficulty": "invalid",
            "targets": [1.0]
        })
        assert response.status_code == 422
        error = response.json()["error"]
        assert error["field"] == "difficulty"

        # Invalid range
        response = await client.post("/runs", json={
            "server_seed": "test_server",
            "client_seed": "test",
            "start": 10,
            "end": 5,
            "difficulty": "easy",
            "targets": [1.0]
        })
        assert response.status_code == 422
        error = response.json()["error"]
        assert error["field"] == "end"

        # Empty targets
        response = await client.post("/runs", json={
            "server_seed": "test_server",
            "client_seed": "test",
            "start": 1,
            "end": 10,
            "difficulty": "easy",
            "targets": []
        })
        assert response.status_code == 422
        error = response.json()["error"]
        assert error["field"] == "targets"

    async def test_create_run_range_too_large(self, client: AsyncClient):
        """Test range size limit enforcement."""
        response = await client.post("/runs", json={
            "server_seed": "test_server",
            "client_seed": "test",
            "start": 1,
            "end": 1_000_001,  # Exceeds default limit of 500k
            "difficulty": "easy",
            "targets": [1.0]
        })
        assert response.status_code == 413
        error = response.json()["error"]
        assert error["code"] == "RANGE_TOO_LARGE"

    async def test_create_run_target_sanitization(self, client: AsyncClient):
        """Test target sanitization (deduplication, sorting)."""
        response = await client.post("/runs", json={
            "server_seed": "test_server",
            "client_seed": "test",
            "start": 1,
            "end": 5,
            "difficulty": "easy",
            "targets": [5.0, 1.0, 5.0, 2.0]  # Duplicates and unsorted
        })
        assert response.status_code == 201

        data = response.json()
        assert data["targets"] == [1.0, 2.0, 5.0]  # Deduplicated and sorted


class TestRunListing:
    """Test run listing endpoint."""

    async def test_list_runs_empty(self, client: AsyncClient):
        """Test listing when no runs exist."""
        response = await client.get("/runs")
        assert response.status_code == 200

        data = response.json()
        assert "runs" in data
        assert "total" in data
        assert isinstance(data["runs"], list)
        assert len(data["runs"]) == 0
        assert data["total"] == 0

    async def test_list_runs_with_data(self, client: AsyncClient):
        """Test listing with existing runs."""
        # Create a test run first
        create_response = await client.post("/runs", json={
            "server_seed": "test_server",
            "client_seed": "test_client_123",
            "start": 1,
            "end": 5,
            "difficulty": "medium",
            "targets": [1.0, 10.0]
        })
        assert create_response.status_code == 201

        # List runs
        response = await client.get("/runs")
        assert response.status_code == 200

        data = response.json()
        assert "runs" in data
        assert "total" in data
        assert isinstance(data["runs"], list)
        assert len(data["runs"]) == 1
        assert data["total"] == 1

        run = data["runs"][0]
        required_fields = {
            "id", "created_at", "server_seed_sha256", "client_seed",
            "difficulty", "nonce_start", "nonce_end", "duration_ms",
            "engine_version", "targets", "counts_by_target"
        }
        assert set(run.keys()) == required_fields

        # Should not include full server_seed in list
        assert "server_seed" not in run
        assert len(run["server_seed_sha256"]) == 64  # SHA256 hex length

    async def test_list_runs_pagination(self, client: AsyncClient):
        """Test run listing pagination."""
        # Create multiple runs
        for i in range(3):
            await client.post("/runs", json={
                "server_seed": f"server_{i}",
                "client_seed": f"client_{i}",
                "start": 1,
                "end": 2,
                "difficulty": "easy",
                "targets": [1.0]
            })

        # Test limit
        response = await client.get("/runs?limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["runs"]) == 2

        # Test offset
        response = await client.get("/runs?limit=2&offset=1")
        assert response.status_code == 200
        data = response.json()
        assert len(data["runs"]) == 2

    async def test_list_runs_search_filter(self, client: AsyncClient):
        """Test run listing with search filter."""
        # Create runs with different client seeds
        await client.post("/runs", json={
            "server_seed": "server1",
            "client_seed": "findme_123",
            "start": 1,
            "end": 2,
            "difficulty": "easy",
            "targets": [1.0]
        })

        await client.post("/runs", json={
            "server_seed": "server2",
            "client_seed": "other_456",
            "start": 1,
            "end": 2,
            "difficulty": "easy",
            "targets": [1.0]
        })

        # Search for specific client seed
        response = await client.get("/runs?search=findme")
        assert response.status_code == 200
        data = response.json()
        assert len(data["runs"]) == 1
        assert "findme" in data["runs"][0]["client_seed"]

    async def test_list_runs_difficulty_filter(self, client: AsyncClient):
        """Test run listing with difficulty filter."""
        # Create runs with different difficulties
        await client.post("/runs", json={
            "server_seed": "server1",
            "client_seed": "client1",
            "start": 1,
            "end": 2,
            "difficulty": "easy",
            "targets": [1.0]
        })

        await client.post("/runs", json={
            "server_seed": "server2",
            "client_seed": "client2",
            "start": 1,
            "end": 2,
            "difficulty": "hard",
            "targets": [1.0]
        })

        # Filter by difficulty
        response = await client.get("/runs?difficulty=easy")
        assert response.status_code == 200
        data = response.json()
        assert len(data["runs"]) == 1
        assert data["runs"][0]["difficulty"] == "easy"


class TestRunDetails:
    """Test run details endpoint."""

    async def test_get_run_success(self, client: AsyncClient):
        """Test successful run details retrieval."""
        # Create a run first
        create_response = await client.post("/runs", json={
            "server_seed": "detailed_server_seed",
            "client_seed": "detailed_client",
            "start": 1,
            "end": 5,
            "difficulty": "expert",
            "targets": [1.0, 100.0]
        })
        run_id = create_response.json()["id"]

        # Get run details
        response = await client.get(f"/runs/{run_id}")
        assert response.status_code == 200

        data = response.json()

        # Should include full server_seed in details
        assert data["server_seed"] == "detailed_server_seed"
        assert data["client_seed"] == "detailed_client"
        assert data["difficulty"] == "expert"

    async def test_get_run_not_found(self, client: AsyncClient):
        """Test run details for non-existent run."""
        fake_uuid = "12345678-1234-1234-1234-123456789012"
        response = await client.get(f"/runs/{fake_uuid}")
        assert response.status_code == 404

        error = response.json()["error"]
        assert error["code"] == "NOT_FOUND"


class TestRunHits:
    """Test run hits endpoint."""

    async def test_get_hits_success(self, client: AsyncClient):
        """Test successful hits retrieval."""
        # Create a run first
        create_response = await client.post("/runs", json={
            "server_seed": "hits_server",
            "client_seed": "hits_client",
            "start": 1,
            "end": 10,
            "difficulty": "easy",
            "targets": [1.0]  # Should have hits for 1.0
        })
        run_id = create_response.json()["id"]

        # Get hits
        response = await client.get(f"/runs/{run_id}/hits")
        assert response.status_code == 200

        data = response.json()
        assert "total" in data
        assert "rows" in data
        assert isinstance(data["total"], int)
        assert isinstance(data["rows"], list)

        # Check hit structure
        if data["rows"]:
            hit = data["rows"][0]
            assert "nonce" in hit
            assert "max_multiplier" in hit
            assert isinstance(hit["nonce"], int)
            assert isinstance(hit["max_multiplier"], (int, float))

    async def test_get_hits_pagination(self, client: AsyncClient):
        """Test hits pagination."""
        # Create a run with many hits
        create_response = await client.post("/runs", json={
            "server_seed": "pagination_server",
            "client_seed": "pagination_client",
            "start": 1,
            "end": 50,
            "difficulty": "easy",
            "targets": [1.0]
        })
        run_id = create_response.json()["id"]

        # Test limit
        response = await client.get(f"/runs/{run_id}/hits?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data["rows"]) <= 5

    async def test_get_hits_min_multiplier_filter(self, client: AsyncClient):
        """Test hits filtering by minimum multiplier."""
        # Create a run
        create_response = await client.post("/runs", json={
            "server_seed": "filter_server",
            "client_seed": "filter_client",
            "start": 1,
            "end": 20,
            "difficulty": "easy",
            "targets": [1.0, 5.0]
        })
        run_id = create_response.json()["id"]

        # Get hits with minimum multiplier filter
        response = await client.get(f"/runs/{run_id}/hits?min_multiplier=2.0")
        assert response.status_code == 200

        data = response.json()
        # All returned hits should have multiplier >= 2.0
        for hit in data["rows"]:
            assert hit["max_multiplier"] >= 2.0

    async def test_get_hits_run_not_found(self, client: AsyncClient):
        """Test hits for non-existent run."""
        fake_uuid = "12345678-1234-1234-1234-123456789012"
        response = await client.get(f"/runs/{fake_uuid}/hits")
        assert response.status_code == 404


class TestDistancesFeature:
    """Tests for per-multiplier distances and row-level distance_prev."""

    async def _seed_run_with_hits(self, engine, *, hits: list[tuple[int, float]]):
        run_id = uuid4()
        async with AsyncSession(engine) as session:
            # Minimal run record sufficient for endpoints that only need existence
            run = Run(
                id=run_id,
                server_seed="seed",
                server_seed_sha256="deadbeef" * 8,
                client_seed="client",
                nonce_start=1,
                nonce_end=100000,
                difficulty="medium",
                targets_json="[]",
                duration_ms=0,
                engine_version="pump-1.0.0",
                summary_json="{}",
            )
            session.add(run)
            await session.commit()

            # Insert provided hits
            for nonce, mult in hits:
                session.add(Hit(run_id=run_id, nonce=nonce, max_multiplier=mult))
            await session.commit()

        return str(run_id)

    async def test_distances_json_and_csv(self, client: AsyncClient, test_db):
        """Validate /distances JSON payload and CSV stream."""
        # Seed hits: 2.33 at 10,12,20; 4.03 at 30
        run_id = await self._seed_run_with_hits(
            test_db, hits=[(10, 2.33), (12, 2.33), (20, 2.33), (30, 4.03)]
        )

        # JSON
        resp = await client.get(
            f"/runs/{run_id}/distances", params={"multiplier": 2.33}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["multiplier"] == 2.33
        assert data["count"] == 3
        assert data["nonces"] == [10, 12, 20]
        assert data["distances"] == [2, 8]
        stats = data["stats"]
        # Basic stats checks
        assert stats["mean"] == 5.0
        assert stats["median"] == 5.0
        assert stats["min"] == 2
        assert stats["max"] == 8
        assert stats["p90"] == 8
        assert stats["p99"] == 8
        assert abs(stats["stddev"] - 3.0) < 1e-9
        assert abs(stats["cv"] - 0.6) < 1e-9

        # CSV
        resp_csv = await client.get(
            f"/runs/{run_id}/distances.csv", params={"multiplier": 2.33}
        )
        assert resp_csv.status_code == 200
        assert resp_csv.headers["content-type"].startswith("text/csv")
        content = resp_csv.text.strip().split("\n")
        assert content[0] == "from_nonce,distance"
        assert content[1] == "10,2"
        assert content[2] == "12,8"

    async def test_hits_include_distance(self, client: AsyncClient, test_db):
        """Validate include_distance=per_multiplier in hits listing."""
        run_id = await self._seed_run_with_hits(
            test_db, hits=[(10, 2.33), (12, 2.33), (20, 2.33), (30, 4.03)]
        )

        resp = await client.get(
            f"/runs/{run_id}/hits",
            params={"include_distance": "per_multiplier", "limit": 100},
        )
        assert resp.status_code == 200
        page = resp.json()
        rows = page["rows"]
        rows_by_nonce = {r["nonce"]: r for r in rows}
        assert rows_by_nonce[10]["distance_prev"] is None
        assert rows_by_nonce[12]["distance_prev"] == 2
        assert rows_by_nonce[20]["distance_prev"] == 8
        assert rows_by_nonce[30]["distance_prev"] is None


class TestCSVExports:
    """Test CSV export endpoints."""

    async def test_export_hits_csv(self, client: AsyncClient):
        """Test hits CSV export."""
        # Create a run first
        create_response = await client.post("/runs", json={
            "server_seed": "csv_server",
            "client_seed": "csv_client",
            "start": 1,
            "end": 5,
            "difficulty": "easy",
            "targets": [1.0]
        })
        run_id = create_response.json()["id"]

        # Export hits CSV
        response = await client.get(f"/runs/{run_id}/export/hits.csv")
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"

        content = response.text
        lines = content.strip().split('\n')
        assert lines[0] == "nonce,max_multiplier"  # Header

        # Should have at least one data row
        if len(lines) > 1:
            # Check data row format
            parts = lines[1].split(',')
            assert len(parts) == 2
            assert parts[0].isdigit()  # nonce
            assert float(parts[1]) > 0  # multiplier

    async def test_export_full_csv(self, client: AsyncClient):
        """Test full CSV export."""
        # Create a run first
        create_response = await client.post("/runs", json={
            "server_seed": "full_csv_server",
            "client_seed": "full_csv_client",
            "start": 1,
            "end": 3,
            "difficulty": "easy",
            "targets": [1.0]
        })
        run_id = create_response.json()["id"]

        # Export full CSV
        response = await client.get(f"/runs/{run_id}/export/full.csv")
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"

        content = response.text
        lines = content.strip().split('\n')
        assert lines[0] == "nonce,max_pumps,max_multiplier,pop_point"  # Header

        # Should have exactly 3 data rows (nonces 1, 2, 3)
        assert len(lines) == 4  # Header + 3 data rows

        # Check data row format
        for i in range(1, 4):
            parts = lines[i].split(',')
            assert len(parts) == 4
            assert int(parts[0]) == i  # nonce
            assert int(parts[1]) >= 0  # max_pumps
            assert float(parts[2]) > 0  # max_multiplier
            assert 1 <= int(parts[3]) <= 25  # pop_point

    async def test_export_csv_run_not_found(self, client: AsyncClient):
        """Test CSV export for non-existent run."""
        fake_uuid = "12345678-1234-1234-1234-123456789012"

        response = await client.get(f"/runs/{fake_uuid}/export/hits.csv")
        assert response.status_code == 404

        response = await client.get(f"/runs/{fake_uuid}/export/full.csv")
        assert response.status_code == 404


class TestVerifyEndpoint:
    """Test verify endpoint."""

    async def test_verify_success(self, client: AsyncClient):
        """Test successful single nonce verification."""
        response = await client.get("/verify", params={
            "server_seed": "verify_server",
            "client_seed": "verify_client",
            "nonce": 1,
            "difficulty": "medium"
        })
        assert response.status_code == 200

        data = response.json()
        required_fields = {"max_pumps", "max_multiplier", "pop_point"}
        assert set(data.keys()) == required_fields

        assert isinstance(data["max_pumps"], int)
        assert isinstance(data["max_multiplier"], (int, float))
        assert isinstance(data["pop_point"], int)
        assert 0 <= data["max_pumps"] <= 22  # Medium max is 22 (25-3)
        assert 1 <= data["pop_point"] <= 25

    async def test_verify_validation_errors(self, client: AsyncClient):
        """Test verify endpoint validation."""
        # Missing server_seed
        response = await client.get("/verify", params={
            "client_seed": "test",
            "nonce": 1,
            "difficulty": "easy"
        })
        assert response.status_code == 422

        # Invalid nonce
        response = await client.get("/verify", params={
            "server_seed": "test",
            "client_seed": "test",
            "nonce": 0,
            "difficulty": "easy"
        })
        assert response.status_code == 422

    async def test_verify_golden_vector(self, client: AsyncClient):
        """Test verify endpoint with golden vector."""
        response = await client.get("/verify", params={
            "server_seed": "564e967b90f03d0153fdcb2d2d1cc5a5057e0df78163611fe3801d6498e681ca",
            "client_seed": "zXv1upuFns",
            "nonce": 5663,
            "difficulty": "expert"
        })
        assert response.status_code == 200

        data = response.json()
        # Should match golden vector expectation
        assert abs(data["max_multiplier"] - 11200.65) <= 1e-9


class TestDeterminism:
    """Test deterministic behavior across API calls."""

    async def test_identical_runs_produce_identical_results(self, client: AsyncClient):
        """Test that identical run parameters produce identical results."""
        run_params = {
            "server_seed": "determinism_server",
            "client_seed": "determinism_client",
            "start": 1,
            "end": 10,
            "difficulty": "medium",
            "targets": [1.0, 5.0, 10.0]
        }

        # Create first run
        response1 = await client.post("/runs", json=run_params)
        assert response1.status_code == 201
        data1 = response1.json()

        # Create second identical run
        response2 = await client.post("/runs", json=run_params)
        assert response2.status_code == 201
        data2 = response2.json()

        # Results should be identical (except IDs and timestamps)
        assert data1["summary"]["count"] == data2["summary"]["count"]
        assert data1["summary"]["max_multiplier"] == data2["summary"]["max_multiplier"]
        assert data1["summary"]["median_multiplier"] == data2["summary"]["median_multiplier"]
        assert data1["summary"]["counts_by_target"] == data2["summary"]["counts_by_target"]

        # Verify hits are identical
        hits1_response = await client.get(f"/runs/{data1['id']}/hits")
        hits2_response = await client.get(f"/runs/{data2['id']}/hits")

        hits1 = hits1_response.json()
        hits2 = hits2_response.json()

        assert hits1["total"] == hits2["total"]
        # Sort by nonce for comparison
        rows1 = sorted(hits1["rows"], key=lambda x: x["nonce"])
        rows2 = sorted(hits2["rows"], key=lambda x: x["nonce"])
        assert rows1 == rows2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
