
# SMC Trading Dashboard

A premium dark-themed trading dashboard for Smart Money Concepts (SMC) automated trading.

## Tech Stack
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand (state management)
- Recharts (charts)
- Lucide React (icons)

## Features
- Real-time trade monitoring
- Bot configuration panel
- Signal approval system
- Performance analytics
- Equity curve visualization
- WebSocket live updates

## Environment Variables
Create a `.env` file:
```
VITE_API_URL=https://your-backend-url.com
VITE_WS_URL=wss://your-backend-url.com/ws
```

## Development
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## API Integration
This frontend connects to a FastAPI backend that handles:
- TradingView webhook alerts
- Trade execution and management
- Bot strategy engine
- Real-time WebSocket updates

Backend repo: [Your backend URL]
