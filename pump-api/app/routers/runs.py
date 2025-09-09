from __future__ import annotations

import hashlib
import json
import math
from typing import Any, Dict, Iterable, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import func, insert, text
from sqlmodel import select

from ..core.config import get_settings
from ..db import get_session
from ..engine.pump import ENGINE_VERSION, scan_pump, verify_pump
from ..models.runs import Hit, Run
from ..schemas.runs import (
    HitRow,
    HitsPage,
    RunCreate,
    RunDetail,
    RunRead,
    DistanceStatsPayload,
)
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/runs", tags=["runs"])

settings = get_settings()

ALLOWED_DIFFICULTIES = {"easy", "medium", "hard", "expert"}


def _error_response(
    message: str,
    status_code: int,
    code: str = "VALIDATION_ERROR",
    field: Optional[str] = None,
) -> JSONResponse:
    payload: Dict[str, Any] = {"error": {"code": code, "message": message}}
    if field is not None:
        payload["error"]["field"] = field
    return JSONResponse(status_code=status_code, content=payload)


def _sanitize_targets(raw_targets: List[float]) -> List[float]:
    cleaned: List[float] = []
    for t in raw_targets:
        try:
            f = float(t)
        except Exception:
            continue
        if math.isnan(f):
            continue
        cleaned.append(f)
    # unique + sorted for determinism
    return sorted(set(cleaned))


@router.post("", response_model=RunDetail, status_code=status.HTTP_201_CREATED)
async def create_run(body: RunCreate, session: AsyncSession = Depends(get_session)):
    # Basic validation
    if not body.server_seed or not body.server_seed.strip():
        return _error_response("server_seed is required", 422, field="server_seed")
    if not body.client_seed or not body.client_seed.strip():
        return _error_response("client_seed is required", 422, field="client_seed")
    if body.start < 1:
        return _error_response("start must be >= 1", 422, field="start")
    if body.end < body.start:
        return _error_response("end must be >= start", 422, field="end")
    count = body.end - body.start + 1
    if count > settings.max_nonces:
        return _error_response(
            f"Range too large (>{settings.max_nonces})", 413, code="RANGE_TOO_LARGE"
        )
    if body.difficulty not in ALLOWED_DIFFICULTIES:
        return _error_response("Invalid difficulty", 422, field="difficulty")

    targets = _sanitize_targets(body.targets)
    if not targets:
        return _error_response("targets must be a non-empty list", 422, field="targets")

    # Run engine scan (synchronous)
    try:
        hits_by_target, summary = scan_pump(
            body.server_seed,
            body.client_seed,
            body.start,
            body.end,
            body.difficulty,
            targets,
        )
    except Exception as exc:  # pragma: no cover - safeguard
        return _error_response(str(exc), 500, code="ENGINE_ERROR")

    # Persist Run
    server_seed_sha256 = hashlib.sha256(body.server_seed.encode("utf-8")).hexdigest()
    run = Run(
        server_seed=body.server_seed,
        server_seed_sha256=server_seed_sha256,
        client_seed=body.client_seed,
        nonce_start=body.start,
        nonce_end=body.end,
        difficulty=body.difficulty,
        targets_json=json.dumps(summary.get("targets", targets)),
        duration_ms=int(summary.get("duration_ms", 0)),
        engine_version=ENGINE_VERSION,
        summary_json=json.dumps(summary),
    )

    session.add(run)
    await session.commit()
    await session.refresh(run)

    # Prepare bulk insert for hits (nonce + max_multiplier) deduped across targets
    nonce_set: set[int] = set()
    for nonce_list in hits_by_target.values():
        for n in nonce_list:
            nonce_set.add(n)

    hits_data: List[Dict[str, Any]] = []
    for nonce in sorted(nonce_set):
        try:
            res = verify_pump(
                body.server_seed, body.client_seed, nonce, body.difficulty
            )
            max_multiplier = float(res["max_multiplier"])  # ensure JSON-serializable
        except Exception as exc:  # pragma: no cover - safeguard
            return _error_response(str(exc), 500, code="ENGINE_ERROR")
        hits_data.append(
            {"run_id": run.id, "nonce": nonce, "max_multiplier": max_multiplier}
        )

    if hits_data:
        await session.execute(insert(Hit).values(hits_data))
        await session.commit()

    # Build response
    detail = RunDetail(
        id=run.id,
        created_at=run.created_at,
        server_seed_sha256=run.server_seed_sha256,
        server_seed=run.server_seed,
        client_seed=run.client_seed,
        difficulty=run.difficulty,
        nonce_start=run.nonce_start,
        nonce_end=run.nonce_end,
        duration_ms=run.duration_ms,
        engine_version=run.engine_version,
        targets=json.loads(run.targets_json),
        summary=json.loads(run.summary_json),
    )
    return detail


from ..schemas.runs import RunListResponse

