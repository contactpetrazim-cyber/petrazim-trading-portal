
"""
SMC Multi-Bot Automated Trading System
Principal Algorithmic Trading Engine
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
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
from app.database import engine, Base
from app.db.session import engine as legacy_engine, Base as LegacyBase

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

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("app_startup", version=settings.VERSION)

    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # The Phase-1 Monte Carlo / validation-gate / weekly-review engines
    # (app/db/session.py) keep their own separate declarative Base —
    # a leftover of being built in an isolated sandbox round before the
    # rest of the app existed. Both engines point at the same
    # DATABASE_URL, so create their tables too rather than silently
    # leaving closed_trades/rejected_signals missing.
    async with legacy_engine.begin() as conn:
        await conn.run_sync(LegacyBase.metadata.create_all)

    yield

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
