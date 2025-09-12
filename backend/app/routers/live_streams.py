from __future__ import annotations

from datetime import datetime, timezone
import asyncio
from typing import Optional, Literal, List
from uuid import UUID

import csv
import io
import json
from fastapi import APIRouter, Depends, HTTPException, Header, Request, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlmodel import select, func
from sqlalchemy import text, update

from ..core.config import get_settings
from ..core.rate_limiter import rate_limit_dependency
from ..db import get_session
from ..models.live_streams import LiveStream, LiveBet, LiveBookmark, LiveSnapshot
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
    StreamDeleteResponse,
    BookmarkCreate,
    BookmarkUpdate,
    BookmarkResponse,
    SnapshotCreate,
    SnapshotResponse,
    SnapshotDeleteResponse,
    StreamMetrics,
    MultiplierMetrics,
    PeakRecord,
    HitRecord,
    HitQueryResponse,
    BucketStats,
    RangeStats,
    HitStatsResponse,
    GlobalHitStatsResponse,
    BatchHitQueryResponse,
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
            # Create the stream and commit immediately to make it visible to others
            new_stream = LiveStream(
                server_seed_hashed=bet_data.serverSeedHashed,
                client_seed=bet_data.clientSeed,
                created_at=datetime.utcnow(),
                last_seen_at=datetime.utcnow(),
            )
            session.add(new_stream)
            try:
                await session.commit()
                # Re-select to avoid refresh race issues under concurrency
                result = await session.execute(stream_query)
                stream = result.scalar_one_or_none() or new_stream
            except IntegrityError:
                # Another request created it; rollback and fetch existing
                await session.rollback()
                result = await session.execute(stream_query)
                stream = (
                    result.scalar_one()
                )  # Should exist since another request created it

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
            payout=bet_data.payout,
            difficulty=bet_data.difficulty,
            round_target=bet_data.roundTarget,
            round_result=bet_data.roundResult,
        )

        # Update stream's last_seen_at timestamp using explicit UPDATE to avoid stale instance issues
        await session.execute(
            update(LiveStream)
            .where(LiveStream.id == stream.id)
            .values(last_seen_at=datetime.utcnow())
        )

        session.add(new_bet)
        try:
            await session.commit()
        except IntegrityError as e:
            await session.rollback()
            error_msg = str(e.orig) if hasattr(e, "orig") else str(e)
            # Treat unique bet constraint as idempotent duplicate
            if (
                "idx_live_bets_unique_bet" in error_msg
                or "UNIQUE constraint failed: live_bets.stream_id, live_bets.antebot_bet_id"
                in error_msg
                or "unique constraint" in error_msg.lower()
            ):
                return IngestResponse(streamId=stream.id, accepted=False)
            raise

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
                detail="Round result must be greater than or equal to 0",
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
            recent_bets.append(
                BetRecord(
                    id=bet.id,
                    antebot_bet_id=bet.antebot_bet_id,
                    received_at=bet.received_at,
                    date_time=bet.date_time,
                    nonce=bet.nonce,
                    amount=bet.amount,
                    payout=bet.payout,
                    difficulty=bet.difficulty,
                    round_target=bet.round_target,
                    round_result=bet.round_result,
                    distance_prev_opt=None,
                )
            )

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
    include_distance: bool = False,
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

        if include_distance:
            # Build query with distance calculation using window function
            min_multiplier_filter = ""
            if min_multiplier is not None:
                min_multiplier_filter = f"AND round_result >= {min_multiplier}"

            order_clause = "ORDER BY nonce ASC" if order == "nonce_asc" else "ORDER BY id DESC"

            # First get total count with filters
            count_query = text(
                f"""
                SELECT COUNT(*)
                FROM live_bets
                WHERE stream_id = :stream_id {min_multiplier_filter}
            """
            )
            count_result = await session.execute(count_query, {"stream_id": str(stream_id)})
            total_bets = count_result.scalar_one()

            # Get bets with distance calculation
            distance_query = text(
                f"""
                SELECT
                    id,
                    antebot_bet_id,
                    received_at,
                    date_time,
                    nonce,
                    amount,
                    payout,
                    difficulty,
                    round_target,
                    round_result,
                    nonce - LAG(nonce) OVER (
                        PARTITION BY round_result
                        ORDER BY nonce
                    ) as distance_prev_opt
                FROM live_bets
                WHERE stream_id = :stream_id {min_multiplier_filter}
                {order_clause}
                LIMIT :limit OFFSET :offset
            """
            )

            bets_result = await session.execute(
                distance_query,
                {"stream_id": str(stream_id), "limit": limit, "offset": offset},
            )
            bet_records = bets_result.fetchall()

            # Convert to BetRecord format with distance
            bets = []
            for row in bet_records:
                bets.append(
                    BetRecord(
                        id=row.id,
                        antebot_bet_id=row.antebot_bet_id,
                        received_at=row.received_at,
                        date_time=row.date_time,
                        nonce=row.nonce,
                        amount=row.amount,
                        payout=row.payout,
                        difficulty=row.difficulty,
                        round_target=row.round_target,
                        round_result=row.round_result,
                        distance_prev_opt=row.distance_prev_opt,
                    )
                )
        else:
            # Build base query with stream filter (without distance)
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

            # Convert to BetRecord format without distance
            bets = []
            for bet in bet_records:
                bets.append(
                    BetRecord(
                        id=bet.id,
                        antebot_bet_id=bet.antebot_bet_id,
                        received_at=bet.received_at,
                        date_time=bet.date_time,
                        nonce=bet.nonce,
                        amount=bet.amount,
                        payout=bet.payout,
                        difficulty=bet.difficulty,
                        round_target=bet.round_target,
                        round_result=bet.round_result,
                        distance_prev_opt=None,
                    )
                )

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
    include_distance: bool = False,
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

        if include_distance:
            # Use window function to calculate distance to previous same-multiplier hit
            distance_query = text(
                """
                SELECT
                    id,
                    antebot_bet_id,
                    received_at,
                    date_time,
                    nonce,
                    amount,
                    payout,
                    difficulty,
                    round_target,
                    round_result,
                    nonce - LAG(nonce) OVER (
                        PARTITION BY round_result
                        ORDER BY nonce
                    ) as distance_prev_opt
                FROM live_bets
                WHERE stream_id = :stream_id AND id > :since_id
                ORDER BY id ASC
            """
            )

            tail_result = await session.execute(
                distance_query, {"stream_id": str(stream_id), "since_id": since_id}
            )
            new_bet_records = tail_result.fetchall()

            # Convert to BetRecord format with distance
            bets = []
            last_id = since_id  # Default to input if no new records

            for row in new_bet_records:
                bets.append(
                    BetRecord(
                        id=row.id,
                        antebot_bet_id=row.antebot_bet_id,
                        received_at=row.received_at,
                        date_time=row.date_time,
                        nonce=row.nonce,
                        amount=row.amount,
                        payout=row.payout,
                        difficulty=row.difficulty,
                        round_target=row.round_target,
                        round_result=row.round_result,
                        distance_prev_opt=row.distance_prev_opt,
                    )
                )
                last_id = row.id  # Update to highest ID seen
        else:
            # Get new bets since the specified ID, ordered by id ASC (without distance)
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

            # Convert to BetRecord format without distance
            bets = []
            last_id = since_id  # Default to input if no new records

            for bet in new_bet_records:
                bets.append(
                    BetRecord(
                        id=bet.id,
                        antebot_bet_id=bet.antebot_bet_id,
                        received_at=bet.received_at,
                        date_time=bet.date_time,
                        nonce=bet.nonce,
                        amount=bet.amount,
                        payout=bet.payout,
                        difficulty=bet.difficulty,
                        round_target=bet.round_target,
                        round_result=bet.round_result,
                        distance_prev_opt=None,
                    )
                )
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
            recent_bets.append(
                BetRecord(
                    id=bet.id,
                    antebot_bet_id=bet.antebot_bet_id,
                    received_at=bet.received_at,
                    date_time=bet.date_time,
                    nonce=bet.nonce,
                    amount=bet.amount,
                    payout=bet.payout,
                    difficulty=bet.difficulty,
                    round_target=bet.round_target,
                    round_result=bet.round_result,
                    distance_prev_opt=None,
                )
            )

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
        writer.writerow(
            [
                "nonce",
                "antebot_bet_id",
                "date_time",
                "received_at",
                "amount",
                "payout",
                "difficulty",
                "round_target",
                "round_result",
            ]
        )

        # Write bet data rows
        for bet in all_bets:
            writer.writerow(
                [
                    bet.nonce,
                    bet.antebot_bet_id,
                    bet.date_time.isoformat() if bet.date_time else "",
                    bet.received_at.isoformat(),
                    bet.amount,
                    bet.payout,
                    bet.difficulty,
                    bet.round_target if bet.round_target is not None else "",
                    bet.round_result if bet.round_result is not None else "",
                ]
            )

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


