from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Literal
from uuid import UUID

import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlmodel import select, func

from ..core.config import get_settings
from ..core.rate_limiter import rate_limit_dependency
from ..db import get_session
from ..models.live_streams import LiveStream, LiveBet
from ..schemas.live_streams import (
    IngestBetRequest, 
    IngestResponse,
    StreamListResponse,
    StreamSummary,
    StreamDetail,
    BetListResponse,
    BetRecord,
    TailResponse,
    StreamUpdateRequest,
    StreamDeleteResponse
)


router = APIRouter(prefix="/live", tags=["live-streams"])


def verify_ingest_token(
    x_ingest_token: Optional[str] = Header(None, alias="X-Ingest-Token")
) -> None:
    """Verify the ingest token if configured."""
    settings = get_settings()
    
    # If no token is configured, allow all requests
    if settings.ingest_token is None:
        return
    
    # If token is configured but not provided, reject
    if x_ingest_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Ingest-Token header is required"
        )
    
    # If token doesn't match, reject
    if x_ingest_token != settings.ingest_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid ingest token"
        )


def get_rate_limit_dependency():
    """Get rate limit dependency with current settings."""
    settings = get_settings()
    return rate_limit_dependency(settings.ingest_rate_limit)


@router.post("/ingest", response_model=IngestResponse)
async def ingest_bet(
    bet_data: IngestBetRequest,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(verify_ingest_token),
    __: None = Depends(get_rate_limit_dependency())
) -> IngestResponse:
    """
    Ingest bet data from Antebot with automatic stream management.
    
    Creates new streams for new seed pairs and handles duplicate bets idempotently.
    """
    try:
        # Parse datetime with UTC conversion and null fallback
        parsed_datetime = None
        if bet_data.dateTime:
            try:
                # Parse ISO datetime string and ensure UTC
                if bet_data.dateTime.endswith('Z'):
                    # Replace Z with +00:00 for proper ISO parsing
                    datetime_str = bet_data.dateTime.replace('Z', '+00:00')
                else:
                    datetime_str = bet_data.dateTime
                
                parsed_datetime = datetime.fromisoformat(datetime_str)
                
                if parsed_datetime.tzinfo is None:
                    # Assume UTC if no timezone info
                    parsed_datetime = parsed_datetime.replace(tzinfo=timezone.utc)
                
                # Convert to UTC and remove timezone info for storage
                parsed_datetime = parsed_datetime.astimezone(timezone.utc).replace(tzinfo=None)
            except (ValueError, TypeError):
                # On parsing failure, set to null and continue
                parsed_datetime = None
        
        # Find or create stream for this seed pair
        stream_query = select(LiveStream).where(
            LiveStream.server_seed_hashed == bet_data.serverSeedHashed,
            LiveStream.client_seed == bet_data.clientSeed
        )
        result = await session.execute(stream_query)
        stream = result.scalar_one_or_none()
        
        if stream is None:
            # Create new stream for this seed pair
            stream = LiveStream(
                server_seed_hashed=bet_data.serverSeedHashed,
                client_seed=bet_data.clientSeed,
                created_at=datetime.utcnow(),
                last_seen_at=datetime.utcnow()
            )
            session.add(stream)
            await session.flush()  # Get the ID without committing
        
        # Check for duplicate bet (idempotent handling)
        duplicate_query = select(LiveBet).where(
            LiveBet.stream_id == stream.id,
            LiveBet.antebot_bet_id == bet_data.id
        )
        duplicate_result = await session.execute(duplicate_query)
        existing_bet = duplicate_result.scalar_one_or_none()
        
        if existing_bet is not None:
            # Duplicate bet - return success with accepted=false
            return IngestResponse(streamId=stream.id, accepted=False)
        
        # Create new bet record
        new_bet = LiveBet(
            stream_id=stream.id,
            antebot_bet_id=bet_data.id,
            received_at=datetime.utcnow(),
            date_time=parsed_datetime,
            nonce=bet_data.nonce,
            amount=bet_data.amount,
            payout_multiplier=bet_data.payoutMultiplier,
            payout=bet_data.payout,
            difficulty=bet_data.difficulty,
            round_target=bet_data.roundTarget,
            round_result=bet_data.roundResult
        )
        
        # Update stream's last_seen_at timestamp
        stream.last_seen_at = datetime.utcnow()
        
        session.add(new_bet)
        await session.commit()
        
        return IngestResponse(streamId=stream.id, accepted=True)
        
    except HTTPException:
        # Re-raise HTTP exceptions (like validation errors)
        await session.rollback()
        raise
    except IntegrityError as e:
        # Handle database constraint violations
        await session.rollback()
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        
        # Check for specific constraint violations
        if "ck_live_bets_nonce_ge_1" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Nonce must be greater than or equal to 1"
            )
        elif "ck_live_bets_amount_ge_0" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Amount must be greater than or equal to 0"
            )
        elif "ck_live_bets_payout_ge_0" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Payout must be greater than or equal to 0"
            )
        elif "ck_live_bets_difficulty" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Difficulty must be one of: easy, medium, hard, expert"
            )
        elif "ck_live_bets_round_target_gt_0" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Round target must be greater than 0 if provided"
            )
        elif "ck_live_bets_round_result_ge_0" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Round result must be greater than or equal to 0 if provided"
            )
        elif "UNIQUE constraint failed" in error_msg or "unique constraint" in error_msg.lower():
            # This shouldn't happen due to our duplicate check, but handle it gracefully
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bet with this ID already exists for this stream"
            )
        else:
            # Generic constraint violation
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Data validation failed: constraint violation"
            )
    except SQLAlchemyError as e:
        # Handle other database errors
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while processing request"
        )
    except Exception as e:
        # Handle any other unexpected errors
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing the request"
        )


