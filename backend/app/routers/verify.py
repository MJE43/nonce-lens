from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query

from ..engine.pump import verify_pump


router = APIRouter(tags=["verify"])


@router.get("/verify")
async def verify(
    server_seed: str = Query(...),
    client_seed: str = Query(...),
    nonce: int = Query(..., ge=1),
    difficulty: str = Query(...),
) -> Dict[str, Any]:
    if not server_seed or not server_seed.strip():
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "server_seed is required",
                    "field": "server_seed",
                }
            },
        )
    if not client_seed or not client_seed.strip():
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "client_seed is required",
                    "field": "client_seed",
                }
            },
        )
    if nonce < 1:
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "nonce must be >= 1",
                    "field": "nonce",
                }
            },
        )

    try:
        return verify_pump(server_seed, client_seed, nonce, difficulty)
    except Exception as exc:  # pragma: no cover - safeguard
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "ENGINE_ERROR", "message": str(exc)}},
        )
