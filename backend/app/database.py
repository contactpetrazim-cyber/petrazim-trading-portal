
import uuid

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from app.config import get_settings

settings = get_settings()

# Required the moment DATABASE_URL points at Supabase's TRANSACTION-
# mode pooler (port 6543) instead of session-mode (5432): real
# regression, found live in production immediately after that switch
# (made to fix a SEPARATE problem — session-mode's pooler hard-caps
# concurrent clients at 15, which the market scanner's own sustained
# load had started tripping).
#
# statement_cache_size=0 alone (asyncpg's own client-side cache,
# disabled) wasn't enough on its own: SQLAlchemy's asyncpg DIALECT
# generates its OWN prepared-statement names independently (a simple
# per-PROCESS incrementing counter — "__asyncpg_stmt_18__" etc.), not
# tied to asyncpg's cache setting at all. Transaction-mode pooling
# hands out a DIFFERENT physical backend connection per transaction,
# so that same counter-generated name can land on a physical
# connection that ALREADY has a statement prepared under that exact
# name from a completely different logical SQLAlchemy connection —
# "DuplicatePreparedStatementError ... already exists" (the FIRST fix
# attempt's own "does not exist" was the same class of bug, just the
# opposite-looking symptom). prepared_statement_name_func generating a
# genuinely unique name per prepare call (not a shared counter) is
# SQLAlchemy's own documented fix for asyncpg+pgbouncer transaction
# mode. Took down position_monitor_cycle, pending_order_monitor_cycle,
# and outbound_ip_detector_cycle (every one of their own short
# intervals) until both parts of this fix landed together.
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    poolclass=NullPool,
    future=True,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
    },
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