@router.get("/streams", response_model=StreamListResponse)
async def list_streams(
    limit: int = 50,
    offset: int = 0,
    session: AsyncSession = Depends(get_session)
) -> StreamListResponse:
    """
    List all live streams with pagination and metadata aggregation.
    
    Returns streams ordered by last_seen_at DESC with total bets and highest multiplier.
    """
    # Validate limit constraint (≤100)
    if limit > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit cannot exceed 100"
        )
    
    if limit < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit must be at least 1"
        )
    
    if offset < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Offset cannot be negative"
        )
    
    try:
        # Get total count of streams
        count_query = select(func.count(LiveStream.id))
        count_result = await session.execute(count_query)
        total_streams = count_result.scalar_one()
        
        # Get streams with aggregated metadata
        # Using subquery to get bet counts and highest multipliers
        streams_query = (
            select(
                LiveStream,
                func.count(LiveBet.id).label("total_bets"),
                func.max(LiveBet.round_result).label("highest_multiplier")
            )
            .outerjoin(LiveBet, LiveStream.id == LiveBet.stream_id)
            .group_by(LiveStream.id)
            .order_by(LiveStream.last_seen_at.desc())
            .offset(offset)
            .limit(limit)
        )
        
        result = await session.execute(streams_query)
        stream_rows = result.all()
        
        # Convert to response format
        streams = []
        for row in stream_rows:
            stream = row[0]  # LiveStream object
            total_bets = row[1] or 0  # bet count
            highest_multiplier = row[2]  # max multiplier (can be None)
            
            streams.append(StreamSummary(
                id=stream.id,
                server_seed_hashed=stream.server_seed_hashed,
                client_seed=stream.client_seed,
                created_at=stream.created_at,
                last_seen_at=stream.last_seen_at,
                total_bets=total_bets,
                highest_multiplier=highest_multiplier,
                notes=stream.notes
            ))
        
        return StreamListResponse(
            streams=streams,
            total=total_streams,
            limit=limit,
            offset=offset
        )
        
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while fetching streams"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching streams"
        )