@router.get("", response_model=RunListResponse)
async def list_runs(
    session: AsyncSession = Depends(get_session),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
):
    # Build base query
    base_query = select(Run)
    if search:
        base_query = base_query.where(Run.client_seed.contains(search))
    if difficulty:
        if difficulty not in ALLOWED_DIFFICULTIES:
            return _error_response("Invalid difficulty", 422, field="difficulty")
        base_query = base_query.where(Run.difficulty == difficulty)

    # Get total count
    count_query = select(func.count(Run.id))
    if search:
        count_query = count_query.where(Run.client_seed.contains(search))
    if difficulty:
        count_query = count_query.where(Run.difficulty == difficulty)

    total_result = await session.execute(count_query)
    total = int(total_result.scalar())

    # Get paginated results
    query = base_query.order_by(Run.created_at.desc()).offset(offset).limit(limit)
    result = await session.execute(query)
    rows = result.scalars().all()

    runs: List[RunRead] = []
    for r in rows:
        summary = json.loads(r.summary_json)
        runs.append(
            RunRead(
                id=r.id,
                created_at=r.created_at,
                server_seed_sha256=r.server_seed_sha256,
                client_seed=r.client_seed,
                difficulty=r.difficulty,
                nonce_start=r.nonce_start,
                nonce_end=r.nonce_end,
                duration_ms=r.duration_ms,
                engine_version=r.engine_version,
                targets=json.loads(r.targets_json),
                counts_by_target=summary.get("counts_by_target", {}),
            )
        )

    return RunListResponse(runs=runs, total=total)


@router.get("/{run_id}", response_model=RunDetail)
async def get_run(run_id: UUID, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Run).where(Run.id == run_id))
    run = result.scalars().first()
    if not run:
        return _error_response("Run not found", 404, code="NOT_FOUND")

    return RunDetail(
        id=run.id,
        created_at=run.created_at,
        server_seed_sha256=run.server_seed_sha256,
        server_seed=run.server_seed,
        client_seed=run.client_seed,
        difficulty=run.difficulty,
        nonce_start=run.nonce_start,
        nonce_end=run.nonce_end,
        duration_ms=run.duration_ms,
        engine_version=run.engine_version,
        targets=json.loads(run.targets_json),
        summary=json.loads(run.summary_json),
    )


@router.get("/{run_id}/hits", response_model=HitsPage)
async def get_hits(
    run_id: UUID,
    session: AsyncSession = Depends(get_session),
    min_multiplier: Optional[float] = Query(None),
    limit: int = Query(100, ge=1, le=10_000),
    offset: int = Query(0, ge=0),
    include_distance: Optional[str] = Query(
        None,
        description="Set to 'per_multiplier' to include distance_prev per multiplier",
    ),
    tol: float = Query(1e-9, ge=0.0),
):
    # Ensure run exists
    r = (await session.execute(select(Run.id).where(Run.id == run_id))).scalars().first()
    if not r:
        return _error_response("Run not found", 404, code="NOT_FOUND")

    where = [Hit.run_id == run_id]
    if min_multiplier is not None:
        where.append(Hit.max_multiplier >= float(min_multiplier))

    # Count total for pagination
    total_q = select(func.count()).select_from(Hit).where(*where)
    total_res = await session.execute(total_q)
    total = int(total_res.scalar())

    # If distance not requested, return regular rows
    if include_distance != "per_multiplier":
        rows_q = (
            select(Hit).where(*where).order_by(Hit.nonce).offset(offset).limit(limit)
        )
        rows_res = await session.execute(rows_q)
        rows = rows_res.scalars().all()
        return HitsPage(
            total=total,
            rows=[HitRow(nonce=h.nonce, max_multiplier=h.max_multiplier) for h in rows],
        )

    # Include per-multiplier distance_prev using SQLAlchemy window function
    lag_prev = func.lag(Hit.nonce).over(
        partition_by=Hit.max_multiplier, order_by=Hit.nonce
    )
    distance_prev = (Hit.nonce - lag_prev).label("distance_prev")

    stmt = (
        select(Hit.nonce, Hit.max_multiplier, distance_prev)
        .where(*where)
        .order_by(Hit.nonce)
        .offset(offset)
        .limit(limit)
    )
    res = await session.execute(stmt)
    rows = res.all()

    payload_rows: list[HitRow] = []
    for nonce, max_multiplier, dp in rows:
        payload_rows.append(
            HitRow(
                nonce=int(nonce),
                max_multiplier=float(max_multiplier),
                distance_prev=int(dp) if dp is not None else None,
            )
        )

    return HitsPage(total=total, rows=payload_rows)


