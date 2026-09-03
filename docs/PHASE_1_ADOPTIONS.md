# Phase 1 Adoptions — Hardening + Monte Carlo Addition

This documents everything adopted from the Perplexity architecture review,
plus the new Monte Carlo predictive engine. Deployment options 1–7 are
untouched.

---

## 1. Bot 5 — brand changed, logic kept

Per your instruction: content stays, name changes. "Jeafx-inspired" is
dropped from all user-facing labels, code identifiers, and docs. The
underlying rules (liquidity purge → displacement → CHoCH/BOS → FVG/OB
refinement → entry) are unchanged — only the attribution/branding is
removed so the system isn't claiming to replicate a named paid
methodology it can't verify.

**Rename map (apply consistently across code, Pine scripts, and UI):**

| Old | New |
|---|---|
| `bot5_jeaxf_specialist.pine` | `bot5_liquidity_purge_specialist.pine` |
| "Jeafx SMC Specialist" (bot name) | "Liquidity Purge Specialist" |
| "Jeafx" (style label) | "Rapid Displacement / SMC" |

No logic changes required — this is a find-and-replace across bot
metadata, file names, and dashboard labels.

---

## 2. Webhook idempotency

TradingView delivery is at-least-once. Added `webhook_idempotency.py`
(this batch) — checks `event_id` before processing, marks it processed
after. Wire it into `execution_gateway.py`'s webhook handler:

```python
if await guard.already_processed(payload["event_id"]):
    return {"status": "duplicate_ignored"}
# ...process...
await guard.mark_processed(payload["event_id"])
```

Use `InMemoryIdempotencyStore` for paper trading now; swap to
`RedisIdempotencyStore` when you deploy for real (Fly.io already gives
you Redis in the free tier per your existing deploy docs).

---

## 3. Confirmed-bar-only Pine alerts

Real-time bar values can repaint before the candle closes, which can
fire alerts on a value that later changes. Every `.pine` alert
condition should be gated on bar close:

```pinescript
// Only evaluate signal logic on a confirmed (closed) bar
signalCondition = barstate.isconfirmed and <your existing condition>

alertcondition(signalCondition, title="Confirmed Entry", message=alertMessage)
```

Apply this gate to all 5 bot scripts + the master engine script.

---

## 4. Risk engine additions

Add to the existing 12-layer risk engine:

- **Stale-data protection** — reject signals if the market snapshot
  used to evaluate the trade is older than a configurable threshold
  (e.g. >5s for scalping timeframes, >60s for higher timeframes).
- **Circuit breaker on repeated API failures** — after N consecutive
  broker/exchange API failures, pause new order submission and alert,
  rather than retrying blindly into a failing venue.