@router.get("/streams/{stream_id}", response_model=StreamDetail)
async def get_stream_detail(
    stream_id: UUID,
    session: AsyncSession = Depends(get_session)
) -> StreamDetail:
    """
    Get detailed information about a specific stream including statistics and recent activity.
    """
    try:
        # Get the stream
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()
        
        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found"
            )
        
        # Get aggregated statistics for this stream
        stats_query = select(
            func.count(LiveBet.id).label("total_bets"),
            func.max(LiveBet.round_result).label("highest_multiplier"),
            func.min(LiveBet.round_result).label("lowest_multiplier"),
            func.avg(LiveBet.round_result).label("average_multiplier")
        ).where(LiveBet.stream_id == stream_id)
        
        stats_result = await session.execute(stats_query)
        stats = stats_result.first()
        
        total_bets = stats[0] or 0
        highest_multiplier = stats[1]
        lowest_multiplier = stats[2]
        average_multiplier = stats[3]
        
        # Get recent bets (last 10) ordered by nonce DESC for recent activity
        recent_bets_query = (
            select(LiveBet)
            .where(LiveBet.stream_id == stream_id)
            .order_by(LiveBet.nonce.desc())
            .limit(10)
        )
        
        recent_bets_result = await session.execute(recent_bets_query)
        recent_bet_records = recent_bets_result.scalars().all()
        
        # Convert to BetRecord format
        recent_bets = []
        for bet in recent_bet_records:
            recent_bets.append(BetRecord(
                id=bet.id,
                antebot_bet_id=bet.antebot_bet_id,
                received_at=bet.received_at,
                date_time=bet.date_time,
                nonce=bet.nonce,
                amount=bet.amount,
                payout_multiplier=bet.payout_multiplier,
                payout=bet.payout,
                difficulty=bet.difficulty,
                round_target=bet.round_target,
                round_result=bet.round_result
            ))
        
        return StreamDetail(
            id=stream.id,
            server_seed_hashed=stream.server_seed_hashed,
            client_seed=stream.client_seed,
            created_at=stream.created_at,
            last_seen_at=stream.last_seen_at,
            total_bets=total_bets,
            highest_multiplier=highest_multiplier,
            lowest_multiplier=lowest_multiplier,
            average_multiplier=average_multiplier,
            notes=stream.notes,
            recent_bets=recent_bets
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 404)
        raise
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while fetching stream details"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching stream details"
        )


@router.get("/streams/{stream_id}/bets", response_model=BetListResponse)
async def list_stream_bets(
    stream_id: UUID,
    limit: int = 100,
    offset: int = 0,
    min_multiplier: Optional[float] = None,
    order: Literal["nonce_asc", "id_desc"] = "nonce_asc",
    session: AsyncSession = Depends(get_session)
) -> BetListResponse:
    """
    List bets for a specific stream with filtering and pagination.
    
    Supports min_multiplier filtering and ordering by nonce (ASC) or id (DESC).
    Default order is nonce_asc for chronological bet sequence.
    """
    # Validate limit constraint (≤1000)
    if limit > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit cannot exceed 1000"
        )
    
    if limit < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit must be at least 1"
        )
    
    if offset < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Offset cannot be negative"
        )
    
    if min_multiplier is not None and min_multiplier < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="min_multiplier cannot be negative"
        )
    
    try:
        # Verify stream exists
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()
        
        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found"
            )
        
        # Build base query with stream filter
        base_query = select(LiveBet).where(LiveBet.stream_id == stream_id)
        
        # Add min_multiplier filter if provided (using round_result instead of payout_multiplier)
        if min_multiplier is not None:
            base_query = base_query.where(LiveBet.round_result >= min_multiplier)
        
        # Get total count with filters applied
        count_query = select(func.count()).select_from(base_query.subquery())
        count_result = await session.execute(count_query)
        total_bets = count_result.scalar_one()
        
        # Add ordering
        if order == "nonce_asc":
            base_query = base_query.order_by(LiveBet.nonce.asc())
        elif order == "id_desc":
            base_query = base_query.order_by(LiveBet.id.desc())
        
        # Add pagination
        bets_query = base_query.offset(offset).limit(limit)
        
        bets_result = await session.execute(bets_query)
        bet_records = bets_result.scalars().all()
        
        # Convert to BetRecord format
        bets = []
        for bet in bet_records:
            bets.append(BetRecord(
                id=bet.id,
                antebot_bet_id=bet.antebot_bet_id,
                received_at=bet.received_at,
                date_time=bet.date_time,
                nonce=bet.nonce,
                amount=bet.amount,
                payout_multiplier=bet.payout_multiplier,
                payout=bet.payout,
                difficulty=bet.difficulty,
                round_target=bet.round_target,
                round_result=bet.round_result
            ))
        
        return BetListResponse(
            bets=bets,
            total=total_bets,
            limit=limit,
            offset=offset,
            stream_id=stream_id
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 400)
        raise
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while fetching bets"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching bets"
        )


