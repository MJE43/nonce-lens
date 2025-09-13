from __future__ import annotations

from datetime import datetime
import json
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select, func

from ..db import get_session
from ..models.live_streams import LiveStream, LiveBet, LiveSnapshot
from ..schemas.live_streams import (
    SnapshotCreate,
    SnapshotResponse,
    SnapshotDeleteResponse,
    BetListResponse,
    BetRecord,
)

router = APIRouter(prefix="/live", tags=["live-streams"])


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
                status_code=404,
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
                status_code=400,
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
            status_code=400,
            detail="Invalid filter_state JSON format"
        )
    except SQLAlchemyError as e:
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while creating snapshot"
        )
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=500,
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
                status_code=404,
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
            status_code=500,
            detail="Invalid filter_state data in database"
        )
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while fetching snapshots"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
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
                status_code=404,
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
                status_code=404,
                detail=f"Snapshot with ID {snapshot_id} not found in stream"
            )

        # Parse filter state
        try:
            filter_state = json.loads(snapshot.filter_state)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=500,
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
            status_code=500,
            detail="Database error occurred while replaying snapshot"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
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
                status_code=404,
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
            status_code=500,
            detail="Database error occurred while deleting snapshot"
        )
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while deleting snapshot"
        )
