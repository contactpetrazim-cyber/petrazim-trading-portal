"""
Database Session
==================

Standard async SQLAlchemy setup, works against any Postgres — Fly
Postgres, Supabase, whatever you're running. Reads connection info from
one environment variable so switching providers later is a config
change, not a code change.

REQUIRED ENV VAR:
    DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname

Supabase gives you a connection string in Project Settings -> Database.
Take the one labeled "URI", change `postgresql://` to
`postgresql+asyncpg://` at the front, and that's your DATABASE_URL.

REQUIRED PACKAGES (add to requirements.txt / pyproject.toml):
    sqlalchemy[asyncio]>=2.0
    asyncpg

USAGE IN A ROUTE:
    from fastapi import Depends
    from app.db.session import get_db

    @router.get("/something")
    async def something(db: AsyncSession = Depends(get_db)):
        ...
"""

from __future__ import annotations

import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

DATABASE_URL = os.environ.get("DATABASE_URL", "")

if not DATABASE_URL:
    # Fail loudly and early rather than silently falling back to
    # something that looks like it works but isn't talking to real data.
    raise RuntimeError(
        "DATABASE_URL is not set. Add it to your environment (Fly secrets, "
        "Supabase env vars, or a local .env) before starting the app. "
        "Format: postgresql+asyncpg://user:password@host:5432/dbname"
    )

engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
