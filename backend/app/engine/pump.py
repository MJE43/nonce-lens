"""
Pump Analysis Engine - Deterministic Stake Pump Outcome Replay

This module implements the core algorithm for deterministically replaying
Stake Pump game outcomes using provably-fair cryptographic verification.

CRITICAL: This implementation must exactly match Stake's verifier logic.
The golden test vector MUST pass for correctness validation.
"""

import hashlib
import hmac
import json
import time
from typing import Dict, List, Tuple, Any

# Engine version for traceability
ENGINE_VERSION = "pump-1.0.0"

# Absolute tolerance for floating-point target matching
ATOL = 1e-9

# Difficulty to M (number of POP tokens) mapping
M_VALUES = {"easy": 1, "medium": 3, "hard": 5, "expert": 10}

# Multiplier tables - CRITICAL: lengths must equal (25 - M + 1)
EASY_TABLE = [
    1.00,
    1.02,
    1.06,
    1.11,
    1.17,
    1.23,
    1.29,
    1.36,
    1.44,
    1.53,
    1.62,
    1.75,
    1.88,
    2.00,
    2.23,
    2.43,
    2.72,
    3.05,
    3.50,
    4.08,
    5.00,
    6.25,
    8.00,
    12.25,
    24.50,
]

MEDIUM_TABLE = [
    1.00,
    1.11,
    1.27,
    1.46,
    1.69,
    1.98,
    2.33,
    2.76,
    3.31,
    4.03,
    4.95,
    6.19,
    7.87,
    10.25,
    13.66,
    18.78,
    26.83,
    38.76,
    64.40,
    112.70,
    225.40,
    563.50,
    2254.00,
]

HARD_TABLE = [
    1.00,
    1.23,
    1.55,
    1.98,
    2.56,
    3.36,
    4.48,
    6.08,
    8.41,
    11.92,
    17.00,
    26.01,
    40.49,
    65.74,
    112.70,
    206.62,
    413.23,
    929.77,
    2479.40,
    8677.90,
    52067.40,
]

EXPERT_TABLE = [
    1.00,
    1.63,
    2.80,
    4.95,
    9.08,
    17.34,
    34.68,
    73.21,
    164.72,
    400.02,
    1066.73,
    3200.18,
    11200.65,
    48536.13,
    291216.80,
    3203384.80,
]

MULTIPLIER_TABLES = {
    "easy": EASY_TABLE,
    "medium": MEDIUM_TABLE,
    "hard": HARD_TABLE,
    "expert": EXPERT_TABLE,
}

# Validate table lengths at import time
for difficulty, M in M_VALUES.items():
    expected_length = 25 - M + 1
    actual_length = len(MULTIPLIER_TABLES[difficulty])
    if actual_length != expected_length:
        raise ValueError(
            f"Multiplier table {difficulty}: expected {expected_length} values, got {actual_length}"
        )


def generate_floats_for_nonce(
    server_seed: str, client_seed: str, nonce: int
) -> List[float]:
    """
    Generate float sequence for a given nonce using HMAC-SHA256.

    CRITICAL:
    - Key is server seed as ASCII string (NOT hex-decoded)
    - Message format: "{client_seed}:{nonce}:{round}"
    - Float generation: u = b0/256 + b1/256^2 + b2/256^3 + b3/256^4

    Args:
        server_seed: Server seed as displayed by Stake (hex string)
        client_seed: Client seed string
        nonce: Nonce value (1-based)

    Returns:
        List of floats in range [0, 1) for selection shuffle
    """
    # CRITICAL: Use server seed as ASCII bytes, do NOT hex-decode
    key = server_seed.encode("utf-8")

    floats = []
    round_num = 0

    # Generate floats until we have at least 25 for selection shuffle
    while len(floats) < 25:
        # CRITICAL: Message format with colon separators
        message = f"{client_seed}:{nonce}:{round_num}"
        digest = hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()

        # Process digest in 4-byte chunks
        for i in range(0, len(digest), 4):
            if i + 4 <= len(digest) and len(floats) < 25:
                b0, b1, b2, b3 = digest[i : i + 4]
                # CRITICAL: Exact rational arithmetic for determinism
                u = b0 / 256 + b1 / 256**2 + b2 / 256**3 + b3 / 256**4
                floats.append(u)

        round_num += 1

        # Safety break to avoid infinite loops
        if round_num > 10:
            raise RuntimeError(
                f"Failed to generate 25 floats after 10 rounds for nonce {nonce}"
            )

    return floats


def selection_shuffle(floats: List[float]) -> List[int]:
    """
    Perform selection shuffle to generate permutation of positions 1-25.

    CRITICAL: This must exactly match Stake's algorithm:
    - Start with pool [1, 2, 3, ..., 25]
    - For each float u: j = floor(u * len(pool))
    - Pick pool[j], remove from pool, append to permutation

    Args:
        floats: Sequence of floats in range [0, 1)

    Returns:
        Permutation of positions 1-25
    """
    pool = list(range(1, 26))  # [1, 2, 3, ..., 25]
    permutation = []

    for u in floats:
        if len(permutation) == 25:
            break

        # CRITICAL: Floor operation for index selection
        j = int(u * len(pool))  # floor(u * len(pool))

        # Bounds check (should not be needed with proper float generation)
        if j >= len(pool):
            j = len(pool) - 1

        pick = pool.pop(j)
        permutation.append(pick)

    if len(permutation) != 25:
        raise RuntimeError(
            f"Selection shuffle produced {len(permutation)} positions, expected 25"
        )

    return permutation


