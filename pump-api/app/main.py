from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .db import create_db_and_tables


settings = get_settings()

app = FastAPI(title="Pump Analyzer Web API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.api_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await create_db_and_tables()


from .routers import runs, verify, live_streams

app.include_router(runs.router)
app.include_router(verify.router)
app.include_router(live_streams.router)


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
        from .routers.live_streams import router as live_streams_router
        
        # Verify the router is included (basic integration check)
        live_streams_routes = [route.path for route in live_streams_router.routes]
        expected_routes = ["/ingest", "/streams", "/streams/{stream_id}"]
        
        # Check that key routes are present
        has_required_routes = all(
            any(expected in route for route in live_streams_routes) 
            for expected in expected_routes
        )
        
        if not has_required_routes:
            return {"status": "degraded", "error": "Live streams routes not properly configured"}
        
        return {"status": "ok"}
        
    except ImportError as e:
        return {"status": "degraded", "error": "Live streams functionality not available"}
    except Exception as e:
        return {"status": "degraded", "error": "Health check failed"}
