# Petrazim Pine Scripts

These were the files `SETUP_GUIDE.md` referenced but that never actually
shipped in any of the delivered zips. Two are here now:

- **`SMC_Master_Engine.pine`** — visual indicator only (swing structure,
  BOS/CHoCH, order blocks, FVGs, equal-high/low liquidity). Paste into
  Pine Editor → Add to Chart to see what the backend bots are reading.
  Sends no alerts a webhook could act on.
- **`Bot1_MacroSwing.pine`** — a chart-side strategy mirroring
  `backend/app/core/bot_strategies.py::MacroSwingStructureBot`, simplified
  to one timeframe of Pine data (the real bot uses genuine 1D+4H
  multi-timeframe alignment server-side). Fires a webhook alert whose
  JSON exactly matches `TradingViewWebhook` in
  `backend/app/schemas/__init__.py`.

## Bots 2–5

`Bot2_OrderBlockReversal.pine`, `Bot3_FVGExpansion.pine`,
`Bot4_VolumeSweep.pine`, and `Bot5_JeafxSpecialist.pine` follow the same
pattern (pivot/structure detection → arm an entry/stop/target → fire the
same JSON shape with a different `bot_id`) but aren't written yet — ask
for them specifically and I'll add them the same way.

## Important: none of this is required for the bots to trade

The backend already pulls its own market data directly from exchanges
(`backend/app/services/data_ingestion.py`, via CCXT/yfinance) and can
execute directly through the broker clients in
`backend/app/services/broker_integrations.py`. These Pine scripts are an
optional *additional* signal source / visual cross-check — not a
dependency. See `docs/TRADINGVIEW_BOUNDARY_TABLE.md` for the full,
verified boundary between what TradingView can and can't do here.

## There is no remote/API way to install these

TradingView's Pine Editor and Alert creation are both browser-only, by
TradingView's own design — nobody (not Claude, not any tool) can push a
script or create an alert on your account programmatically. To use one:

1. Open the `.pine` file above, copy its contents.
2. On tradingview.com, open Pine Editor (bottom of the chart) → paste →
   **Add to Chart**.
3. Click the Alerts (clock) icon → **Create Alert** → condition = this
   script's alert.
4. Webhook URL: `https://<your-deployed-backend>/webhook/tradingview`.
5. Leave the alert message as the script's default — it already sends
   the correct JSON.
