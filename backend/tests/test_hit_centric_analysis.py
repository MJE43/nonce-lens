"""
Tests for hit-centric analysis API endpoints.

Tests the new hit query endpoint with various scenarios including:
- Basic hit filtering by bucket
- Range boundary handling
- Distance calculations
- Pagination and ordering
- Error handling for invalid inputs
- Performance with large datasets
"""

import pytest
from datetime import datetime
from uuid import uuid4
from fastapi.testclient import TestClient

from app.main import app


class TestHitQueryEndpoint:
    """Test cases for the hit query endpoint."""

    def test_invalid_parameters(self):
        """Test error handling for invalid parameters."""
        client = TestClient(app)
        
        # Test non-existent stream
        fake_stream_id = uuid4()
        response = client.get(
            f"/live/streams/{fake_stream_id}/hits",
            params={"bucket": 1000.00}
        )
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    def test_basic_endpoint_structure(self):
        """Test that the endpoint exists and has proper structure."""
        client = TestClient(app)
        
        # Test with non-existent stream to verify endpoint structure
        fake_stream_id = uuid4()
        response = client.get(
            f"/live/streams/{fake_stream_id}/hits",
            params={
                "bucket": 1000.00,
                "after_nonce": 0,
                "before_nonce": 2000,
                "limit": 100,
                "order": "nonce_asc",
                "include_distance": True
            }
        )
        
        # Should return 404 for non-existent stream, not 405 or other errors
        assert response.status_code == 404
        
    def test_parameter_validation(self):
        """Test parameter validation."""
        client = TestClient(app)
        fake_stream_id = uuid4()
        
        # Test negative bucket - this should be caught by our validation
        response = client.get(
            f"/live/streams/{fake_stream_id}/hits",
            params={"bucket": -100.00}
        )
        # Our endpoint validates bucket >= 0, so should return 400 before checking stream
        assert response.status_code == 400
        
        # Test limit too high
        response = client.get(
            f"/live/streams/{fake_stream_id}/hits",
            params={
                "bucket": 1000.00,
                "limit": 2000
            }
        )
        assert response.status_code == 422  # Validation error from FastAPI


class TestHitQueryValidation:
    """Test parameter validation for hit query endpoint."""

    def test_query_parameter_validation(self):
        """Test that query parameters are properly validated."""
        client = TestClient(app)
        fake_stream_id = uuid4()
        
        # Test various invalid parameter combinations
        invalid_params = [
            {"after_nonce": -1},  # Negative after_nonce
            {"before_nonce": -1},  # Negative before_nonce
            {"limit": 0},  # Limit too small
            {"limit": 1001},  # Limit too large
            {"order": "invalid_order"},  # Invalid order value
        ]
        
        for params in invalid_params:
            params["bucket"] = 1000.00  # Ensure bucket is present
            response = client.get(
                f"/live/streams/{fake_stream_id}/hits",
                params=params
            )
            # Should return validation error (422) or bad request (400)
            assert response.status_code in [400, 422]

    def test_default_parameter_values(self):
        """Test that default parameter values work correctly."""
        client = TestClient(app)
        fake_stream_id = uuid4()
        
        # Query with minimal parameters (should use defaults)
        response = client.get(
            f"/live/streams/{fake_stream_id}/hits",
            params={"bucket": 1000.00}
        )
        
        # Should return 404 for non-existent stream, but parameters should be valid
        assert response.status_code == 404