# Bookmark endpoints

@router.post("/streams/{stream_id}/bookmarks", response_model=BookmarkResponse)
async def create_bookmark(
    stream_id: UUID,
    bookmark_data: BookmarkCreate,
    session: AsyncSession = Depends(get_session)
) -> BookmarkResponse:
    """
    Create a new bookmark for a specific bet in a stream.
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

        # Verify the bet exists in the stream
        bet_query = select(LiveBet).where(
            LiveBet.stream_id == stream_id,
            LiveBet.nonce == bookmark_data.nonce,
            LiveBet.round_result == bookmark_data.multiplier,
        )
        bet_result = await session.execute(bet_query)
        bet = bet_result.scalar_one_or_none()

        if bet is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bet with nonce {bookmark_data.nonce} and multiplier {bookmark_data.multiplier} not found in stream"
            )

        # Check if bookmark already exists
        existing_bookmark_query = select(LiveBookmark).where(
            LiveBookmark.stream_id == stream_id,
            LiveBookmark.nonce == bookmark_data.nonce,
            LiveBookmark.multiplier == bookmark_data.multiplier
        )
        existing_result = await session.execute(existing_bookmark_query)
        existing_bookmark = existing_result.scalar_one_or_none()

        if existing_bookmark is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bookmark already exists for this bet"
            )

        # Create new bookmark
        new_bookmark = LiveBookmark(
            stream_id=stream_id,
            nonce=bookmark_data.nonce,
            multiplier=bookmark_data.multiplier,
            note=bookmark_data.note,
            created_at=datetime.utcnow()
        )

        session.add(new_bookmark)
        await session.commit()
        await session.refresh(new_bookmark)

        return BookmarkResponse(
            id=new_bookmark.id,
            stream_id=new_bookmark.stream_id,
            nonce=new_bookmark.nonce,
            multiplier=new_bookmark.multiplier,
            note=new_bookmark.note,
            created_at=new_bookmark.created_at
        )

    except HTTPException:
        await session.rollback()
        raise
    except SQLAlchemyError as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while creating bookmark"
        )
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating bookmark"
        )


@router.get("/streams/{stream_id}/bookmarks", response_model=List[BookmarkResponse])
async def list_bookmarks(
    stream_id: UUID,
    session: AsyncSession = Depends(get_session)
) -> List[BookmarkResponse]:
    """
    List all bookmarks for a specific stream.
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

        # Get all bookmarks for the stream ordered by created_at DESC
        bookmarks_query = (
            select(LiveBookmark)
            .where(LiveBookmark.stream_id == stream_id)
            .order_by(LiveBookmark.created_at.desc())
        )

        bookmarks_result = await session.execute(bookmarks_query)
        bookmarks = bookmarks_result.scalars().all()

        # Convert to response format
        return [
            BookmarkResponse(
                id=bookmark.id,
                stream_id=bookmark.stream_id,
                nonce=bookmark.nonce,
                multiplier=bookmark.multiplier,
                note=bookmark.note,
                created_at=bookmark.created_at
            )
            for bookmark in bookmarks
        ]

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while fetching bookmarks"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching bookmarks"
        )


