from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class IngestBetRequest(BaseModel):
    """Request model for ingesting bet data from Antebot with flattened payload structure."""
    
    id: str = Field(..., description="Antebot bet ID")
    dateTime: Optional[str] = Field(None, description="ISO datetime string, nullable")
    nonce: int = Field(..., ge=1, description="Bet nonce, must be >= 1")
    amount: float = Field(..., ge=0, description="Bet amount, must be >= 0")
    payoutMultiplier: float = Field(..., description="Payout multiplier")
    payout: float = Field(..., ge=0, description="Payout amount, must be >= 0")
    difficulty: str = Field(..., description="Difficulty level")
    roundTarget: Optional[float] = Field(None, gt=0, description="Round target, must be > 0 if provided")
    roundResult: Optional[float] = Field(None, ge=0, description="Round result, must be >= 0 if provided")
    clientSeed: str = Field(..., description="Client seed")
    serverSeedHashed: str = Field(..., description="Hashed server seed")

    @field_validator('difficulty')
    @classmethod
    def validate_difficulty(cls, v):
        """Validate difficulty is one of the allowed values."""
        allowed_difficulties = {'easy', 'medium', 'hard', 'expert'}
        if v not in allowed_difficulties:
            raise ValueError(f'difficulty must be one of: {", ".join(allowed_difficulties)}')
        return v


class IngestResponse(BaseModel):
    """Response model for bet ingestion."""
    
    streamId: UUID = Field(..., description="Stream ID where bet was processed")
    accepted: bool = Field(..., description="Whether the bet was accepted (false for duplicates)")


class BetRecord(BaseModel):
    """Individual bet record for display in UI."""
    
    id: int = Field(..., description="Database ID for pagination")
    antebot_bet_id: str = Field(..., description="Original Antebot bet ID")
    received_at: datetime = Field(..., description="When bet was received by our system")
    date_time: Optional[datetime] = Field(None, description="Original bet datetime from Antebot")
    nonce: int = Field(..., description="Bet nonce")
    amount: float = Field(..., description="Bet amount")
    payout_multiplier: float = Field(..., description="Payout multiplier")
    payout: float = Field(..., description="Payout amount")
    difficulty: str = Field(..., description="Difficulty level")
    round_target: Optional[float] = Field(None, description="Round target")
    round_result: Optional[float] = Field(None, description="Round result")


class StreamSummary(BaseModel):
    """Stream metadata for list view."""
    
    id: UUID = Field(..., description="Stream ID")
    server_seed_hashed: str = Field(..., description="Hashed server seed")
    client_seed: str = Field(..., description="Client seed")
    created_at: datetime = Field(..., description="Stream creation timestamp")
    last_seen_at: datetime = Field(..., description="Last activity timestamp")
    total_bets: int = Field(..., description="Total number of bets in stream")
    highest_multiplier: Optional[float] = Field(None, description="Highest multiplier achieved")
    notes: Optional[str] = Field(None, description="User notes")


class StreamDetail(BaseModel):
    """Comprehensive stream information for detail view."""
    
    id: UUID = Field(..., description="Stream ID")
    server_seed_hashed: str = Field(..., description="Hashed server seed")
    client_seed: str = Field(..., description="Client seed")
    created_at: datetime = Field(..., description="Stream creation timestamp")
    last_seen_at: datetime = Field(..., description="Last activity timestamp")
    total_bets: int = Field(..., description="Total number of bets in stream")
    highest_multiplier: Optional[float] = Field(None, description="Highest multiplier achieved")
    lowest_multiplier: Optional[float] = Field(None, description="Lowest multiplier achieved")
    average_multiplier: Optional[float] = Field(None, description="Average multiplier")
    notes: Optional[str] = Field(None, description="User notes")
    recent_bets: List[BetRecord] = Field(default_factory=list, description="Recent bet records")


class TailResponse(BaseModel):
    """Response model for incremental updates via tail endpoint."""
    
    bets: List[BetRecord] = Field(..., description="New bet records since last poll")
    last_id: Optional[int] = Field(None, description="Highest ID in this response for next poll")
    has_more: bool = Field(..., description="Whether more records are available")


class StreamListResponse(BaseModel):
    """Response model for streams listing endpoint."""
    
    streams: List[StreamSummary] = Field(..., description="List of stream summaries")
    total: int = Field(..., description="Total number of streams")
    limit: int = Field(..., description="Applied limit")
    offset: int = Field(..., description="Applied offset")


class BetListResponse(BaseModel):
    """Response model for paginated bet listing."""
    
    bets: List[BetRecord] = Field(..., description="List of bet records")
    total: int = Field(..., description="Total number of bets matching criteria")
    limit: int = Field(..., description="Applied limit")
    offset: int = Field(..., description="Applied offset")
    stream_id: UUID = Field(..., description="Stream ID these bets belong to")


class StreamUpdateRequest(BaseModel):
    """Request model for updating stream metadata."""
    
    notes: Optional[str] = Field(None, description="User notes for the stream")


class StreamStatsResponse(BaseModel):
    """Response model for stream statistics."""
    
    total_bets: int = Field(..., description="Total number of bets")
    highest_multiplier: Optional[float] = Field(None, description="Highest multiplier")
    lowest_multiplier: Optional[float] = Field(None, description="Lowest multiplier")
    average_multiplier: Optional[float] = Field(None, description="Average multiplier")
    total_amount: float = Field(..., description="Total amount wagered")
    total_payout: float = Field(..., description="Total payout amount")
    difficulty_breakdown: dict[str, int] = Field(default_factory=dict, description="Count by difficulty")


class StreamDeleteResponse(BaseModel):
    """Response model for stream deletion."""
    
    deleted: bool = Field(..., description="Whether the stream was successfully deleted")
    stream_id: UUID = Field(..., description="ID of the deleted stream")
    bets_deleted: int = Field(..., description="Number of bets that were deleted with the stream")