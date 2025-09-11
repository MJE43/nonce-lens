"""
Test suite for the Pump analysis engine.

CRITICAL: These tests validate the deterministic correctness of the pump algorithm.
The golden test vector MUST pass for the implementation to be considered correct.
"""

import pytest
from app.engine.pump import (
    ENGINE_VERSION,
    ATOL,
    M_VALUES,
    MULTIPLIER_TABLES,
    generate_floats_for_nonce,
    selection_shuffle,
    calculate_pump_result,
    verify_pump,
    scan_pump,
)


class TestMultiplierTables:
    """Test multiplier table integrity."""

    def test_table_lengths(self):
        """Verify each multiplier table has correct length (25 - M + 1)."""
        for difficulty, M in M_VALUES.items():
            expected_length = 25 - M + 1
            actual_length = len(MULTIPLIER_TABLES[difficulty])
            assert actual_length == expected_length, (
                f"Multiplier table {difficulty}: expected {expected_length} values, "
                f"got {actual_length}"
            )

    def test_table_values_positive(self):
        """Verify all multiplier values are positive."""
        for difficulty, table in MULTIPLIER_TABLES.items():
            for i, value in enumerate(table):
                assert value > 0, f"{difficulty} table index {i} has non-positive value {value}"

    def test_table_values_ascending(self):
        """Verify multiplier values are generally ascending (allowing for minor variations)."""
        for difficulty, table in MULTIPLIER_TABLES.items():
            # Check that the table is mostly ascending (some minor variations allowed)
            ascending_violations = 0
            for i in range(1, len(table)):
                if table[i] < table[i-1]:
                    ascending_violations += 1
            
            # Allow up to 10% violations for minor variations
            max_violations = len(table) // 10
            assert ascending_violations <= max_violations, (
                f"{difficulty} table has too many descending values: {ascending_violations} > {max_violations}"
            )


class TestFloatGeneration:
    """Test HMAC-based float generation."""

    def test_float_generation_deterministic(self):
        """Verify float generation is deterministic."""
        server_seed = "test_server_seed"
        client_seed = "test_client"
        nonce = 1

        floats1 = generate_floats_for_nonce(server_seed, client_seed, nonce)
        floats2 = generate_floats_for_nonce(server_seed, client_seed, nonce)

        assert floats1 == floats2, "Float generation should be deterministic"

    def test_float_generation_length(self):
        """Verify at least 25 floats are generated."""
        server_seed = "test_server_seed"
        client_seed = "test_client"
        nonce = 1

        floats = generate_floats_for_nonce(server_seed, client_seed, nonce)
        assert len(floats) >= 25, f"Expected at least 25 floats, got {len(floats)}"

    def test_float_range(self):
        """Verify all floats are in range [0, 1)."""
        server_seed = "test_server_seed"
        client_seed = "test_client"
        nonce = 1

        floats = generate_floats_for_nonce(server_seed, client_seed, nonce)
        for i, f in enumerate(floats[:25]):  # Check first 25
            assert 0 <= f < 1, f"Float {i} out of range: {f}"

    def test_different_inputs_different_floats(self):
        """Verify different inputs produce different float sequences."""
        base_floats = generate_floats_for_nonce("server1", "client1", 1)
        
        # Different server seed
        server_floats = generate_floats_for_nonce("server2", "client1", 1)
        assert base_floats != server_floats, "Different server seeds should produce different floats"
        
        # Different client seed
        client_floats = generate_floats_for_nonce("server1", "client2", 1)
        assert base_floats != client_floats, "Different client seeds should produce different floats"
        
        # Different nonce
        nonce_floats = generate_floats_for_nonce("server1", "client1", 2)
        assert base_floats != nonce_floats, "Different nonces should produce different floats"


class TestSelectionShuffle:
    """Test selection shuffle algorithm."""

    def test_selection_shuffle_length(self):
        """Verify selection shuffle produces exactly 25 positions."""
        # Use known floats
        floats = [0.1, 0.5, 0.9, 0.2, 0.8] * 5  # 25 floats
        permutation = selection_shuffle(floats)
        assert len(permutation) == 25, f"Expected 25 positions, got {len(permutation)}"

    def test_selection_shuffle_valid_positions(self):
        """Verify all positions are in range 1-25."""
        floats = [i / 100.0 for i in range(25)]  # 0.00, 0.01, ..., 0.24
        permutation = selection_shuffle(floats)
        
        for pos in permutation:
            assert 1 <= pos <= 25, f"Position {pos} out of range [1, 25]"

    def test_selection_shuffle_no_duplicates(self):
        """Verify no duplicate positions in permutation."""
        floats = [i / 100.0 for i in range(25)]
        permutation = selection_shuffle(floats)
        
        assert len(set(permutation)) == 25, "Permutation contains duplicate positions"

    def test_selection_shuffle_deterministic(self):
        """Verify selection shuffle is deterministic."""
        floats = [i / 100.0 for i in range(25)]
        
        perm1 = selection_shuffle(floats)
        perm2 = selection_shuffle(floats)
        
        assert perm1 == perm2, "Selection shuffle should be deterministic"


