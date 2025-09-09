from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlmodel import SQLModel, Field, Index
from sqlalchemy import ForeignKeyConstraint, CheckConstraint


class LiveStream(SQLModel, table=True):
    __tablename__ = "live_streams"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    server_seed_hashed: str = Field(nullable=False)
    client_seed: str = Field(nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    last_seen_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    notes: Optional[str] = Field(default=None, nullable=True)

    __table_args__ = (
        Index("idx_live_streams_seed_pair", "server_seed_hashed", "client_seed", unique=True),
        Index("idx_live_streams_last_seen", "last_seen_at"),
    )


class LiveBet(SQLModel, table=True):
    __tablename__ = "live_bets"

    id: Optional[int] = Field(default=None, primary_key=True)
    stream_id: UUID = Field(nullable=False)
    antebot_bet_id: str = Field(nullable=False)
    received_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    date_time: Optional[datetime] = Field(default=None, nullable=True)
    nonce: int = Field(nullable=False, ge=1)
    amount: float = Field(nullable=False, ge=0)
    payout_multiplier: float = Field(nullable=False)
    payout: float = Field(nullable=False, ge=0)
    difficulty: str = Field(nullable=False)
    round_target: Optional[float] = Field(default=None, nullable=True, gt=0)
    round_result: Optional[float] = Field(default=None, nullable=True, ge=0)

    __table_args__ = (
        Index("idx_live_bets_stream_id", "stream_id", "id"),
        Index("idx_live_bets_stream_nonce", "stream_id", "nonce"),
        Index("idx_live_bets_stream_mult", "stream_id", "payout_multiplier"),
        Index("idx_live_bets_unique_bet", "stream_id", "antebot_bet_id", unique=True),
        ForeignKeyConstraint(["stream_id"], ["live_streams.id"], ondelete="CASCADE"),
        CheckConstraint("nonce >= 1", name="ck_live_bets_nonce_ge_1"),
        CheckConstraint("amount >= 0", name="ck_live_bets_amount_ge_0"),
        CheckConstraint("payout >= 0", name="ck_live_bets_payout_ge_0"),
        CheckConstraint("difficulty IN ('easy', 'medium', 'hard', 'expert')", name="ck_live_bets_difficulty"),
        CheckConstraint("round_target IS NULL OR round_target > 0", name="ck_live_bets_round_target_gt_0"),
        CheckConstraint("round_result IS NULL OR round_result >= 0", name="ck_live_bets_round_result_ge_0"),
    )


class SeedAlias(SQLModel, table=True):
    __tablename__ = "seed_aliases"

    server_seed_hashed: str = Field(primary_key=True, nullable=False)
    server_seed_plain: str = Field(nullable=False)
    first_seen: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    last_seen: datetime = Field(default_factory=datetime.utcnow, nullable=False)