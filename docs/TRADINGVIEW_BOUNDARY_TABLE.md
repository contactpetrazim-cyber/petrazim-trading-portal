# Petrazim vs. TradingView — Verified Responsibility Boundary

Verified against TradingView's current official documentation
(charting-library-docs, tradingview.com/advanced-charts,
tradingview.com/free-charting-libraries) before writing anything below
— no assumptions.

## Status legend
- CONFIRMED — officially supported, documented.
- POSSIBLE — technically real, but requires specific integration work
  or licensing, not a toggle.
- NOT AVAILABLE — TradingView's own architecture rules this out, not a
  Petrazim limitation.
- REQUIRES VERIFICATION — needs a direct commercial conversation with
  TradingView (pricing, contract terms, data licensing).

| Function | Status | Detail |
|---|---|---|
| Embed a live, view-only chart (any symbol) | CONFIRMED | The free widget (TradingViewChart.tsx, already built) — official, no login, no account. |
| Full logged-in tradingview.com app inside our iframe | NOT AVAILABLE | TradingView's authenticated app blocks third-party framing by design (standard anti-clickjacking practice for any site with account login). Not a config TradingView could just "turn on" for us — it's an architectural security decision on their end. |
| A TradingView-styled charting engine we host ourselves, with drawing tools/indicators | CONFIRMED | Advanced Charts Library — free, self-hosted, official. |
| That self-hosted chart syncing with the user's real tradingview.com drawings/layouts/watchlists | NOT AVAILABLE | TradingView's own FAQ: Advanced Charts and Trading Platform "run independently on your servers, ensuring there is no interaction with TradingView on user data." This is true even on the paid tier — it is not a licensing gate, it's the product's architecture. |
| Persistent drawings/layouts for a user, saved by us | POSSIBLE | Advanced Charts supports a Save/Load REST API contract — but Petrazim has to build and host the actual save/load backend. The data lives in Petrazim's database, under the user's Petrazim account, not their TradingView one. |
| Real market data feeding the self-hosted chart | POSSIBLE, our responsibility | "The library does not include market data" (official docs) — Petrazim must supply a datafeed adapter, e.g. from the same market data source already used by the bots. |
| Broker-style order entry (buy/sell buttons) inside a TradingView-styled UI | POSSIBLE | The Trading Platform library (superset of Advanced Charts) supports this — it would connect to Petrazim's own execution gateway and risk engine, not TradingView or an external broker. |
| One-click deep link to the user's actual real tradingview.com account, symbol pre-filled | CONFIRMED | tradingview.com supports symbol-in-URL linking; opens in a new tab, genuinely their real account, real drawings, real everything — just not embedded inside our frame. |
| Petrazim navigation, tools, risk calculators, community, learning | CONFIRMED — Petrazim's own | No TradingView dependency at all. |
| Pricing/licensing for Advanced Charts or Trading Platform at Petrazim's expected usage volume | REQUIRES VERIFICATION | Advanced Charts itself is free to download; commercial terms for any data entitlements or the Trading Platform tier need a direct check with TradingView, not an assumption here. |

## What this means concretely

Never say "sync your TradingView account" or "your TradingView
drawings will appear here" — that specific claim is not true no matter
which TradingView product tier you use, and saying it is a broken
promise, not marketing language.

Do say "your own workspace, drawing tools, and saved layouts, right
inside Petrazim" — genuinely true and valuable, it's just backed by
Petrazim's own database, not TradingView's.