@router.get("/streams/{stream_id}/tail", response_model=TailResponse)
async def tail_stream_bets(
    stream_id: UUID,
    since_id: int,
    session: AsyncSession = Depends(get_session)
) -> TailResponse:
    """
    Get incremental bet updates for a stream since a specific ID.
    
    Returns only new bets with id > since_id ordered by id ASC for polling-based updates.
    Includes last_id in response for next polling iteration.
    """
    if since_id < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="since_id cannot be negative"
        )
    
    try:
        # Verify stream exists
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()
        
        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found"
            )
        
        # Get new bets since the specified ID, ordered by id ASC
        tail_query = (
            select(LiveBet)
            .where(
                LiveBet.stream_id == stream_id,
                LiveBet.id > since_id
            )
            .order_by(LiveBet.id.asc())
        )
        
        tail_result = await session.execute(tail_query)
        new_bet_records = tail_result.scalars().all()
        
        # Convert to BetRecord format
        bets = []
        last_id = since_id  # Default to input if no new records
        
        for bet in new_bet_records:
            bets.append(BetRecord(
                id=bet.id,
                antebot_bet_id=bet.antebot_bet_id,
                received_at=bet.received_at,
                date_time=bet.date_time,
                nonce=bet.nonce,
                amount=bet.amount,
                payout_multiplier=bet.payout_multiplier,
                payout=bet.payout,
                difficulty=bet.difficulty,
                round_target=bet.round_target,
                round_result=bet.round_result
            ))
            last_id = bet.id  # Update to highest ID seen
        
        # Check if there might be more records beyond what we returned
        # For simplicity, we'll assume has_more is False since we return all new records
        # In a production system, you might want to limit the number of records returned
        # and set has_more accordingly
        has_more = False
        
        return TailResponse(
            bets=bets,
            last_id=last_id if bets else None,  # Only set last_id if we have new bets
            has_more=has_more
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 400)
        raise
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while fetching tail updates"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching tail updates"
        )


@router.delete("/streams/{stream_id}", response_model=StreamDeleteResponse)
async def delete_stream(
    stream_id: UUID,
    session: AsyncSession = Depends(get_session)
) -> StreamDeleteResponse:
    """
    Delete a stream and all associated bets with cascade deletion.
    
    This operation is irreversible and will permanently remove all bet data
    associated with the stream.
    """
    try:
        # First, verify the stream exists and get bet count for response
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()
        
        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found"
            )
        
        # Count bets that will be deleted (for response information)
        bet_count_query = select(func.count(LiveBet.id)).where(LiveBet.stream_id == stream_id)
        bet_count_result = await session.execute(bet_count_query)
        bets_to_delete = bet_count_result.scalar_one()
        
        # Delete the stream (cascade will handle bets due to foreign key constraint)
        await session.delete(stream)
        await session.commit()
        
        return StreamDeleteResponse(
            deleted=True,
            stream_id=stream_id,
            bets_deleted=bets_to_delete
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 404)
        await session.rollback()
        raise
    except SQLAlchemyError as e:
        await session.rollback()
        # Check for specific constraint violations that might prevent deletion
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        
        if "foreign key constraint" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot delete stream due to foreign key constraints"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error occurred while deleting stream"
            )
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while deleting stream"
        )


