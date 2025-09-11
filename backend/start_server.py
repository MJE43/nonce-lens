#!/usr/bin/env python3
"""
Startup script for Pump Analyzer API server.

Uses configuration from environment variables to bind to the specified
host and port for local-only access by default.
"""

import uvicorn
from app.core.config import get_settings


def main():
    """Start the API server with configured host and port."""
    settings = get_settings()
    
    print(f"Starting Pump Analyzer API server...")
    print(f"Host: {settings.api_host}")
    print(f"Port: {settings.api_port}")
    print(f"CORS Origins: {', '.join(settings.api_cors_origins)}")
    print(f"Ingest Token: {'Configured' if settings.ingest_token else 'Not configured (open access)'}")
    print(f"Rate Limit: {settings.ingest_rate_limit} requests/minute")
    print(f"Max Nonces: {settings.max_nonces:,}")
    print()
    
    # Start the server with configured settings
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
        log_level="info",
        access_log=True
    )


if __name__ == "__main__":
    main()