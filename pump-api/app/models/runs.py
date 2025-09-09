from __future__ import annotations

import json
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlmodel import SQLModel, Field, Index
from sqlalchemy import ForeignKeyConstraint, CheckConstraint


class Run(SQLModel, table=True):
    __tablename__ = "runs"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    server_seed: str = Field(nullable=False)
    server_seed_sha256: str = Field(nullable=False)
    client_seed: str = Field(nullable=False)
    nonce_start: int = Field(nullable=False, ge=1)
    nonce_end: int = Field(nullable=False)
    difficulty: str = Field(nullable=False)
    targets_json: str = Field(nullable=False)
    duration_ms: int = Field(nullable=False)
    engine_version: str = Field(nullable=False)
    summary_json: str = Field(nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("nonce_start >= 1", name="ck_runs_nonce_start_ge_1"),
        CheckConstraint("nonce_end >= nonce_start", name="ck_runs_nonce_range"),
    )

    # Basic validators via SQLModel Field constraints are covered; higher-level
    # validation is performed at API layer.


class Hit(SQLModel, table=True):
    __tablename__ = "hits"

    id: Optional[int] = Field(default=None, primary_key=True)
    run_id: UUID = Field(nullable=False)
    nonce: int = Field(nullable=False)
    max_multiplier: float = Field(nullable=False)

    __table_args__ = (
        Index("ix_hits_run_nonce", "run_id", "nonce"),
        Index("idx_hits_run_mult_nonce", "run_id", "max_multiplier", "nonce"),
        ForeignKeyConstraint(["run_id"], ["runs.id"], ondelete="CASCADE"),
    )
