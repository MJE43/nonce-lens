from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


Difficulty = str  # "easy" | "medium" | "hard" | "expert" (validated at API layer)


class RunCreate(BaseModel):
    server_seed: str
    client_seed: str
    start: int = Field(ge=1)
    end: int
    difficulty: Difficulty
    targets: List[float]


class RunRead(BaseModel):
    id: UUID
    created_at: datetime
    server_seed_sha256: str
    client_seed: str
    difficulty: Difficulty
    nonce_start: int
    nonce_end: int
    duration_ms: int
    engine_version: str
    targets: List[float]
    counts_by_target: dict[str, int]


class RunDetail(BaseModel):
    id: UUID
    created_at: datetime
    server_seed_sha256: str
    server_seed: str
    client_seed: str
    difficulty: Difficulty
    nonce_start: int
    nonce_end: int
    duration_ms: int
    engine_version: str
    targets: List[float]
    summary: dict


class HitRow(BaseModel):
    nonce: int
    max_multiplier: float


class HitsPage(BaseModel):
    total: int
    rows: List[HitRow]


class RunListResponse(BaseModel):
    runs: List[RunRead]
    total: int