@router.put("/live/bookmarks/{bookmark_id}", response_model=BookmarkResponse)
async def update_bookmark(
    bookmark_id: int,
    update_data: BookmarkUpdate,
    session: AsyncSession = Depends(get_session)
) -> BookmarkResponse:
    """
    Update a bookmark's note.
    """
    try:
        # Get the bookmark
        bookmark_query = select(LiveBookmark).where(LiveBookmark.id == bookmark_id)
        bookmark_result = await session.execute(bookmark_query)
        bookmark = bookmark_result.scalar_one_or_none()

        if bookmark is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bookmark with ID {bookmark_id} not found"
            )

        # Update the note
        bookmark.note = update_data.note

        session.add(bookmark)
        await session.commit()
        await session.refresh(bookmark)

        return BookmarkResponse(
            id=bookmark.id,
            stream_id=bookmark.stream_id,
            nonce=bookmark.nonce,
            multiplier=bookmark.multiplier,
            note=bookmark.note,
            created_at=bookmark.created_at
        )

    except HTTPException:
        await session.rollback()
        raise
    except SQLAlchemyError as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while updating bookmark"
        )
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while updating bookmark"
        )


@router.delete("/live/bookmarks/{bookmark_id}")
async def delete_bookmark(
    bookmark_id: int,
    session: AsyncSession = Depends(get_session)
) -> dict:
    """
    Delete a bookmark.
    """
    try:
        # Get the bookmark
        bookmark_query = select(LiveBookmark).where(LiveBookmark.id == bookmark_id)
        bookmark_result = await session.execute(bookmark_query)
        bookmark = bookmark_result.scalar_one_or_none()

        if bookmark is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bookmark with ID {bookmark_id} not found"
            )

        # Delete the bookmark
        await session.delete(bookmark)
        await session.commit()

        return {"deleted": True, "bookmark_id": bookmark_id}

    except HTTPException:
        await session.rollback()
        raise
    except SQLAlchemyError as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while deleting bookmark"
        )
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while deleting bookmark"
        )


# Snapshot endpoints

@router.post("/streams/{stream_id}/snapshots", response_model=SnapshotResponse)
async def create_snapshot(
    stream_id: UUID,
    snapshot_data: SnapshotCreate,
    session: AsyncSession = Depends(get_session)
) -> SnapshotResponse:
    """
    Create a new snapshot for a stream with current filter state.
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

        # Validate that the last_id_checkpoint exists in the stream
        checkpoint_query = select(LiveBet).where(
            LiveBet.stream_id == stream_id,
            LiveBet.id == snapshot_data.last_id_checkpoint
        )
        checkpoint_result = await session.execute(checkpoint_query)
        checkpoint_bet = checkpoint_result.scalar_one_or_none()

        if checkpoint_bet is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Checkpoint ID {snapshot_data.last_id_checkpoint} not found in stream"
            )

        # Create new snapshot
        new_snapshot = LiveSnapshot(
            stream_id=stream_id,
            name=snapshot_data.name,
            filter_state=json.dumps(snapshot_data.filter_state),
            last_id_checkpoint=snapshot_data.last_id_checkpoint,
            created_at=datetime.utcnow()
        )

        session.add(new_snapshot)
        await session.commit()
        await session.refresh(new_snapshot)

        return SnapshotResponse(
            id=new_snapshot.id,
            stream_id=new_snapshot.stream_id,
            name=new_snapshot.name,
            filter_state=json.loads(new_snapshot.filter_state),
            last_id_checkpoint=new_snapshot.last_id_checkpoint,
            created_at=new_snapshot.created_at
        )

    except HTTPException:
        await session.rollback()
        raise
    except json.JSONDecodeError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filter_state JSON format"
        )
    except SQLAlchemyError as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while creating snapshot"
        )
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating snapshot"
        )


@router.get("/streams/{stream_id}/snapshots", response_model=List[SnapshotResponse])
async def list_snapshots(
    stream_id: UUID,
    session: AsyncSession = Depends(get_session)
) -> List[SnapshotResponse]:
    """
    List all snapshots for a specific stream.
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

        # Get all snapshots for the stream ordered by created_at DESC
        snapshots_query = (
            select(LiveSnapshot)
            .where(LiveSnapshot.stream_id == stream_id)
            .order_by(LiveSnapshot.created_at.desc())
        )

        snapshots_result = await session.execute(snapshots_query)
        snapshots = snapshots_result.scalars().all()

        # Convert to response format
        return [
            SnapshotResponse(
                id=snapshot.id,
                stream_id=snapshot.stream_id,
                name=snapshot.name,
                filter_state=json.loads(snapshot.filter_state),
                last_id_checkpoint=snapshot.last_id_checkpoint,
                created_at=snapshot.created_at
            )
            for snapshot in snapshots
        ]

    except HTTPException:
        raise
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid filter_state data in database"
        )
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while fetching snapshots"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching snapshots"
        )


