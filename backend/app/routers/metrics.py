from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select, func
from sqlalchemy import text

from ..db import get_session
from ..models.live_streams import LiveStream, LiveBet
from ..schemas.live_streams import (
    StreamMetrics,
    MultiplierMetrics,
    PeakRecord,
)

router = APIRouter(prefix="/live", tags=["live-streams"])


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
            status_code=400,
            detail="tolerance must be greater than 0"
        )

    if bucket_size <= 0:
        raise HTTPException(
            status_code=400,
            detail="bucket_size must be greater than 0"
        )

    if top_peaks_limit <= 0 or top_peaks_limit > 100:
        raise HTTPException(
            status_code=400,
            detail="top_peaks_limit must be between 1 and 100"
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
            status_code=500,
            detail="Database error occurred while calculating metrics"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while calculating metrics"
        )
