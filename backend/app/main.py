
"""
SMC Multi-Bot Automated Trading System
Principal Algorithmic Trading Engine
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from sqlalchemy import inspect, text
import structlog
from app.config import get_settings
from app.routers import webhook_router, trades_router, bots_router, dashboard_router
from app.routers.auth import router as auth_router
from app.routers.admin import router as admin_router
from app.routers.payments import router as payments_router
from app.routers.payment_webhooks import router as payment_webhooks_router
from app.routers.corporate import router as corporate_router
from app.routers.telegram_webhook import router as telegram_webhook_router
from app.routers.onboarding import router as onboarding_router
from app.routers.monte_carlo import router as monte_carlo_router
from app.routers.validation_gate import router as validation_gate_router
from app.routers.weekly_review import router as weekly_review_router
from app.routers.chart_layouts import router as chart_layouts_router
from app.routers.facilitator import router as facilitator_router
from app.routers.roster import router as roster_router
from app.routers.portals import router as portals_router
from app.routers.broker_credentials import router as broker_credentials_router
from app.routers.curriculum import router as curriculum_router
from app.routers.practise import router as practise_router
from app.routers.order_flow import router as order_flow_router
from app.routers.tools import router as tools_router
from app.routers.community_broadcast import router as community_broadcast_router
from app.routers.manual_trading import router as manual_trading_router
from app.routers.coach import router as coach_router
from app.database import engine, Base
from app.db.session import engine as legacy_engine, Base as LegacyBase
from app.services.execution_engine import ExecutionEngine
from app.services.market_scanner import MarketScanner
from app.services.position_monitor import PositionMonitor

settings = get_settings()
logger = structlog.get_logger()

# Connection manager for WebSocket broadcasting
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

async def _repair_missing_columns(conn, base, label: str):
    """`Base.metadata.create_all` (below) only creates tables that
    don't exist yet — for a table that's already live in production,
    a column added to its model afterwards is silently never added to
    the real database. That's exactly what caused "column trades.is_test
    does not exist" (and would have quietly broken take_profit_2/
    take_profit_3 the same way) — the ORM inserted/selected the new
    column, Postgres had never heard of it, and every request touching
    a Trade row 500'd. This app has no Alembic migrations actually
    wired into its deploy (alembic/ exists in the repo but nothing
    ever runs `alembic upgrade head`), so rather than leave the next
    column addition to fail the exact same way, this introspects the
    real database on every startup and adds whatever's missing —
    driven by the models themselves, nothing hand-listed. New columns
    are added nullable regardless of the model's own nullable=False
    (existing rows have nothing to put there); where the model
    declares a plain Python-side scalar default (e.g. is_test=False),
    existing NULL rows are backfilled to it so old trades don't 500
    when serialized against a non-Optional response field.
    """
    def _existing_columns(sync_conn):
        inspector = inspect(sync_conn)
        return {t: {c["name"] for c in inspector.get_columns(t)} for t in inspector.get_table_names()}

    existing = await conn.run_sync(_existing_columns)
    for table in base.metadata.sorted_tables:
        have = existing.get(table.name)
        if have is None:
            continue  # brand-new table — create_all just made it with every column already
        for column in table.columns:
            if column.name in have:
                continue
            ddl_type = column.type.compile(dialect=conn.dialect)
            await conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN IF NOT EXISTS "{column.name}" {ddl_type}'))
            logger.warning("schema_repair_added_column", label=label, table=table.name, column=column.name)
            if column.default is not None and getattr(column.default, "is_scalar", False):
                await conn.execute(
                    text(f'UPDATE "{table.name}" SET "{column.name}" = :v WHERE "{column.name}" IS NULL'),
                    {"v": column.default.arg},
                )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("app_startup", version=settings.VERSION)

    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _repair_missing_columns(conn, Base, "main")

    # The Phase-1 Monte Carlo / validation-gate / weekly-review engines
    # (app/db/session.py) keep their own separate declarative Base —
    # a leftover of being built in an isolated sandbox round before the
    # rest of the app existed. Both engines point at the same
    # DATABASE_URL, so create their tables too rather than silently
    # leaving closed_trades/rejected_signals missing.
    async with legacy_engine.begin() as conn:
        await conn.run_sync(LegacyBase.metadata.create_all)
        await _repair_missing_columns(conn, LegacyBase, "legacy")

    # Autonomous market scanner — off by default (MARKET_SCANNER_ENABLED).
    # See market_scanner.py's module docstring for what this does and
    # why it's opt-in.
    scanner = None
    if settings.MARKET_SCANNER_ENABLED:
        scanner = MarketScanner(ExecutionEngine())
        scanner.start()
    else:
        logger.info("market_scanner_disabled", note="set MARKET_SCANNER_ENABLED=true to turn on autonomous scanning")

    # Position monitor — auto-closes/partial-closes a Paper Trade for
    # real once live price touches its SL/TP (see position_monitor.py's
    # own module docstring for why this is Test-mode-only and safe to
    # run on by default, unlike the market scanner above).
    position_monitor = None
    if settings.POSITION_MONITOR_ENABLED:
        position_monitor = PositionMonitor()
        position_monitor.start()

    yield

    if scanner is not None:
        await scanner.stop()
    if position_monitor is not None:
        await position_monitor.stop()

    logger.info("app_shutdown")
    await engine.dispose()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="""
    Premium Smart Money Concepts (SMC) Multi-Bot Automated Trading System.

    Features:
    - 5 Distinct SMC Trading Bots
    - Multi-Timeframe Alignment Engine (1D→4H→1H→15M→5M)
    - Human-in-the-Loop & Fully Autonomous Execution
    - TradingView Webhook Integration
    - Real-time Dashboard & Analytics
    - Risk Management & Portfolio Safeguards
    """,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(webhook_router)
app.include_router(trades_router)
app.include_router(bots_router)
app.include_router(dashboard_router)

# v2/v3 additions (see MERGE_MANIFEST.md) — auth/roles/payments/community
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(payments_router)
app.include_router(payment_webhooks_router)
app.include_router(corporate_router)
app.include_router(telegram_webhook_router)
app.include_router(onboarding_router)
app.include_router(chart_layouts_router)
app.include_router(facilitator_router)
app.include_router(roster_router)
app.include_router(portals_router)
app.include_router(broker_credentials_router)
app.include_router(curriculum_router)
app.include_router(practise_router)
app.include_router(order_flow_router)
app.include_router(tools_router)
app.include_router(community_broadcast_router)
app.include_router(manual_trading_router)
app.include_router(coach_router)

# Phase-1 analytics engines — routers ship without their own prefix
app.include_router(monte_carlo_router, prefix="/api/monte-carlo", tags=["monte-carlo"])
app.include_router(validation_gate_router, prefix="/api/validation-gate", tags=["validation-gate"])
app.include_router(weekly_review_router, prefix="/api/weekly-review", tags=["weekly-review"])

@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "status": "operational",
        "endpoints": {
            "api_docs": "/api/docs",
            "webhook": "/webhook/tradingview",
            "trades": "/trades",
            "bots": "/bots",
            "dashboard": "/dashboard/stats",
            "websocket": "/ws"
        }
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": __import__("datetime").datetime.utcnow().isoformat()}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time trade updates and dashboard data."""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            # Handle client messages (subscriptions, etc.)
            if data.get("action") == "subscribe":
                await websocket.send_json({
                    "type": "subscription_confirmed",
                    "channel": data.get("channel", "all")
                })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error("websocket_error", error=str(e))
        manager.disconnect(websocket)

@app.get("/api/system-info")
async def system_info():
    """Get system configuration and bot status overview."""
    return {
        "app_name": settings.APP_NAME,
        "version": settings.VERSION,
        "debug": settings.DEBUG,
        "default_risk": settings.DEFAULT_RISK_PERCENT,
        "default_rr": settings.DEFAULT_RR_RATIO,
        "max_daily_trades": settings.MAX_DAILY_TRADES,
        "max_portfolio_exposure": settings.MAX_PORTFOLIO_EXPOSURE,
        "features": [
            "5_SMC_Bots",
            "MTF_Alignment",
            "Human_in_Loop",
            "Fully_Autonomous",
            "TradingView_Integration",
            "Risk_Management",
            "Batch_Processing",
            "Analytics_Feedback_Loop"
        ]
    }