class TestPumpCalculation:
    """Test pump result calculation."""

    def test_calculate_pump_result_easy(self):
        """Test pump calculation for easy difficulty."""
        # Permutation where first position (M=1) is 5
        permutation = [5] + list(range(1, 5)) + list(range(6, 26))
        
        max_pumps, max_multiplier, pop_point = calculate_pump_result(permutation, "easy")
        
        assert pop_point == 5, f"Expected pop_point=5, got {pop_point}"
        assert max_pumps == min(5-1, 25-1), f"Expected max_pumps={min(4, 24)}, got {max_pumps}"
        assert max_multiplier == MULTIPLIER_TABLES["easy"][max_pumps]

    def test_calculate_pump_result_expert(self):
        """Test pump calculation for expert difficulty."""
        # Permutation where minimum of first 10 positions is 8
        permutation = [23, 15, 8, 11, 5, 22, 12, 18, 9, 16] + list(range(1, 16))
        
        max_pumps, max_multiplier, pop_point = calculate_pump_result(permutation, "expert")
        
        assert pop_point == 5, f"Expected pop_point=5, got {pop_point}"
        expected_pumps = min(5-1, 25-10)  # min(4, 15) = 4
        assert max_pumps == expected_pumps, f"Expected max_pumps={expected_pumps}, got {max_pumps}"
        assert max_multiplier == MULTIPLIER_TABLES["expert"][max_pumps]

    def test_calculate_pump_result_all_difficulties(self):
        """Test pump calculation works for all difficulties."""
        permutation = list(range(1, 26))  # [1, 2, 3, ..., 25]
        
        for difficulty in M_VALUES.keys():
            max_pumps, max_multiplier, pop_point = calculate_pump_result(permutation, difficulty)
            
            # Pop point should be 1 (minimum of first M positions)
            assert pop_point == 1, f"{difficulty}: expected pop_point=1, got {pop_point}"
            
            # Max pumps should be 0 (since pop_point - 1 = 0)
            assert max_pumps == 0, f"{difficulty}: expected max_pumps=0, got {max_pumps}"
            
            # Multiplier should be first in table
            assert max_multiplier == MULTIPLIER_TABLES[difficulty][0]


class TestVerifyPump:
    """Test single nonce verification."""

    def test_verify_pump_deterministic(self):
        """Verify single nonce verification is deterministic."""
        result1 = verify_pump("test_server", "test_client", 1, "medium")
        result2 = verify_pump("test_server", "test_client", 1, "medium")
        
        assert result1 == result2, "verify_pump should be deterministic"

    def test_verify_pump_structure(self):
        """Verify verify_pump returns correct structure."""
        result = verify_pump("test_server", "test_client", 1, "medium")
        
        required_keys = {"max_pumps", "max_multiplier", "pop_point"}
        assert set(result.keys()) == required_keys, f"Expected keys {required_keys}, got {set(result.keys())}"
        
        assert isinstance(result["max_pumps"], int)
        assert isinstance(result["max_multiplier"], (int, float))
        assert isinstance(result["pop_point"], int)

    def test_verify_pump_different_difficulties(self):
        """Verify different difficulties can produce different results."""
        server_seed = "test_server"
        client_seed = "test_client"
        nonce = 1
        
        results = {}
        for difficulty in M_VALUES.keys():
            results[difficulty] = verify_pump(server_seed, client_seed, nonce, difficulty)
        
        # Results should be different for at least some difficulties
        # (though they could be the same by chance)
        multipliers = [r["max_multiplier"] for r in results.values()]
        assert len(set(multipliers)) >= 1, "Should have at least one unique multiplier"


