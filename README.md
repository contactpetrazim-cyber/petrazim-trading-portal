
# SMC Multi-Bot Automated Trading System

A premium Smart Money Concepts (SMC) trading engine with 5 distinct bots, multi-timeframe alignment, and TradingView integration.

## Features

- **5 SMC Trading Bots**: Macro Swing, OB Reversal, FVG Expansion, Volume Sweep, Jeafx Specialist
- **Multi-Timeframe Engine**: 1D → 4H → 1H → 15M → 5M alignment
- **Execution Modes**: Human-in-the-Loop & Fully Autonomous
- **TradingView Integration**: Webhook alerts from Pine Script
- **Risk Management**: Dynamic position sizing, drawdown protection
- **Real-time Dashboard**: React + Tailwind CSS dark theme

## Quick Start

```bash
# Start everything with Docker
docker-compose up --build

# Or start individually:
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## API Endpoints

- `GET /` - System info
- `GET /health` - Health check
- `POST /webhook/tradingview` - TradingView alerts
- `GET /trades/` - List trades
- `GET /trades/pending-approvals` - Pending approvals
- `POST /trades/approve` - Approve/reject trade
- `GET /bots/` - List bots
- `GET /dashboard/stats` - Dashboard statistics
- `WS /ws` - WebSocket for real-time updates

## TradingView Webhook Format

```json
{
  "bot_id": "bot_2_ob_reversal",
  "pair": "BTCUSDT",
  "action": "buy",
  "entry": 45000.00,
  "stop_loss": 44000.00,
  "take_profit": 48000.00,
  "timeframe": "15M"
}
```

## Architecture

```
TradingView Alerts → Webhook → FastAPI → Bot Engine → Broker API
                                    ↓
                              Dashboard (React)
```

## License

Proprietary - All rights reserved.
