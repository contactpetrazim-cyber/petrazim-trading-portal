# Petrazim Trading Portal — Status

A living project-status doc, meant to be read by a brand-new Claude Code session (or anyone else) to get oriented fast, without re-deriving context from scratch. Updated at the end of sessions that make notable changes — check `git log` for anything more recent than the date below.

_Last updated: 2026-11-27_

## Architecture

- **Backend**: FastAPI + SQLAlchemy async, `backend/app/`. Dual-hosted:
  - **Primary**: a Nube cloud VM (Coolify-managed Docker), always-on, no cold starts.
  - **Fallback**: Render free tier (`petrazim-trading-backend`), spins down after 15 min idle (~90s cold start). Auto-deploys from `main`.
  - Frontend picks between them via `frontend/src/lib/backendFailover.ts` — a 2-second warmup race on first load, automatic failback polling every 60s. Swapped to VM-primary specifically because of Render's cold-start behavior; see that file's own header comment for the full history.
- **Database**: Supabase Postgres, project `eacpktuyicxutatxuokw` ("petrazim-trading-portal"). A *separate*, unrelated Supabase project (`ehfnoktatbbucvpnkyty`, "Petrazim Training") also exists — don't confuse the two.
- **Frontend**: React/Vite/TypeScript, `frontend/src/`. Deployed to Vercel and Lovable via GitHub sync.
- **Repo**: `contactpetrazim-cyber/petrazim-trading-portal`, branch `main`. Workflow: branch → commit → push → PR → squash-merge, same pattern every session uses.

## Bot platform state (as of 2026-11-27)

- **83 `BotConfig` rows total, all `trading_mode=TEST`** — zero bots are currently trading real/LIVE capital. `TEST` still places real exchange orders (a demo/paper broker account), so this isn't "no activity," just no capital risk.
- **Recommended Bots rollout**: migration 030 (PR #378, 2026-11-11 15:37:43 UTC) replaced the old "66 bots on every symbol" testing phase with a curated roster — 5 recommended bots (`*_rec_*` bot_id convention), each cloned from the strategy/instrument pair with the best pre-rollout evidence. `backend/app/services/recommended_dashboard.py` computes this cutoff dynamically (`get_rollout_at`) — don't hardcode a second copy of this date anywhere.
- **Per-family trailing policy**: `bot_3`/`bot_7`/`bot_17` (FVG-expansion trend-followers) use late-activation (TP2) + full-width (`fixed`) trailing — their edge comes from occasional big runners that an early/tight trail cuts short. Every other family uses `step_down` trailing activated at TP1 (the platform default).
- **Instrument Focus engine** (`services/instrument_selection.py`): caps how many instruments the roster trades at once (default: 3), enforced before any candle fetch.
- **One bot per pair at a time** (`execution_engine.process_signal`): a signal is skipped if another ACTIVE bot already holds a trade on that symbol. Paused bots' leftover open trades don't count toward this.
- **Trailing Loss Guard** (`services/trailing_loss_guard.py`): a rolling circuit breaker, bot-wide (`check_bot`) and pair-wide (`check_pair`) — 3 consecutive loss events within 48h, or cumulative loss beyond 3x average risk within 4h. `check_pair` clusters simultaneous multi-bot stop-outs (within 15 min) into one event; `check_bot` does NOT cluster (fixed 2026-11-27 — see "Recent fixes" below).

## Data-era scoping ("Post vs Pre+Post")

Added 2026-11-27. The testing-phase trades (pre-2026-11-11) and the recommended-roster trades (post) are **never physically separated or archived** — everything stays in one `trades` table. Instead:
- `backend/app/routers/dashboard.py`'s 4 endpoints (`/stats`, `/trade-breakdown`, `/performance`, `/equity-curve`) take an `era=post|all` query param, defaulting to `post` (scoped to since the rollout). `era=all` drops the filter.
- `frontend/src/hooks/useDataEra.ts` + `frontend/src/components/EraToggle.tsx` — one shared, localStorage-persisted toggle used across `Dashboard.tsx`, `AnalyticsPage.tsx`, `PremiumDashboardPage.tsx`, and `RecommendedBotsDashboard.tsx`.
- The Recommended Bots Dashboard (`frontend/src/components/RecommendedBotsDashboard.tsx`) was already post-rollout-only by construction (its "live" data is scoped to `_rec_` bot_ids, which only exist post-rollout) — the era toggle there just shows/hides the pre-rollout "evidence" comparison series.

## Recommended Bots Dashboard — filters & drill-down

Added 2026-11-27. `GET /bots/recommended-dashboard`'s `equity` array (one row per closed recommended-bot trade) now carries `trade_id`, `exit_type`, and `pnl` alongside the existing `bot_id`/`symbol`/`r`/`cum_r` — it's the one raw dataset every chart filters from client-side (date range, bot, instrument, win/loss, custom R range). Click a point on the equity curve, or a bar/row on R-distribution/Daily P&L/exit-mix, to drill into the underlying trade(s) (`TradeListModal` → `TradeSnapshotModal`).

## Known issues / things to pick up next

- `trading_audit_engine.py`'s `BOT_OPTIMIZATION_REFERENCE`/`BACKTEST_VALIDATION_TARGETS` cover bot_1-22 (extended in PR #377) — keep extending for any new bot family.
- The backend test suite has pre-existing failures/errors unrelated to any specific feature work: `test_smc_algorithms.py` (4 tests) and `test_weekly_review_engine.py` (1 test) fail on floating-point/assertion mismatches; every test that touches the shared SQLite test fixture (`idempotency_records` table, a Postgres `JSONB` column SQLite can't compile) errors at setup. Confirmed pre-existing on `main` as of 2026-11-27 — not caused by any specific PR, not yet fixed.
- Going live is planned after another month of paper trading on the current recommended roster, with a deep performance review at that point. The era toggle, filters, and drill-down above are meant to support exactly that review.

## Standing instructions (apply regardless of which session is active)

- **Never proactively ask about triggering a manual redeploy.** Merged PRs on `main` go out on the normal auto-deploy cycle (~10-20 min) with no action needed. A past session hit a real UI bug where this question looped and failed to send.
- Always `cd` into `/root/projects/petrazim-trading-portal` explicitly before git/docker commands — the default shell cwd is a sibling directory and isn't a git repo.
- The shell cwd resets after every command — don't rely on a previous `cd` persisting.