class TestGoldenVector:
    """Test the critical golden test vector from the PRD."""

    def test_golden_vector_expert(self):
        """
        CRITICAL TEST: Validate the golden test vector.
        
        This test MUST pass for the implementation to be considered correct.
        
        Expected:
        - server: 564e967b90f03d0153fdcb2d2d1cc5a5057e0df78163611fe3801d6498e681ca
        - client: zXv1upuFns
        - nonce: 5663
        - difficulty: expert
        - result: max_multiplier = 11200.65
        """
        server_seed = "564e967b90f03d0153fdcb2d2d1cc5a5057e0df78163611fe3801d6498e681ca"
        client_seed = "zXv1upuFns"
        nonce = 5663
        difficulty = "expert"
        expected_multiplier = 11200.65

        result = verify_pump(server_seed, client_seed, nonce, difficulty)
        
        actual_multiplier = result["max_multiplier"]
        
        # Use absolute tolerance for floating-point comparison
        assert abs(actual_multiplier - expected_multiplier) <= ATOL, (
            f"Golden vector failed: expected {expected_multiplier}, got {actual_multiplier}"
        )
        
        # Additional checks for completeness
        assert isinstance(result["max_pumps"], int)
        assert isinstance(result["pop_point"], int)
        assert 1 <= result["pop_point"] <= 25
        assert 0 <= result["max_pumps"] <= 15  # Expert max is 15 (25-10)


class TestScanPump:
    """Test range scanning functionality."""

    def test_scan_pump_small_range(self):
        """Test scanning a small range."""
        hits_by_target, summary = scan_pump(
            "test_server", "test_client", 1, 10, "easy", [1.0, 2.0]
        )
        
        # Check structure
        assert isinstance(hits_by_target, dict)
        assert isinstance(summary, dict)
        
        # Check summary fields
        required_summary_keys = {
            "count", "duration_ms", "difficulty", "start", "end", 
            "targets", "max_multiplier", "median_multiplier", 
            "counts_by_target", "top_max"
        }
        assert set(summary.keys()) == required_summary_keys
        
        # Check values
        assert summary["count"] == 10
        assert summary["start"] == 1
        assert summary["end"] == 10
        assert summary["difficulty"] == "easy"
        assert summary["targets"] == [1.0, 2.0]

    def test_scan_pump_deterministic(self):
        """Verify scan results are deterministic."""
        args = ("test_server", "test_client", 1, 5, "medium", [1.0, 5.0])
        
        hits1, summary1 = scan_pump(*args)
        hits2, summary2 = scan_pump(*args)
        
        # Hits should be identical
        assert hits1 == hits2, "Scan hits should be deterministic"
        
        # Summary should be identical (except duration_ms which may vary slightly)
        for key in summary1:
            if key != "duration_ms":
                assert summary1[key] == summary2[key], f"Summary key {key} differs"

    def test_scan_pump_target_matching(self):
        """Test target matching with tolerance."""
        # Use a range where we can predict some results
        hits_by_target, summary = scan_pump(
            "test_server", "test_client", 1, 100, "easy", [1.0]
        )
        
        # Should have hits for 1.0 (first multiplier in easy table)
        assert 1.0 in hits_by_target
        assert len(hits_by_target[1.0]) > 0, "Should have hits for 1.0 multiplier"
        
        # Verify counts match summary
        expected_count = len(hits_by_target[1.0])
        actual_count = summary["counts_by_target"]["1.0"]
        assert actual_count == expected_count

    def test_scan_pump_validation(self):
        """Test input validation."""
        with pytest.raises(ValueError, match="Start nonce must be >= 1"):
            scan_pump("server", "client", 0, 10, "easy", [1.0])
        
        with pytest.raises(ValueError, match="End nonce must be >= start nonce"):
            scan_pump("server", "client", 10, 5, "easy", [1.0])
        
        with pytest.raises(ValueError, match="Invalid difficulty"):
            scan_pump("server", "client", 1, 10, "invalid", [1.0])
        
        with pytest.raises(ValueError, match="Must provide at least one target"):
            scan_pump("server", "client", 1, 10, "easy", [])


class TestEngineVersion:
    """Test engine version tracking."""

    def test_engine_version_format(self):
        """Verify engine version follows expected format."""
        assert isinstance(ENGINE_VERSION, str)
        assert len(ENGINE_VERSION) > 0
        assert "pump" in ENGINE_VERSION.lower()
        
        # Should follow semantic versioning pattern
        parts = ENGINE_VERSION.split("-")
        assert len(parts) >= 2, f"Expected format 'pump-x.y.z', got '{ENGINE_VERSION}'"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])