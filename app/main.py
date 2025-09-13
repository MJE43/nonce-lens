from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .db import create_db_and_tables


settings = get_settings()

app = FastAPI(title="Pump Analyzer Web API", version="1.0.0")

# CORS configuration with specific headers for live streams
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.api_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Ingest-Token",  # Specific header for live streams ingestion
        "X-Requested-With",
        "Origin",
        "Referer",
        "User-Agent"
    ],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "Retry-After"
    ]
)


@app.on_event("startup")
async def on_startup():
    await create_db_and_tables()

    # Start periodic cleanup for rate limiter
    import asyncio
    from .core.rate_limiter import get_rate_limiter

    async def cleanup_rate_limiter():
        """Periodic cleanup of rate limiter to prevent memory leaks."""
        while True:
            try:
                # Clean up every 5 minutes
                await asyncio.sleep(300)
                rate_limiter = get_rate_limiter(settings.ingest_rate_limit)
                rate_limiter.cleanup_old_entries()
            except Exception as e:
                # Log error but don't crash the cleanup task
                print(f"Rate limiter cleanup error: {e}")

    # Start cleanup task in background
    asyncio.create_task(cleanup_rate_limiter())


from .routers import runs, verify, streams, bets, bookmarks, snapshots, metrics

app.include_router(runs.router)
app.include_router(verify.router)
app.include_router(streams.router)
app.include_router(bets.router)
app.include_router(bookmarks.router)
app.include_router(snapshots.router)
app.include_router(metrics.router)


@app.get("/healthz")
async def healthz():
    """
    Health check endpoint with live streams functionality verification.

    Returns overall system status. Enhanced to verify live streams functionality
    is properly integrated and accessible.
    """
    try:
        # Test that live streams models and router are properly imported
        from .models.live_streams import LiveStream, LiveBet
        from .routers.streams import router as streams_router

        # Verify the router is included (basic integration check)
        streams_routes = [route.path for route in streams_router.routes]
        expected_routes = ["/ingest", "/streams", "/streams/{stream_id}"]

        # Check that key routes are present
        has_required_routes = all(
            any(expected in route for route in streams_routes)
            for expected in expected_routes
        )

        if not has_required_routes:
            return {"status": "degraded", "error": "Live streams routes not properly configured"}

        return {"status": "ok"}

    except ImportError as e:
        return {"status": "degraded", "error": "Live streams functionality not available"}
    except Exception as e:
        return {"status": "degraded", "error": "Health check failed"}
