
from fastapi import APIRouter, Request, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import structlog
from app.database import get_db
from app.services.webhook_processor import WebhookProcessor
from app.schemas import TradingViewWebhook, WebhookResponse

router = APIRouter(prefix="/webhook", tags=["webhook"])
logger = structlog.get_logger()
processor = WebhookProcessor()

@router.post("/tradingview", response_model=WebhookResponse)
async def tradingview_webhook(
    payload: TradingViewWebhook,
    request: Request,
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    TradingView Webhook Endpoint

    Receives alerts from TradingView Pine Script and routes to bot execution.
    Supports both Human-in-the-Loop and Fully Autonomous execution modes.

    Example payload:
    ```json
    {
        "bot_id": "bot_2_ob_reversal",
        "pair": "BTCUSDT",
        "action": "buy",
        "entry": 45000.00,
        "stop_loss": 44000.00,
        "take_profit": 48000.00,
        "timeframe": "15M",
        "fvg_present": true,
        "liquidity_swept": true
    }
    ```
    """
    try:
        # Verify signature if configured
        body = await request.body()
        if x_signature and not processor.verify_signature(body, x_signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

        result = await processor.process_alert(payload.model_dump(), db)
        return WebhookResponse(**result)

    except Exception as e:
        logger.error("webhook_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tradingview/raw")
async def tradingview_webhook_raw(request: Request, db: AsyncSession = Depends(get_db)):
    """Raw webhook endpoint for direct TradingView JSON alerts."""
    try:
        data = await request.json()
        result = await processor.process_alert(data, db)
        return JSONResponse(content=result)
    except Exception as e:
        logger.error("raw_webhook_error", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