@router.put("/streams/{stream_id}", response_model=StreamDetail)
async def update_stream(
    stream_id: UUID,
    update_data: StreamUpdateRequest,
    session: AsyncSession = Depends(get_session)
) -> StreamDetail:
    """
    Update stream notes and metadata.
    
    Currently supports updating user notes. Input is validated and sanitized.
    Handles concurrent update scenarios properly.
    """
    try:
        # Get the stream with a lock to handle concurrent updates
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()
        
        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found"
            )
        
        # Update notes if provided (None is allowed to clear notes)
        if update_data.notes is not None:
            # Basic sanitization - strip whitespace and limit length
            sanitized_notes = update_data.notes.strip()
            if len(sanitized_notes) > 1000:  # Reasonable limit for notes
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Notes cannot exceed 1000 characters"
                )
            stream.notes = sanitized_notes if sanitized_notes else None
        
        # Commit the update
        session.add(stream)
        await session.commit()
        await session.refresh(stream)
        
        # Get updated statistics for the response
        stats_query = select(
            func.count(LiveBet.id).label("total_bets"),
            func.max(LiveBet.round_result).label("highest_multiplier"),
            func.min(LiveBet.round_result).label("lowest_multiplier"),
            func.avg(LiveBet.round_result).label("average_multiplier")
        ).where(LiveBet.stream_id == stream_id)
        
        stats_result = await session.execute(stats_query)
        stats = stats_result.first()
        
        total_bets = stats[0] or 0
        highest_multiplier = stats[1]
        lowest_multiplier = stats[2]
        average_multiplier = stats[3]
        
        # Get recent bets (last 10) for the response
        recent_bets_query = (
            select(LiveBet)
            .where(LiveBet.stream_id == stream_id)
            .order_by(LiveBet.nonce.desc())
            .limit(10)
        )
        
        recent_bets_result = await session.execute(recent_bets_query)
        recent_bet_records = recent_bets_result.scalars().all()
        
        # Convert to BetRecord format
        recent_bets = []
        for bet in recent_bet_records:
            recent_bets.append(BetRecord(
                id=bet.id,
                antebot_bet_id=bet.antebot_bet_id,
                received_at=bet.received_at,
                date_time=bet.date_time,
                nonce=bet.nonce,
                amount=bet.amount,
                payout_multiplier=bet.payout_multiplier,
                payout=bet.payout,
                difficulty=bet.difficulty,
                round_target=bet.round_target,
                round_result=bet.round_result
            ))
        
        return StreamDetail(
            id=stream.id,
            server_seed_hashed=stream.server_seed_hashed,
            client_seed=stream.client_seed,
            created_at=stream.created_at,
            last_seen_at=stream.last_seen_at,
            total_bets=total_bets,
            highest_multiplier=highest_multiplier,
            lowest_multiplier=lowest_multiplier,
            average_multiplier=average_multiplier,
            notes=stream.notes,
            recent_bets=recent_bets
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 422)
        await session.rollback()
        raise
    except SQLAlchemyError as e:
        await session.rollback()
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        
        # Handle potential constraint violations or lock timeouts
        if "database is locked" in error_msg.lower() or "lock" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Stream is currently being updated by another request. Please try again."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error occurred while updating stream"
            )
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while updating stream"
        )


@router.get("/streams/{stream_id}/export.csv")
async def export_stream_csv(
    stream_id: UUID,
    session: AsyncSession = Depends(get_session)
) -> StreamingResponse:
    """
    Export all bets for a stream as CSV data.
    
    Returns CSV with all bets ordered by nonce ASC for chronological analysis.
    Uses streaming response for efficient handling of large datasets.
    """
    try:
        # Verify stream exists
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()
        
        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found"
            )
        
        # Get all bets for the stream ordered by nonce ASC (chronological)
        bets_query = (
            select(LiveBet)
            .where(LiveBet.stream_id == stream_id)
            .order_by(LiveBet.nonce.asc())
        )
        
        bets_result = await session.execute(bets_query)
        all_bets = bets_result.scalars().all()
        
        # Create CSV content in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write CSV header
        writer.writerow([
            'nonce',
            'antebot_bet_id',
            'date_time',
            'received_at',
            'amount',
            'payout_multiplier',
            'payout',
            'difficulty',
            'round_target',
            'round_result'
        ])
        
        # Write bet data rows
        for bet in all_bets:
            writer.writerow([
                bet.nonce,
                bet.antebot_bet_id,
                bet.date_time.isoformat() if bet.date_time else '',
                bet.received_at.isoformat(),
                bet.amount,
                bet.payout_multiplier,
                bet.payout,
                bet.difficulty,
                bet.round_target if bet.round_target is not None else '',
                bet.round_result if bet.round_result is not None else ''
            ])
        
        # Get CSV content and reset pointer
        csv_content = output.getvalue()
        output.close()
        
        # Create filename with stream info
        filename = f"stream_{stream.server_seed_hashed[:10]}_{stream.client_seed}_{len(all_bets)}_bets.csv"
        
        # Create streaming response
        def generate_csv():
            yield csv_content
        
        return StreamingResponse(
            generate_csv(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "text/csv; charset=utf-8"
            }
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 404)
        raise
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while exporting stream data"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while exporting stream data"
        )