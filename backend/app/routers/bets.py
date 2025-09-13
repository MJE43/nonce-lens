from __future__ import annotations

from typing import Optional, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select, func
from sqlalchemy import text

from ..db import get_session
from ..models.live_streams import LiveStream, LiveBet
from ..schemas.live_streams import (
    BetListResponse,
    BetRecord,
    TailResponse,
)

router = APIRouter(prefix="/live", tags=["live-streams"])


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
            status_code=400,
            detail="Limit cannot exceed 1000"
        )

    if limit < 1:
        raise HTTPException(
            status_code=400,
            detail="Limit must be at least 1"
        )

    if offset < 0:
        raise HTTPException(
            status_code=400,
            detail="Offset cannot be negative"
        )

    if min_multiplier is not None and min_multiplier < 0:
        raise HTTPException(
            status_code=400,
            detail="min_multiplier cannot be negative"
        )

    try:
        # Verify stream exists
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()

        if stream is None:
            raise HTTPException(
                status_code=404,
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
            status_code=500,
            detail="Database error occurred while fetching bets"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
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
            status_code=400,
            detail="since_id cannot be negative"
        )

    try:
        # Verify stream exists
        stream_query = select(LiveStream).where(LiveStream.id == stream_id)
        stream_result = await session.execute(stream_query)
        stream = stream_result.scalar_one_or_none()

        if stream is None:
            raise HTTPException(
                status_code=404,
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
            status_code=500,
            detail="Database error occurred while fetching tail updates"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while fetching tail updates"
        )
