"""
Prismiq Demo Backend - FastAPI Application.

This module provides a demo FastAPI application showcasing
Prismiq's embedded analytics capabilities.

Run with:
    DATABASE_URL=postgresql://... python main.py
"""

from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Add the packages/python directory to path for development
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../packages/python"))

from prismiq import PrismiqEngine, create_router
from prismiq.cache import RedisCache

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

# Global engine
engine: PrismiqEngine | None = None
redis_cache: RedisCache | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager."""
    global engine, redis_cache

    # Startup
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        print(
            "Example: DATABASE_URL=postgresql://prismiq:prismiq_demo@localhost:5432/prismiq_demo"
        )
        sys.exit(1)

    # Initialize Redis cache if available
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    try:
        redis_cache = RedisCache(redis_url)
        await redis_cache.connect()
        print(f"Redis cache connected: {redis_url}")
    except Exception as e:
        print(f"Redis not available, running without cache: {e}")
        redis_cache = None

    print("Connecting to database...")
    engine = PrismiqEngine(
        database_url=database_url,
        query_timeout=30.0,
        max_rows=10000,
        persist_dashboards=True,  # Use PostgreSQL for dashboard persistence
        cache=redis_cache,  # Use Redis for caching (query=24h, schema=1h by default)
    )
    await engine.startup()
    print("Database connected!")

    # Create and include the Prismiq router
    router = create_router(engine)
    app.include_router(router, prefix="/api")

    yield

    # Shutdown
    if engine:
        await engine.shutdown()
        print("Database connection closed.")
    if redis_cache:
        await redis_cache.disconnect()
        print("Redis cache disconnected.")


# Create FastAPI application
app = FastAPI(
    title="Prismiq Demo",
    description="Demo application showcasing Prismiq embedded analytics",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint with API info."""
    return {
        "name": "Prismiq Demo API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }


if __name__ == "__main__":
    # Get the project root (3 levels up from this file)
    project_root = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    )
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[
            os.path.dirname(__file__),  # demo/backend
            os.path.join(project_root, "packages", "python"),  # prismiq package
        ],
    )
