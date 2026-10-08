
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    poolclass=NullPool,
    future=True,
    # statement_cache_size=0 — required the moment DATABASE_URL points
    # at Supabase's TRANSACTION-mode pooler (port 6543) instead of
    # session-mode (5432): real regression, found live in production
    # immediately after that switch (made to fix a SEPARATE problem —
    # session-mode's pooler hard-caps concurrent clients at 15, which
    # the market scanner's own sustained load had started tripping).
    # asyncpg caches prepared statements by name and replays them on
    # whatever physical connection it's handed next; transaction-mode
    # pooling hands out a DIFFERENT physical backend connection per
    # transaction, so a statement prepared on one physical connection
    # no longer exists on the next — "prepared statement
    # "__asyncpg_stmtN__" does not exist", which took down
    # position_monitor_cycle and pending_order_monitor_cycle (every
    # single 20s cycle) the moment the new container came up. asyncpg's
    # own error message documents this exact fix.
    connect_args={"statement_cache_size": 0},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
