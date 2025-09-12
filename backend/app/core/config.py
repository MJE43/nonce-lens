from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./db.sqlite3"
    api_cors_origins: list[str] = ["http://localhost:5173"]
    max_nonces: int = 500_000
    ingest_token: str | None = None
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    ingest_rate_limit: int = 60  # per minute
    testing: bool = False


# Note: this is a singleton
_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
