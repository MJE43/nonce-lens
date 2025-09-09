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


from .routers import runs, verify

app.include_router(runs.router)
app.include_router(verify.router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