@router.get("/{run_id}/distances", response_model=DistanceStatsPayload)
async def get_distances(
    run_id: UUID,
    multiplier: float = Query(...),
    tol: float = Query(1e-9, ge=0.0),
    session: AsyncSession = Depends(get_session),
):
    # Ensure run exists
    r = (
        (await session.execute(select(Run.id).where(Run.id == run_id)))
        .scalars()
        .first()
    )
    if not r:
        return _error_response("Run not found", 404, code="NOT_FOUND")

    # Query all nonces for this multiplier within tolerance
    low = float(multiplier) - float(tol)
    high = float(multiplier) + float(tol)
    nonce_stmt = (
        select(Hit.nonce)
        .where(
            Hit.run_id == run_id,
            Hit.max_multiplier >= low,
            Hit.max_multiplier <= high,
        )
        .order_by(Hit.nonce)
    )
    res = await session.execute(nonce_stmt)
    nonce_rows = [int(n) for n in res.scalars().all()]

    count = len(nonce_rows)
    if count < 2:
        # With <2 occurrences, distances/stats are empty
        return DistanceStatsPayload(
            multiplier=float(multiplier),
            tol=float(tol),
            count=count,
            nonces=nonce_rows,
            distances=[],
            stats={},
        )

    # Compute distances vector
    distances: list[int] = [nonce_rows[i] - nonce_rows[i - 1] for i in range(1, count)]

    # Compute stats
    sorted_d = sorted(distances)
    n = len(sorted_d)
    mean_v = sum(sorted_d) / n
    # median
    if n % 2 == 0:
        median_v = (sorted_d[n // 2 - 1] + sorted_d[n // 2]) / 2
    else:
        median_v = sorted_d[n // 2]
    min_v = sorted_d[0]
    max_v = sorted_d[-1]

    # nearest-rank percentiles
    def nearest_rank(p: float) -> int:
        if n == 0:
            return 0
        k = max(1, int(math.ceil(p * n / 100)))
        return sorted_d[k - 1]

    p90_v = nearest_rank(90)
    p99_v = nearest_rank(99)
    # population stddev
    variance = sum((d - mean_v) ** 2 for d in sorted_d) / n
    stddev_v = math.sqrt(variance)
    cv_v = (stddev_v / mean_v) if mean_v > 0 else 0.0

    stats = {
        "mean": round(mean_v, 10),
        "median": median_v,
        "min": min_v,
        "max": max_v,
        "p90": p90_v,
        "p99": p99_v,
        "stddev": round(stddev_v, 10),
        "cv": round(cv_v, 10),
    }

    return DistanceStatsPayload(
        multiplier=float(multiplier),
        tol=float(tol),
        count=count,
        nonces=nonce_rows,
        distances=distances,
        stats=stats,
    )


@router.get("/{run_id}/distances.csv")
async def export_distances_csv(
    run_id: UUID,
    multiplier: float = Query(...),
    tol: float = Query(1e-9, ge=0.0),
    session: AsyncSession = Depends(get_session),
):
    # Ensure run exists
    r = (
        (await session.execute(select(Run.id).where(Run.id == run_id)))
        .scalars()
        .first()
    )
    if not r:
        return _error_response("Run not found", 404, code="NOT_FOUND")

    # Fetch ordered nonces
    low = float(multiplier) - float(tol)
    high = float(multiplier) + float(tol)
    nonce_stmt = (
        select(Hit.nonce)
        .where(
            Hit.run_id == run_id,
            Hit.max_multiplier >= low,
            Hit.max_multiplier <= high,
        )
        .order_by(Hit.nonce)
    )
    res = await session.execute(nonce_stmt)
    nonces = [int(n) for n in res.scalars().all()]

    async def streamer() -> Iterable[str]:
        yield "from_nonce,distance\n"
        if len(nonces) < 2:
            return
        prev = nonces[0]
        for current in nonces[1:]:
            yield f"{prev},{current - prev}\n"
            prev = current

    return StreamingResponse(
        streamer(),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=distances.csv",
        },
    )


@router.get("/{run_id}/export/hits.csv")
async def export_hits_csv(run_id: UUID, session: AsyncSession = Depends(get_session)):
    # Ensure run exists
    r = (await session.execute(select(Run.id).where(Run.id == run_id))).scalars().first()
    if not r:
        return _error_response("Run not found", 404, code="NOT_FOUND")

    async def streamer() -> Iterable[str]:
        yield "nonce,max_multiplier\n"
        chunk = 10_000
        offset_local = 0
        while True:
            q = (
                select(Hit)
                .where(Hit.run_id == run_id)
                .order_by(Hit.nonce)
                .offset(offset_local)
                .limit(chunk)
            )
            res = await session.execute(q)
            hits = res.scalars().all()
            if not hits:
                break
            for h in hits:
                yield f"{h.nonce},{h.max_multiplier}\n"
            offset_local += len(hits)

    return StreamingResponse(
        streamer(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=hits.csv"},
    )


@router.get("/{run_id}/export/full.csv")
async def export_full_csv(run_id: UUID, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Run).where(Run.id == run_id))
    run = result.scalars().first()
    if not run:
        return _error_response("Run not found", 404, code="NOT_FOUND")

    async def streamer() -> Iterable[str]:
        yield "nonce,max_pumps,max_multiplier,pop_point\n"
        for nonce in range(run.nonce_start, run.nonce_end + 1):
            res = verify_pump(run.server_seed, run.client_seed, nonce, run.difficulty)
            yield f"{nonce},{res['max_pumps']},{res['max_multiplier']},{res['pop_point']}\n"

    return StreamingResponse(
        streamer(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=full.csv"},
    )