- **Correlated-exposure limit** — deferred to Phase 3 (needs a
  correlation matrix across your active symbols; not worth the
  complexity until you're running several correlated pairs at once).

---

## 5. Monte Carlo Predictive Performance Engine (new capability)

New file: `backend/app/engines/monte_carlo_engine.py`
Tests: `backend/tests/test_monte_carlo_engine.py`

**What it does:** Takes your closed-trade history (R-multiples, tagged
by bot/symbol), extracts the statistical pattern (win rate, expectancy,
streak behavior), then resamples that history thousands of times to
build a distribution of possible future equity paths for a *set* of
trades — not a prediction of any single trade.

**Adjustable parameters** (all exposed on `run_simulation()`):

| Parameter | Purpose |
|---|---|
| `trials` | number of simulated futures to run |
| `trades_per_trial` | how many trades make up one simulated future |
| `starting_equity` | equity the simulation starts from |
| `risk_mode` / `risk_value` | fixed-fractional (%) or fixed-dollar risk per trade |
| `resample_mode` | `"block"` (preserves streaks, recommended) or `"iid"` |
| `block_size` | length of resampled chunks in block mode |
| `ruin_threshold_pct` | drawdown % that counts as "ruin" for that trial |
| `target_equity` | optional — reports probability of reaching this |
| `bot_id` | run the simulation on one bot's history only |
| `seed` | for reproducible runs |

**Output (`SimulationResult`):**

- `final_equity_percentiles` — 5th/25th/50th/75th/95th percentile ending equity
- `max_drawdown_percentiles` — same percentile bands for worst drawdown per trial
- `probability_of_ruin` — % of simulated futures that breached the ruin threshold
- `probability_of_target` — % that reached your target equity (if set)
- `notes` — automatic warnings, e.g. when history is too short (<30 trades) to trust

**Honesty built in:** with under 30 trades of history, the engine flags
its own output as indicative only. This is by design — a Monte Carlo
sim is only as good as the trade sample feeding it, and it should never
be presented as more certain than the data supports.

**Not yet built (next phase):** an API route + a dashboard panel to run
this interactively (choose bot, trials, parameters, see the fan chart).
That's Phase 2 if you want to continue.

---

## Phase 2 — API route + dashboard panel (this batch)

**New engine capability:** `simulate_equity_paths()` +
`percentile_bands_over_time()` on `MonteCarloEngine` — runs the same
simulation but keeps the full equity curve per trial instead of only
the final number, then collapses it into percentile bands at each
trade step (downsampled to ~60 points so chart payloads stay light).
This is what makes the fan chart possible; `run_simulation()` from
Phase 1 is unchanged and still used for the summary stats.

**New file:** `backend/app/routers/monte_carlo.py`
- `GET /api/monte-carlo/metrics?bot_id=...` — pattern extraction only, no simulation.
- `POST /api/monte-carlo/simulate` — runs the full simulation with every
  parameter from Phase 1 exposed in the request body, plus
  `include_fan_chart` / `fan_chart_trials` to control the path-tracked
  band data.

**Action needed before this is live:** `_load_trade_history()` in that
file is a placeholder that intentionally raises `NotImplementedError`.
Point it at your real closed-trade table (analytics.py already tracks
these) — it's isolated in one function so this is a small, contained change.

**New file:** `frontend/src/components/PerformanceForecastPanel.jsx`
- Bot selector, and full parameter controls (trials, trades per trial,
  starting equity, risk mode/value, resample mode, block size, ruin
  threshold, target equity, seed).
- Fan chart (recharts) showing the 5th–95th and 25th–75th percentile
  equity bands over the simulated trade sequence, with a median line,
  a starting-equity reference line, and a target-equity reference line.
- Headline stat cards: median outcome, 5th–95th range, probability of
  ruin (flagged amber above 10%), probability of hitting target.
- Historical-basis panel showing the exact trade metrics the forecast
  was built from, plus any low-sample-size warnings surfaced automatically.
- Uses the existing dark trading-terminal design tokens
  (`smc-card` / `smc-border` / `smc-accent`) already in your dashboard —
  no new design system introduced.

**To mount it:** add a "Forecast" nav item pointing at this component,
same pattern as your existing `BotsPage`. Pass `apiBaseUrl` as a prop
(same value already used by your other dashboard API calls).

---

## Phase 3 — Backtest engine + go-live validation gate (this batch)

**New file:** `backend/app/engines/backtest_engine.py`

A no-lookahead backtest harness — not a reimplementation of your
market structure/zone/risk logic. You wrap an existing bot evaluator in
a small `StrategyAdapter` (one method: `evaluate(window, context)`) and
this engine drives it bar-by-bar.

- **No-lookahead is structural, not a promise.** The strategy never
  receives the bar list — it receives a `BarWindow` that only exposes
  bars up to "now." Asking for a future bar (`window[1]`) raises
  `IndexError`. Tested directly (`test_blocks_future_access`,
  `test_no_lookahead_in_run_loop`).
- **Fill model:** signal on bar *i* fills at bar *i*'s close plus
  entry cost (spread + slippage). Stop/target are only checked from
  bar *i+1* onward — a signal bar can never fill itself. If stop and
  target both trigger inside the same future bar, the stop is assumed
  first (pessimistic convention — OHLC data alone can't tell you
  intrabar order, so never assume the friendlier outcome).
- **`ClosedBacktestTrade.to_trade_record()`** converts straight into
  the `TradeRecord` format the Monte Carlo engine (Phase 1/2) already
  consumes — backtest results flow directly into a performance forecast
  with no glue code.
- Sanity-tested end to end above: ran a synthetic strategy over 300
  synthetic bars, produced trades with all three exit reasons
  (target/stop/timeout), fed the output straight into
  `MonteCarloEngine.compute_metrics()` successfully.

**New file:** `backend/app/engines/validation_gate.py`

The formal go-live checklist. Nine checks, matching what was flagged
earlier as missing:

| Check | Automated? |
|---|---|
| Minimum trade count | ✅ automatic |
| Out-of-sample expectancy (holds out the last slice of trades) | ✅ automatic |
| Max drawdown (via Monte Carlo resampling, not just the one historical curve) | ✅ automatic |
| Cost stress test | ✅ automatic — pass in a cost-stressed backtest re-run |
| Parameter stability | ✅ automatic — pass in a few parameter-perturbed re-runs |
| Paper-trading reconciliation | ⛔ **manual sign-off required** |
| Kill-switch test | ⛔ **manual sign-off required** |
| Manual emergency-close test | ⛔ **manual sign-off required** |

**The important design decision:** the three safety-critical checks
cannot be satisfied by code, ever. No trade data or statistics will
make them pass — only an explicit `manual_attestations={"kill_switch_test": True, ...}`
dict, meaning a human actually ran that test against the live system.
Verified directly in testing: a bot with excellent backtest stats and
*zero* manual attestations is correctly `BLOCKED`; flipping even one
attestation to `False` blocks the whole gate regardless of how good
everything else looks.

**How to use it per bot, before flipping autonomous mode on:**

```python
gate = ValidationGate(min_trade_count=50, max_acceptable_drawdown_pct=30)
report = gate.evaluate(
    trades=backtest_trades,                       # from BacktestEngine
    cost_stressed_trades=stressed_backtest_trades, # re-run with 2-3x normal costs
    parameter_variant_trade_sets=[variant1, variant2],
    manual_attestations={
        "paper_trading_reconciliation": True,   # only after you've actually done it
        "kill_switch_test": True,
        "manual_emergency_close_test": True,
    },
)
print(report.summary())
if not report.overall_pass:
    # do not enable autonomous mode for this bot
    ...
```

---

## Phase 4 — Go-Live Checklist API + dashboard panel (this batch)

**New file:** `backend/app/core/attestation_store.py`

Backs the three manual checks with a real audit trail — not just a
boolean. Every sign-off records **who** (`signed_by`), **when**
(`signed_at`, automatic), pass/fail, and optional notes. Records are
append-only: re-attesting (e.g. after a code change forces a re-test)
adds a new record rather than overwriting history, so you can always
see the full trail of who tested what and when. `InMemoryAttestationStore`
is dev-only by design — swap for a real table before this authorizes
actual autonomous trading, same pattern as the idempotency store from
Phase 1.

**New file:** `backend/app/routers/validation_gate.py`
- `POST /api/validation-gate/attest` — submit a signed attestation for
  one of the three manual checks.
- `GET /api/validation-gate/attestations/{bot_id}` — full audit history
  for a bot.
- `POST /api/validation-gate/evaluate` — runs the full gate: automated
  checks against stored backtest results, plus the latest attestation
  on file for each manual check. Missing attestations correctly report
  as `"missing"` and block go-live.

**Verified by direct testing** (no FastAPI in this sandbox, so the
underlying wiring — attestation store + gate — was tested standalone):
zero attestations blocks even a great backtest; partial attestations
still block on whatever's missing; all three present plus passing
automated checks flips to approved; and re-attesting kill-switch-test
as failed after a prior pass immediately re-blocks the gate. The audit
trail correctly preserves every submission rather than overwriting.

**Same placeholder pattern as Phase 1/2:** `_load_backtest_trades()`,
`_load_cost_stressed_trades()`, `_load_parameter_variant_trades()` in
the router need wiring to your real stored backtest results
(output of `BacktestEngine.run()` from Phase 3).

**New file:** `frontend/src/components/GoLiveChecklistPanel.jsx`
- Bot selector + "Run validation gate" button.
- Big pass/fail banner (green "GO-LIVE APPROVED" / red "BLOCKED" with
  the specific blocking checks named).
- Every check listed with status pill (PASS / FAIL / MISSING) and its
  detail text.
- For the three manual checks: an inline sign-off form (name, pass/fail,
  notes) that won't submit without a name typed in, and shows the
  existing attestation (who, when, notes) once one exists. Re-attesting
  is always available — useful after a code change invalidates a prior
  kill-switch test.

**To mount it:** same pattern as the Forecast panel — add a "Go-Live"
nav item, pass `apiBaseUrl` as a prop.

---

## Phase 5 — Weekly Review Engine (coach debrief) (this batch)

**New file:** `backend/app/engines/weekly_review_engine.py`

Reviews a week the way an actual coach would — three parts:

1. **Taken trades**, graded on **process, not outcome**. A trade that
   hit its stop exactly as planned is graded `risk_managed_loss`, not
   a failure — the loss is what the plan was designed to contain. A
   trade that closed by timeout with no plan followed is graded
   `needs_manual_review`, even if it happened to make money — a good
   result the process didn't actually produce on purpose is a warning
   sign, not a win. This grading only uses what the trade data can
   actually prove (`exit_reason` vs `r_multiple`) — it doesn't guess
   at psychology the data can't support.
2. **Missed opportunities** — signals your bots generated but that
   were rejected (risk limit, human declined, bot disabled). Their
   hypothetical outcome is computed by reusing `BacktestEngine`'s own
   exit-check logic — the exact same no-lookahead, pessimistic-fill
   standard as every other number in this system. No thumb on the
   scale to make a nicer story either way.
3. **Emotional/psychology review** — cross-references your existing
   emotional journaling engine's mood tags against trade outcomes,
   flags moods where expectancy drops meaningfully below your overall
   average (e.g. "trades logged 'anxious' averaged -0.3R vs +0.6R
   overall"), and explicitly cautions against overreacting to a single
   week's pattern.

**Coach narrative — two modes, deliberately decoupled:**
- `generate_template_narrative()` — deterministic, no LLM needed,
  works immediately.
- `build_weekly_review_prompt()` — builds a ready-to-send prompt
  (with the coach's voice rules baked in: no hype, no certainty
  language, process over outcome, cite real numbers) for your existing
  coach LLM integration to turn into fuller prose. This engine
  deliberately doesn't make its own LLM call — it hands off to
  whatever's already powering `TradeCoachPanel`/`ReasoningPanel`, so
  there's one coach voice in the product, not two.

Verified end to end above with synthetic data: correct grading across
all three exit types, correct hypothetical simulation via the reused
backtest logic, correct mood-based flagging, both narrative modes
producing sensible output.

**New file:** `backend/app/routers/weekly_review.py` —
`GET /api/weekly-review/report?week_start=...&week_end=...&bot_id=...`.
Same placeholder pattern as every other router: `_load_taken_trades()`,
`_load_rejected_signals()`, `_load_journal_entries()`,
`_load_forward_bars()` need wiring to your real trade log, signal-
rejection log, journaling engine, and market data store.

**New file:** `frontend/src/components/WeeklyReviewPanel.jsx` — week
picker (defaults to the current week), headline stats, the coach's
debrief text, key lessons, every taken trade with its grade and
reasoning, missed opportunities with their hypothetical result, and
the mood-performance breakdown with flagged patterns.

---

## Phase 6 — Data layer: schema + real DB wiring (this batch)

This is the answer to "how do I wire in real data," made concrete
instead of theoretical. It doesn't require you to have told me your
schema first — it proposes one, and every placeholder function from
Phases 1–5 now runs real queries against it.

**New file:** `backend/migrations/001_create_core_tables.sql`

Plain SQL, safe to re-run (`IF NOT EXISTS` everywhere). Five tables:
`closed_trades` (live trades AND all three backtest variants, kept in
one table via a `source` column so every engine reads from the same
place), `rejected_signals`, `journal_entries`, `gate_attestations`
(append-only audit trail), `webhook_events_seen` (idempotency, if you
don't want Redis as a dependency). Novice instructions for running it
are in the file header — Supabase's SQL Editor needs no terminal at all.

**If you already have a trades table:** don't run this blindly. Either
rename the columns in `app/db/models.py` to match what you have, or
let this table exist alongside yours while you migrate. The engines
never see these tables directly — only the dataclasses — so pointing
this layer at a differently-shaped existing schema is a one-file edit
(`app/db/repository.py`), not a rewrite.

**New files:**
- `backend/app/db/session.py` — async Postgres connection, reads
  `DATABASE_URL` from environment (works with Fly Postgres, Supabase,
  or anything else — it's just a connection string). Fails loudly at
  startup if unset, rather than silently doing nothing.
- `backend/app/db/models.py` — SQLAlchemy ORM models, column-for-column
  matching the migration.
- `backend/app/db/repository.py` — every actual query. This is the one
  file to edit if your real schema differs from the proposed one.
- `backend/requirements-additions.txt` — the two packages this needs
  (`sqlalchemy[asyncio]`, `asyncpg`).

**Routers updated, placeholders gone:** `monte_carlo.py`,
`validation_gate.py`, and `weekly_review.py` now take a
`db: AsyncSession = Depends(get_db)` and call real repository
functions instead of raising `NotImplementedError`. All three
compile-checked clean.

**What's still a placeholder, on purpose:** `_load_forward_bars()` in
`weekly_review.py` needs a market data provider (broker/exchange API),
not a database table — genuinely different plumbing, so it's kept
separate and returns `{}` safely rather than crashing the whole review
when it's not wired yet (missed opportunities just show as "no_data").

**Your actual next step:** run the migration (5 minutes via Supabase's
SQL Editor, novice instructions in the file), set `DATABASE_URL`, and
every forecast/gate/review endpoint goes from "raises an error" to
"queries real data" with no further code changes — assuming you're
starting fresh. If you already have a trades table under different
names, send me a snippet of it and I'll adjust `repository.py` to match.

---

## Suggested phase order from here

1. ✅ **Phase 1:** Bot 5 rebrand, idempotency, confirmed-bar Pine gate,
   risk engine additions, Monte Carlo engine + tests.
2. ✅ **Phase 2:** API route + dashboard Performance Forecast panel
   with fan chart.
3. ✅ **Phase 3:** No-lookahead backtest engine + formal go-live
   validation gate with mandatory manual safety sign-offs.
4. ✅ **Phase 4:** Validation gate API + attestation audit trail +
   Go-Live Checklist dashboard panel.
5. ✅ **Phase 5:** Weekly Review Engine — taken trades graded on
   process, missed opportunities honestly simulated, emotional/
   psychology correlation, coach debrief (template + LLM prompt).
6. ✅ **Phase 6 (this batch):** Proposed database schema + real
   SQLAlchemy data layer + all routers wired to it.
7. **Remaining:** run the migration against your actual Postgres, set
   `DATABASE_URL`, and start persisting real trades/signals/journal
   entries as your bots run — at that point every panel in this build
   starts showing real data instead of erroring out.