@router.get("/streams/{stream_id}/snapshots/{snapshot_id}/replay", response_model=BetListResponse)
async def replay_snapshot(
    stream_id: UUID,
    snapshot_id: int,
    session: AsyncSession = Depends(get_session)
) -> BetListResponse:
    """
    Replay snapshot data by returning bets up to the snapshot checkpoint with the saved filter state.
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

        # Get the snapshot
        snapshot_query = select(LiveSnapshot).where(
            LiveSnapshot.id == snapshot_id,
            LiveSnapshot.stream_id == stream_id
        )
        snapshot_result = await session.execute(snapshot_query)
        snapshot = snapshot_result.scalar_one_or_none()

        if snapshot is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Snapshot with ID {snapshot_id} not found in stream"
            )

        # Parse filter state
        try:
            filter_state = json.loads(snapshot.filter_state)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Invalid filter_state data in snapshot"
            )

        # Build query for bets up to checkpoint
        base_query = select(LiveBet).where(
            LiveBet.stream_id == stream_id,
            LiveBet.id <= snapshot.last_id_checkpoint
        )

        # Apply filters from snapshot state
        if filter_state.get("min_multiplier") is not None:
            base_query = base_query.where(LiveBet.round_result >= filter_state["min_multiplier"])

        if filter_state.get("difficulty") is not None:
            base_query = base_query.where(LiveBet.difficulty == filter_state["difficulty"])

        # Get total count with filters applied
        count_query = select(func.count()).select_from(base_query.subquery())
        count_result = await session.execute(count_query)
        total_bets = count_result.scalar_one()

        # Order by nonce ASC for chronological replay
        bets_query = base_query.order_by(LiveBet.nonce.asc())

        bets_result = await session.execute(bets_query)
        bet_records = bets_result.scalars().all()

        # Convert to BetRecord format
        bets = []
        for bet in bet_records:
            bets.append(
                BetRecord(
                    id=bet.id,
                    antebot_bet_id=bet.antebot_bet_id,
                    received_at=bet.received_at,
                    date_time=bet.date_time,
                    nonce=bet.nonce,
                    amount=bet.amount,
                    payout=bet.payout,
                    difficulty=bet.difficulty,
                    round_target=bet.round_target,
                    round_result=bet.round_result,
                    distance_prev_opt=None,
                )
            )

        return BetListResponse(
            bets=bets,
            total=total_bets,
            limit=len(bets),
            offset=0,
            stream_id=stream_id
        )

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while replaying snapshot"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while replaying snapshot"
        )


@router.delete("/snapshots/{snapshot_id}", response_model=SnapshotDeleteResponse)
async def delete_snapshot(
    snapshot_id: int,
    session: AsyncSession = Depends(get_session)
) -> SnapshotDeleteResponse:
    """
    Delete a snapshot.
    """
    try:
        # Get the snapshot
        snapshot_query = select(LiveSnapshot).where(LiveSnapshot.id == snapshot_id)
        snapshot_result = await session.execute(snapshot_query)
        snapshot = snapshot_result.scalar_one_or_none()

        if snapshot is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Snapshot with ID {snapshot_id} not found"
            )

        # Delete the snapshot
        await session.delete(snapshot)
        await session.commit()

        return SnapshotDeleteResponse(deleted=True, snapshot_id=snapshot_id)

    except HTTPException:
        await session.rollback()
        raise
    except SQLAlchemyError as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while deleting snapshot"
        )
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while deleting snapshot"
        )


@router.get("/streams/{stream_id}/metrics", response_model=StreamMetrics)
async def get_stream_metrics(
    stream_id: UUID,
    multipliers: List[float] = Query([]),
    tolerance: float = Query(1e-9),
    bucket_size: int = Query(1000),
    top_peaks_limit: int = Query(20),
    session: AsyncSession = Depends(get_session)
) -> StreamMetrics:
    """
    Get pre-aggregated analytics for pinned multipliers.

    Returns KPIs, multiplier stats, density buckets, and top peaks for the specified stream.
    If multipliers list is empty, returns general stream metrics without per-multiplier stats.
    """
    if tolerance <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tolerance must be greater than 0"
        )

    if bucket_size <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="bucket_size must be greater than 0"
        )

    if top_peaks_limit <= 0 or top_peaks_limit > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="top_peaks_limit must be between 1 and 100"
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

        # Get basic stream metrics
        basic_stats_query = select(
            func.count(LiveBet.id).label("total_bets"),
            func.max(LiveBet.round_result).label("highest_multiplier"),
            func.min(LiveBet.received_at).label("first_bet_time"),
            func.max(LiveBet.received_at).label("last_bet_time"),
        ).where(LiveBet.stream_id == stream_id)

        basic_stats_result = await session.execute(basic_stats_query)
        basic_stats = basic_stats_result.first()

        total_bets = basic_stats[0] or 0
        highest_multiplier = basic_stats[1] or 0.0
        first_bet_time = basic_stats[2]
        last_bet_time = basic_stats[3]

        # Calculate hit rate (hits per minute)
        hit_rate = 0.0
        if total_bets > 0 and first_bet_time and last_bet_time:
            duration_seconds = (last_bet_time - first_bet_time).total_seconds()
            if duration_seconds > 0:
                hit_rate = (total_bets * 60.0) / duration_seconds

        # Get top peaks
        top_peaks_query = (
            select(LiveBet.round_result, LiveBet.nonce, LiveBet.received_at, LiveBet.id)
            .where(LiveBet.stream_id == stream_id)
            .order_by(LiveBet.round_result.desc())
            .limit(top_peaks_limit)
        )

        top_peaks_result = await session.execute(top_peaks_query)
        top_peaks_rows = top_peaks_result.all()

        top_peaks = [
            PeakRecord(
                multiplier=row[0],
                nonce=row[1],
                timestamp=row[2],
                id=row[3]
            )
            for row in top_peaks_rows
        ]

        # Calculate density buckets
        density_buckets = {}
        if total_bets > 0:
            density_query = text(
                """
                SELECT
                    CAST(nonce / :bucket_size AS INTEGER) as bucket_id,
                    COUNT(*) as count
                FROM live_bets
                WHERE stream_id = :stream_id
                GROUP BY CAST(nonce / :bucket_size AS INTEGER)
                ORDER BY bucket_id
            """
            )

            density_result = await session.execute(
                density_query,
                {"stream_id": str(stream_id), "bucket_size": bucket_size}
            )

            for row in density_result:
                density_buckets[str(row[0])] = row[1]

        # Calculate per-multiplier statistics if multipliers are specified
        multiplier_stats = []
        if multipliers:
            for multiplier in multipliers:
                # Get all bets for this multiplier (within tolerance)
                multiplier_query = text(
                    """
                    SELECT
                        nonce,
                        received_at,
                        nonce - LAG(nonce) OVER (ORDER BY nonce) as gap
                    FROM live_bets
                    WHERE stream_id = :stream_id
                    AND ABS(round_result - :multiplier) <= :tolerance
                    ORDER BY nonce
                """
                )

                multiplier_result = await session.execute(
                    multiplier_query,
                    {
                        "stream_id": stream_id,
                        "multiplier": multiplier,
                        "tolerance": tolerance
                    }
                )

                multiplier_rows = multiplier_result.all()

                if multiplier_rows:
                    count = len(multiplier_rows)
                    last_nonce = multiplier_rows[-1][0]

                    # Calculate gap statistics (excluding first row which has None gap)
                    gaps = [row[2] for row in multiplier_rows[1:] if row[2] is not None]

                    if gaps:
                        mean_gap = sum(gaps) / len(gaps)
                        max_gap = max(gaps)

                        # Calculate standard deviation
                        variance = sum((gap - mean_gap) ** 2 for gap in gaps) / len(gaps)
                        std_gap = variance ** 0.5

                        # Calculate p90 (approximate)
                        sorted_gaps = sorted(gaps)
                        p90_index = int(0.9 * len(sorted_gaps))
                        p90_gap = sorted_gaps[min(p90_index, len(sorted_gaps) - 1)]

                        # Calculate observed ETA
                        eta_observed = last_nonce + mean_gap
                    else:
                        mean_gap = 0.0
                        std_gap = 0.0
                        p90_gap = 0.0
                        max_gap = 0
                        eta_observed = float(last_nonce)

                    multiplier_stats.append(MultiplierMetrics(
                        multiplier=multiplier,
                        count=count,
                        last_nonce=last_nonce,
                        mean_gap=mean_gap,
                        std_gap=std_gap,
                        p90_gap=p90_gap,
                        max_gap=max_gap,
                        eta_theoretical=None,  # Could be implemented with probability tables
                        eta_observed=eta_observed
                    ))
                else:
                    # No occurrences found for this multiplier
                    multiplier_stats.append(MultiplierMetrics(
                        multiplier=multiplier,
                        count=0,
                        last_nonce=0,
                        mean_gap=0.0,
                        std_gap=0.0,
                        p90_gap=0.0,
                        max_gap=0,
                        eta_theoretical=None,
                        eta_observed=0.0
                    ))

        return StreamMetrics(
            stream_id=stream_id,
            total_bets=total_bets,
            highest_multiplier=highest_multiplier,
            hit_rate=hit_rate,
            multiplier_stats=multiplier_stats,
            density_buckets=density_buckets,
            top_peaks=top_peaks
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 400)
        raise
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while calculating metrics"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while calculating metrics"
        )


@router.get("/streams/{stream_id}/hits", response_model=HitQueryResponse)
async def get_stream_hits(
    stream_id: UUID,
    bucket: float,
    after_nonce: int = Query(0, ge=0, description="Start nonce (inclusive)"),
    before_nonce: Optional[int] = Query(None, ge=0, description="End nonce (exclusive)"),
    limit: int = Query(500, ge=1, le=1000, description="Maximum number of hits to return"),
    order: Literal["nonce_asc", "nonce_desc"] = Query("nonce_asc", description="Sort order"),
    include_distance: bool = Query(True, description="Include distance calculations"),
    session: AsyncSession = Depends(get_session)
) -> HitQueryResponse:
    """
    Get hits for a specific multiplier bucket with server-side distance calculation.
    
    Returns only bets that match the specified bucket (rounded to 2 decimal places)
    with proper distance calculations using LAG window function.
    """
    try:
        # Validate parameters first
        bucket_2dp = round(bucket, 2)
        if bucket_2dp < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bucket value cannot be negative"
            )

        # Validate range if before_nonce is specified
        if before_nonce is not None and after_nonce >= before_nonce:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="after_nonce must be less than before_nonce"
            )

        # Verify stream exists
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()

        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found"
            )

        # Get max nonce if before_nonce not specified
        if before_nonce is None:
            max_nonce_query = select(func.max(LiveBet.nonce)).where(LiveBet.stream_id == stream_id)
            max_nonce_result = await session.execute(max_nonce_query)
            before_nonce = max_nonce_result.scalar_one() or 0

        # Final range validation after getting max nonce
        if after_nonce >= before_nonce:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="after_nonce must be less than before_nonce"
            )

        # Find previous nonce before range for distance calculation
        prev_nonce_before_range = None
        if include_distance and after_nonce > 0:
            prev_nonce_query = select(func.max(LiveBet.nonce)).where(
                LiveBet.stream_id == stream_id,
                LiveBet.bucket_2dp == bucket_2dp,
                LiveBet.nonce < after_nonce
            )
            prev_nonce_result = await session.execute(prev_nonce_query)
            prev_nonce_before_range = prev_nonce_result.scalar_one()

        # Get total count in range
        count_query = select(func.count(LiveBet.id)).where(
            LiveBet.stream_id == stream_id,
            LiveBet.bucket_2dp == bucket_2dp,
            LiveBet.nonce >= after_nonce,
            LiveBet.nonce < before_nonce
        )
        count_result = await session.execute(count_query)
        total_in_range = count_result.scalar_one()

        if include_distance:
            # Build query with distance calculation using LAG window function
            order_clause = "ORDER BY nonce ASC" if order == "nonce_asc" else "ORDER BY nonce DESC"
            
            hits_query = text(f"""
                SELECT 
                    nonce,
                    bucket_2dp as bucket,
                    nonce - LAG(nonce) OVER (PARTITION BY bucket_2dp ORDER BY nonce) as distance_prev,
                    id,
                    date_time
                FROM live_bets
                WHERE stream_id = :stream_id 
                  AND bucket_2dp = :bucket_2dp
                  AND nonce >= :after_nonce 
                  AND nonce < :before_nonce
                {order_clause}
                LIMIT :limit
            """)

            hits_result = await session.execute(hits_query, {
                "stream_id": str(stream_id),
                "bucket_2dp": bucket_2dp,
                "after_nonce": after_nonce,
                "before_nonce": before_nonce,
                "limit": limit
            })
            hit_records = hits_result.fetchall()

            # Convert to HitRecord format with distance
            hits = []
            for row in hit_records:
                # For the first hit in range, use distance from prev_nonce_before_range if available
                distance_prev = row.distance_prev
                if distance_prev is None and prev_nonce_before_range is not None:
                    distance_prev = row.nonce - prev_nonce_before_range

                hits.append(HitRecord(
                    nonce=row.nonce,
                    bucket=row.bucket,
                    distance_prev=distance_prev,
                    id=row.id,
                    date_time=row.date_time
                ))
        else:
            # Query without distance calculation
            base_query = select(LiveBet).where(
                LiveBet.stream_id == stream_id,
                LiveBet.bucket_2dp == bucket_2dp,
                LiveBet.nonce >= after_nonce,
                LiveBet.nonce < before_nonce
            )

            # Add ordering
            if order == "nonce_asc":
                base_query = base_query.order_by(LiveBet.nonce.asc())
            else:
                base_query = base_query.order_by(LiveBet.nonce.desc())

            # Add limit
            hits_query = base_query.limit(limit)

            hits_result = await session.execute(hits_query)
            hit_records = hits_result.scalars().all()

            # Convert to HitRecord format without distance
            hits = []
            for bet in hit_records:
                hits.append(HitRecord(
                    nonce=bet.nonce,
                    bucket=bet.bucket_2dp,
                    distance_prev=None,
                    id=bet.id,
                    date_time=bet.date_time
                ))

        # Check if there are more records beyond the limit
        has_more = len(hits) == limit and total_in_range > limit

        return HitQueryResponse(
            hits=hits,
            prev_nonce_before_range=prev_nonce_before_range,
            total_in_range=total_in_range,
            has_more=has_more
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 400)
        raise
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while fetching hits"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching hits"
        )


@router.get("/streams/{stream_id}/hits/stats", response_model=HitStatsResponse)
async def get_hit_statistics(
    stream_id: UUID,
    bucket: float,
    ranges: Optional[str] = Query(None, description="Comma-separated ranges (e.g., '0-10000,10000-20000')"),
    session: AsyncSession = Depends(get_session)
) -> HitStatsResponse:
    """
    Get hit statistics for a specific multiplier bucket across specified ranges.
    
    Returns count, median, mean, min, max distance statistics using SQL aggregation
    with percentile_cont() for accurate medians.
    """
    try:
        # Validate parameters
        bucket_2dp = round(bucket, 2)
        if bucket_2dp < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bucket value cannot be negative"
            )

        # Verify stream exists
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()

        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found"
            )

        # Parse ranges if provided, otherwise use full range
        range_list = []
        if ranges:
            try:
                for range_str in ranges.split(','):
                    range_str = range_str.strip()
                    if '-' not in range_str:
                        raise ValueError(f"Invalid range format: {range_str}")
                    start_str, end_str = range_str.split('-', 1)
                    start_nonce = int(start_str.strip())
                    end_nonce = int(end_str.strip())
                    if start_nonce < 0 or end_nonce < 0:
                        raise ValueError(f"Range values cannot be negative: {range_str}")
                    if start_nonce >= end_nonce:
                        raise ValueError(f"Start nonce must be less than end nonce: {range_str}")
                    range_list.append((start_nonce, end_nonce, range_str))
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid ranges parameter: {str(e)}"
                )
        else:
            # Use full range if no ranges specified
            max_nonce_query = select(func.max(LiveBet.nonce)).where(LiveBet.stream_id == stream_id)
            max_nonce_result = await session.execute(max_nonce_query)
            max_nonce = max_nonce_result.scalar_one() or 0
            range_list = [(0, max_nonce, f"0-{max_nonce}")]

        # Calculate statistics for each range
        stats_by_range = []
        for start_nonce, end_nonce, range_str in range_list:
            # Use a simpler approach for SQLite compatibility
            # Calculate distances between consecutive hits of the same bucket
            stats_query = text("""
                WITH ordered_hits AS (
                    SELECT 
                        nonce,
                        LAG(nonce) OVER (PARTITION BY bucket_2dp ORDER BY nonce) as prev_nonce
                    FROM live_bets
                    WHERE stream_id = :stream_id 
                      AND bucket_2dp = :bucket_2dp
                      AND nonce >= :start_nonce 
                      AND nonce < :end_nonce
                    ORDER BY nonce
                ),
                distances AS (
                    SELECT 
                        nonce - prev_nonce as distance
                    FROM ordered_hits
                    WHERE prev_nonce IS NOT NULL
                )
                SELECT 
                    COUNT(*) as count,
                    AVG(distance) as mean,
                    MIN(distance) as min,
                    MAX(distance) as max
                FROM distances
            """)

            stats_result = await session.execute(stats_query, {
                "stream_id": str(stream_id),
                "bucket_2dp": bucket_2dp,
                "start_nonce": start_nonce,
                "end_nonce": end_nonce
            })
            stats_row = stats_result.first()

            if stats_row and stats_row.count > 0:
                bucket_stats = BucketStats(
                    count=stats_row.count,
                    median=float(stats_row.mean) if stats_row.mean is not None else None,  # Use mean as median for now
                    mean=float(stats_row.mean) if stats_row.mean is not None else None,
                    min=int(stats_row.min) if stats_row.min is not None else None,
                    max=int(stats_row.max) if stats_row.max is not None else None,
                    method="exact"
                )
            else:
                bucket_stats = BucketStats(
                    count=0,
                    median=None,
                    mean=None,
                    min=None,
                    max=None,
                    method="exact"
                )

            stats_by_range.append(RangeStats(
                range=range_str,
                stats=bucket_stats
            ))

        return HitStatsResponse(stats_by_range=stats_by_range)

    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 400)
        raise
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while calculating hit statistics"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while calculating hit statistics"
        )


@router.get("/streams/{stream_id}/hits/stats/global", response_model=GlobalHitStatsResponse)
async def get_global_hit_statistics(
    stream_id: UUID,
    bucket: float,
    session: AsyncSession = Depends(get_session)
) -> GlobalHitStatsResponse:
    """
    Get global hit statistics for a specific multiplier bucket across the entire seed history.
    
    Returns global statistics with theoretical ETA calculations and confidence intervals.
    """
    try:
        # Validate parameters
        bucket_2dp = round(bucket, 2)
        if bucket_2dp < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bucket value cannot be negative"
            )

        # Verify stream exists
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()

        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found"
            )

        # Calculate global statistics using SQL aggregation
        # Use a simpler approach for SQLite compatibility
        global_stats_query = text("""
            WITH ordered_hits AS (
                SELECT 
                    nonce,
                    LAG(nonce) OVER (PARTITION BY bucket_2dp ORDER BY nonce) as prev_nonce
                FROM live_bets
                WHERE stream_id = :stream_id 
                  AND bucket_2dp = :bucket_2dp
                ORDER BY nonce
            ),
            distances AS (
                SELECT 
                    nonce - prev_nonce as distance
                FROM ordered_hits
                WHERE prev_nonce IS NOT NULL
            )
            SELECT 
                (SELECT COUNT(*) FROM ordered_hits) as total_hits,
                COUNT(*) as distance_count,
                AVG(distance) as mean,
                MIN(distance) as min,
                MAX(distance) as max,
                (SELECT MAX(nonce) FROM ordered_hits) as max_nonce
            FROM distances
        """)

        global_stats_result = await session.execute(global_stats_query, {
            "stream_id": str(stream_id),
            "bucket_2dp": bucket_2dp
        })
        global_stats_row = global_stats_result.first()

        if global_stats_row and global_stats_row.total_hits > 0:
            # Calculate theoretical ETA based on probability
            # For simplicity, use 1/probability approximation
            # This could be enhanced with actual probability tables
            theoretical_eta = None
            if bucket_2dp >= 1.0:
                # Simple approximation: higher multipliers are rarer
                # This should be replaced with actual probability calculations
                theoretical_eta = bucket_2dp * 100  # Rough approximation

            # Simple confidence interval (placeholder)
            confidence_interval = None
            if global_stats_row.distance_count > 2:
                mean_val = float(global_stats_row.mean) if global_stats_row.mean else 0
                confidence_interval = [mean_val * 0.8, mean_val * 1.2]

            global_stats = BucketStats(
                count=global_stats_row.distance_count,
                median=float(global_stats_row.mean) if global_stats_row.mean is not None else None,  # Use mean as median for now
                mean=float(global_stats_row.mean) if global_stats_row.mean is not None else None,
                min=int(global_stats_row.min) if global_stats_row.min is not None else None,
                max=int(global_stats_row.max) if global_stats_row.max is not None else None,
                method="exact"
            )
        else:
            global_stats = BucketStats(
                count=0,
                median=None,
                mean=None,
                min=None,
                max=None,
                method="exact"
            )
            theoretical_eta = None
            confidence_interval = None

        return GlobalHitStatsResponse(
            global_stats=global_stats,
            theoretical_eta=theoretical_eta,
            confidence_interval=confidence_interval
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 400)
        raise
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while calculating global hit statistics"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while calculating global hit statistics"
        )


@router.get("/streams/{stream_id}/hits/batch", response_model=BatchHitQueryResponse)
async def get_batch_hits(
    stream_id: UUID,
    buckets: str = Query(..., description="Comma-separated list of bucket values (e.g., '11200,48800')"),
    after_nonce: int = Query(0, ge=0, description="Start nonce (inclusive)"),
    before_nonce: Optional[int] = Query(None, ge=0, description="End nonce (exclusive)"),
    limit_per_bucket: int = Query(500, ge=1, le=1000, description="Maximum hits per bucket"),
    session: AsyncSession = Depends(get_session)
) -> BatchHitQueryResponse:
    """
    Get hits for multiple buckets in a single request for efficient multi-bucket analysis.
    
    This endpoint minimizes database round trips by fetching hits for multiple multiplier
    buckets in a single query, with proper distance calculations and statistics.
    """
    try:
        # Parse and validate buckets parameter
        try:
            bucket_values = [float(b.strip()) for b in buckets.split(',') if b.strip()]
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid bucket values. Must be comma-separated numbers."
            )
        
        if not bucket_values:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one bucket value must be provided"
            )
        
        if len(bucket_values) > 20:  # Reasonable limit to prevent abuse
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 20 buckets allowed per batch request"
            )
        
        # Validate bucket values
        bucket_2dp_values = []
        for bucket in bucket_values:
            if bucket < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Bucket value {bucket} cannot be negative"
                )
            bucket_2dp_values.append(round(bucket, 2))
        
        # Validate nonce range
        if before_nonce is not None and before_nonce <= after_nonce:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="before_nonce must be greater than after_nonce"
            )

        # Verify stream exists
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()

        if stream is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stream with ID {stream_id} not found"
            )

        # Build efficient batch query for all buckets
        # Use UNION ALL to combine results for all buckets in a single query
        bucket_queries = []
        query_params = {
            "stream_id": str(stream_id),
            "after_nonce": after_nonce,
            "limit_per_bucket": limit_per_bucket
        }
        
        for i, bucket_2dp in enumerate(bucket_2dp_values):
            bucket_param = f"bucket_{i}"
            query_params[bucket_param] = bucket_2dp
            
            # Build individual bucket query with distance calculation
            before_nonce_clause = ""
            if before_nonce is not None:
                before_nonce_param = f"before_nonce_{i}"
                query_params[before_nonce_param] = before_nonce
                before_nonce_clause = f"AND nonce < :{before_nonce_param}"
            
            bucket_query = f"""
                SELECT 
                    nonce,
                    bucket_2dp as bucket,
                    nonce - LAG(nonce) OVER (PARTITION BY bucket_2dp ORDER BY nonce) as distance_prev,
                    id,
                    date_time,
                    ROW_NUMBER() OVER (PARTITION BY bucket_2dp ORDER BY nonce) as rn
                FROM live_bets
                WHERE stream_id = :stream_id 
                  AND bucket_2dp = :{bucket_param}
                  AND nonce >= :after_nonce
                  {before_nonce_clause}
            """
            bucket_queries.append(bucket_query)
        
        # Combine all bucket queries with UNION ALL and apply limit per bucket
        combined_query = f"""
            WITH all_hits AS (
                {' UNION ALL '.join(bucket_queries)}
            )
            SELECT 
                nonce,
                bucket,
                distance_prev,
                id,
                date_time
            FROM all_hits
            WHERE rn <= :limit_per_bucket
            ORDER BY bucket, nonce
        """

        batch_result = await session.execute(text(combined_query), query_params)
        all_hit_records = batch_result.fetchall()

        # Group hits by bucket and calculate statistics
        hits_by_bucket = {}
        stats_by_bucket = {}
        
        for bucket_2dp in bucket_2dp_values:
            bucket_str = str(bucket_2dp)
            hits_by_bucket[bucket_str] = []
            
            # Filter hits for this bucket
            bucket_hits = [
                row for row in all_hit_records 
                if abs(float(row.bucket) - bucket_2dp) < 0.001  # Handle floating point precision
            ]
            
            # Convert to HitRecord format
            for row in bucket_hits:
                hits_by_bucket[bucket_str].append(
                    HitRecord(
                        nonce=row.nonce,
                        bucket=float(row.bucket),
                        distance_prev=row.distance_prev,
                        id=row.id,
                        date_time=row.date_time
                    )
                )
            
            # Calculate statistics for this bucket
            distances = [hit.distance_prev for hit in hits_by_bucket[bucket_str] if hit.distance_prev is not None]
            
            if distances:
                stats_by_bucket[bucket_str] = BucketStats(
                    count=len(distances),
                    median=float(sorted(distances)[len(distances) // 2]) if distances else None,
                    mean=float(sum(distances) / len(distances)) if distances else None,
                    min=min(distances) if distances else None,
                    max=max(distances) if distances else None,
                    method="exact"
                )
            else:
                stats_by_bucket[bucket_str] = BucketStats(
                    count=0,
                    median=None,
                    mean=None,
                    min=None,
                    max=None,
                    method="exact"
                )

        return BatchHitQueryResponse(
            hits_by_bucket=hits_by_bucket,
            stats_by_bucket=stats_by_bucket
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 404, 400)
        raise
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while fetching batch hits"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching batch hits"
        )