def calculate_pump_result(
    permutation: List[int], difficulty: str
) -> Tuple[int, float, int]:
    """
    Calculate pump result from permutation and difficulty.

    Args:
        permutation: Permutation of positions 1-25
        difficulty: Game difficulty ("easy" | "medium" | "hard" | "expert")

    Returns:
        Tuple of (max_pumps, max_multiplier, pop_point)
    """
    if difficulty not in M_VALUES:
        raise ValueError(f"Invalid difficulty: {difficulty}")

    M = M_VALUES[difficulty]

    # Pop set = first M positions in permutation
    pops = permutation[:M]

    # Pop point = minimum of pop set (1-based)
    pop_point = min(pops)

    # Safe pumps = min(pop_point - 1, 25 - M)
    safe_pumps = min(pop_point - 1, 25 - M)

    # Get multiplier from table
    multiplier = MULTIPLIER_TABLES[difficulty][safe_pumps]

    return safe_pumps, multiplier, pop_point


def verify_pump(
    server_seed: str, client_seed: str, nonce: int, difficulty: str
) -> Dict[str, Any]:
    """
    Verify a single nonce for Pump game.

    Args:
        server_seed: Server seed as displayed by Stake
        client_seed: Client seed string
        nonce: Nonce value (1-based)
        difficulty: Game difficulty

    Returns:
        Dict with max_pumps, max_multiplier, pop_point
    """
    floats = generate_floats_for_nonce(server_seed, client_seed, nonce)
    permutation = selection_shuffle(floats)
    max_pumps, max_multiplier, pop_point = calculate_pump_result(
        permutation, difficulty
    )

    return {
        "max_pumps": max_pumps,
        "max_multiplier": max_multiplier,
        "pop_point": pop_point,
    }


def scan_pump(
    server_seed: str,
    client_seed: str,
    start: int,
    end: int,
    difficulty: str,
    targets: List[float],
) -> Tuple[Dict[float, List[int]], Dict[str, Any]]:
    """
    Scan a range of nonces for Pump analysis.

    Args:
        server_seed: Server seed as displayed by Stake
        client_seed: Client seed string
        start: Starting nonce (inclusive, 1-based)
        end: Ending nonce (inclusive)
        difficulty: Game difficulty
        targets: List of target multipliers to track

    Returns:
        Tuple of (hits_by_target, summary) where:
        - hits_by_target: Dict mapping target -> list of nonces that hit it
        - summary: Dict with analysis statistics
    """
    start_time = time.time()

    # Validate inputs
    if start < 1:
        raise ValueError("Start nonce must be >= 1")
    if end < start:
        raise ValueError("End nonce must be >= start nonce")
    if difficulty not in M_VALUES:
        raise ValueError(f"Invalid difficulty: {difficulty}")
    if not targets:
        raise ValueError("Must provide at least one target")

    # Remove duplicates and sort targets for consistency
    unique_targets = sorted(set(targets))

    # Initialize tracking
    hits_by_target = {target: [] for target in unique_targets}
    all_multipliers = []
    max_multiplier = 0.0

    # Scan nonce range
    for nonce in range(start, end + 1):
        result = verify_pump(server_seed, client_seed, nonce, difficulty)
        multiplier = result["max_multiplier"]

        all_multipliers.append(multiplier)
        max_multiplier = max(max_multiplier, multiplier)

        # Check for target hits (with tolerance)
        for target in unique_targets:
            if abs(multiplier - target) <= ATOL:
                hits_by_target[target].append(nonce)

    # Calculate summary statistics
    duration_ms = int((time.time() - start_time) * 1000)
    count = end - start + 1

    # Calculate median
    sorted_multipliers = sorted(all_multipliers)
    if count % 2 == 0:
        median_multiplier = (
            sorted_multipliers[count // 2 - 1] + sorted_multipliers[count // 2]
        ) / 2
    else:
        median_multiplier = sorted_multipliers[count // 2]

    # Count hits by target
    counts_by_target = {
        str(target): len(nonces) for target, nonces in hits_by_target.items()
    }

    # Find top hits for summary
    top_max = []
    for nonce, multiplier in enumerate(all_multipliers, start=start):
        if multiplier == max_multiplier:
            top_max.append({"nonce": nonce, "max_multiplier": multiplier})
            if len(top_max) >= 5:  # Limit to top 5 for summary
                break

    summary = {
        "count": count,
        "duration_ms": duration_ms,
        "difficulty": difficulty,
        "start": start,
        "end": end,
        "targets": unique_targets,
        "max_multiplier": max_multiplier,
        "median_multiplier": median_multiplier,
        "counts_by_target": counts_by_target,
        "top_max": top_max,
    }

    return hits_by_target, summary
