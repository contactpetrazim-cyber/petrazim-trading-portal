"""
Backtest Engine (no-lookahead)
================================

PURPOSE
-------
Replays historical bars through a strategy one bar at a time, so the
strategy can only ever see bars up to "now" — never the future. This is
what makes a backtest trustworthy: a strategy that accidentally peeks
ahead will show inflated performance that never survives live trading.

This engine does NOT reimplement your market structure / zone / risk /
MTF logic. It's a harness: you wrap your existing bot evaluators in a
small adapter (see StrategyAdapter below) and this engine drives them
bar-by-bar, simulates fills with spread/slippage/commission costs, and
produces a list of TradeRecord objects — the exact input format the
Monte Carlo engine (Phase 1/2) already consumes. Backtest -> Monte
Carlo is meant to be a direct pipeline.

NO-LOOKAHEAD GUARANTEE
-----------------------
The strategy never receives the raw bar list. It receives a BarWindow,
which only exposes bars up to the current index. Indexing forward
(BarWindow[1], BarWindow[2], ...) raises IndexError by construction —
there is no code path for a strategy to accidentally read future data.

FILL MODEL
----------
- A signal evaluated on bar i fills at bar i's close, adjusted for
  entry cost (spread + slippage).
- Stop/target are then checked starting from bar i+1 onward — i.e.
  only truly future bars can close the trade. This avoids the common
  backtest bug of using a signal bar's own high/low to fill itself.
- If both stop and target fall inside the same bar's range, the stop
  is assumed to hit first (the standard pessimistic convention —
  never assume the more favorable outcome when you can't know intrabar
  sequencing from OHLC data alone).
- Positions still open at the end of the data, or held past
  `max_hold_bars`, are force-closed at the last available close and
  marked exit_reason="timeout".

PARTIAL-EXIT LADDER (optional — see LadderLeg/BacktestSignal.ladder)
----------------------------------------------------------------------
By default (signal.ladder is None) a trade is a plain single
stop/single target, exactly as above — this is the original, still-
tested behavior and nothing about it changed.

When a strategy wants to replay the SAME "let winners run" ladder
position_monitor.py runs live/paper (TP1/TP2/TP3 fractional closes,
breakeven-at-TP1 / TP1-floor-at-TP2 stop ratchet, then a trailing stop
on the final runner leg), it sets `signal.ladder` to an ordered list of
LadderLeg (all legs except the final one — the final leg is implicit:
whatever's left once every configured leg has fired, closed either by
the trailing stop once activated, or — if trailing was never
configured/activated — by the ORIGINAL stop/target). The engine then
replays, bar by bar, exactly the same event ordering
position_monitor.py's own live cycle enforces: the CURRENT (possibly
already-ratcheted) stop is checked first each bar; if not hit, at most
ONE further event (the next pending ladder leg, or a trailing-stop
check once active) is allowed to fire per bar — mirroring
_check_trade's own "one trigger per trade per cycle" discipline, not
an invented backtest-only simplification. A trade's final r_multiple
is the capital-weighted blend across every leg
(sum of fraction-of-original-size-closed-at-that-leg * that leg's own
r_multiple), matching manual_trading.py's compute_blended_r_multiple
exactly (verified algebraically identical: realized_pnl/risk_amount
reduces to this same sum once lot_size cancels out).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Literal, Optional, Protocol

from app.core.smc_algorithms import compute_trailing_stop
from app.engines.monte_carlo_engine import TradeRecord


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Bar:
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0


@dataclass
class CostModel:
    """Simple, symbol-agnostic cost model expressed in price units (not pips),
    so it works the same whether you're backtesting FX, crypto, or indices —
    just pass costs already converted to the instrument's price scale."""
    spread: float = 0.0
    slippage: float = 0.0
    commission_r: float = 0.0   # flat R-multiple deduction per trade, optional

    def entry_adjustment(self, direction: Literal["long", "short"]) -> float:
        cost = self.spread + self.slippage
        return cost if direction == "long" else -cost

    def exit_adjustment(self, direction: Literal["long", "short"]) -> float:
        cost = self.slippage
        return -cost if direction == "long" else cost


@dataclass
class LadderLeg:
    """One non-final partial-exit leg — mirrors BotConfig.tp1/2/3_percent
    + Trade.take_profit_1/2/3 semantics. `level` is 1/2/3, matching
    position_monitor.py's own level numbering (used to decide breakeven
    vs TP1-floor ratchet timing and whether this level activates
    trailing). `fraction` is of the CURRENT remaining size, not the
    original — identical semantics to _target_fraction's own
    docstring (e.g. 30% of original at TP1 needs fraction=0.30 there,
    but 40%-of-original at TP2 needs fraction=40/70 of what's left
    after TP1 already took its 30%); the caller is responsible for
    this conversion, exactly as _target_fraction already does live."""
    level: int
    price: float
    fraction: float


@dataclass
class BacktestSignal:
    direction: Literal["long", "short"]
    stop_price: float
    target_price: float
    bot_id: Optional[str] = None
    reason: str = ""
    # Optional partial-exit ladder — None (the default) preserves the
    # original single-stop/single-target behavior exactly. See the
    # module docstring's "PARTIAL-EXIT LADDER" section.
    ladder: Optional[List[LadderLeg]] = None
    trailing_activation_r: Optional[float] = None
    # Distance basis for the trailing stop once activated — defaults
    # to stop_price (the trade's own initial stop) when unset, same as
    # Trade.initial_stop_loss always being the pre-ratchet value.
    initial_stop_price: Optional[float] = None
    # Trail WIDTH mode ("fixed" default, or "step_down") — see
    # compute_trailing_stop's own docstring (smc_algorithms.py).
    # Mirrors Trade.trailing_stop_distance's own snapshot-at-open
    # convention so a backtest replays the exact same trail shape a
    # live trade under this BotConfig would actually get.
    trailing_stop_mode: str = "fixed"
    # The real position size the strategy itself computed (EntryExitEngine.
    # calculate_lot_size, inside the bot's own .analyze()) — unused by
    # isolated-mode replay (R-multiples are lot_size-invariant, see
    # ClosedBacktestTrade's own blended-R comment) but needed by
    # PortfolioBacktestEngine for real dollar P&L / notional-cap
    # accounting across a shared ledger. None (the default) for every
    # isolated-mode caller.
    lot_size: Optional[float] = None


@dataclass
class ClosedBacktestTrade:
    trade_id: str
    bot_id: Optional[str]
    symbol: str
    direction: str
    entry_price: float
    exit_price: float
    stop_price: float
    r_multiple: float
    bars_held: int
    entry_time: datetime
    exit_time: datetime
    exit_reason: Literal["target", "stop", "timeout", "ladder"]
    # Populated only for a ladder trade (one entry per leg that fired,
    # including the final leg) — empty for a plain single-target trade.
    # Purely informational (debugging/transparency); r_multiple above
    # already reflects the correct capital-weighted blend across these.
    legs: List[Dict] = field(default_factory=list)
    # The real position size the strategy computed (see BacktestSignal.
    # lot_size's own comment) — None for isolated mode unless the
    # adapter supplied one; always set by PortfolioBacktestEngine,
    # which needs it for its own dollar-P&L ledger anyway and carries
    # it here too so a trade record is independently auditable
    # (dollar pnl = r_multiple * lot_size * |entry_price - stop_price|)
    # without reaching into the engine's internal open_pos state.
    lot_size: Optional[float] = None

    def to_trade_record(self) -> TradeRecord:
        """Convert straight into the format the Monte Carlo engine consumes."""
        return TradeRecord(
            trade_id=self.trade_id,
            r_multiple=self.r_multiple,
            bot_id=self.bot_id,
            symbol=self.symbol,
            timestamp=self.exit_time.isoformat(),
        )


class StrategyAdapter(Protocol):
    """
    Implement this to plug an existing bot evaluator into the backtest
    engine. `window` only exposes bars up to "now" — see BarWindow.
    Return None when there's no valid setup on this bar.
    """
    def evaluate(self, window: "BarWindow", context: Dict) -> Optional[BacktestSignal]: ...


# ---------------------------------------------------------------------------
# No-lookahead bar window
# ---------------------------------------------------------------------------

class BarWindow:
    """
    Read-only view over bars[0 : current_index + 1]. Index 0 = the
    current (most recent) bar, -1 = one bar before that, etc. Positive
    indices beyond 0, or any index that would resolve to a bar after
    `current_index`, raise IndexError — there is no way for a strategy
    to read the future through this object.
    """

    def __init__(self, bars: List[Bar], current_index: int):
        self._bars = bars
        self._current_index = current_index

    def __len__(self) -> int:
        return self._current_index + 1

    def __getitem__(self, idx: int) -> Bar:
        if idx > 0:
            raise IndexError(
                "BarWindow only allows index 0 (current) or negative "
                "(lookback) access — positive future indices are blocked."
            )
        real_index = self._current_index + idx
        if real_index < 0:
            raise IndexError("Lookback index goes before the start of history")
        return self._bars[real_index]

    @property
    def current(self) -> Bar:
        return self._bars[self._current_index]

    def lookback(self, n: int) -> List[Bar]:
        """Most recent `n` bars, oldest first, inclusive of current."""
        start = max(0, self._current_index - n + 1)
        return self._bars[start:self._current_index + 1]


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

class BacktestEngine:
    def __init__(self, cost_model: Optional[CostModel] = None, max_hold_bars: int = 500, disable_breakeven_ratchet: bool = False):
        self.cost_model = cost_model or CostModel()
        self.max_hold_bars = max_hold_bars
        # Default False — every existing caller (weekly_review_engine.py,
        # intelligent_tuning_worker.py, trading_audit_engine.py) keeps
        # today's real behavior exactly. True disables ONLY the
        # breakeven-at-TP1/TP1-floor-at-TP2 stop ratchet in
        # _advance_ladder below — everything else (legs firing,
        # trailing activation once configured) stays identical — by
        # direct request ("can we test not SL move - will we have
        # better results ... if the SL was not moved to Breakeven" —
        # a real, data-driven counterfactual: replay the SAME real
        # historical trades against the SAME real candles twice, the
        # only difference being this one flag, to isolate purely the
        # ratchet's own effect from everything else that also changed
        # (entry slippage, the TP-geometry bug, etc.).
        self.disable_breakeven_ratchet = disable_breakeven_ratchet
        self._run_id = uuid.uuid4().hex[:8]

    def new_run_id(self) -> str:
        """Regenerates self._run_id, used by every trade_id this engine
        builds (see each _advance_*/_force_close/_close_ladder_trade/
        _finalize_ladder_trade helper) — real bug, found live: the old
        f"{symbol}_{trade_counter}" scheme restarts trade_counter at 0
        every call, so saving two separate runs' trades for the same
        symbol into closed_trades (what intelligent_tuning_worker.py
        does across its baseline + several candidate runs, and what any
        trader re-running POST /api/backtests for the same bot+symbol
        also does) collided on that table's real trade_id UNIQUE
        constraint. run() calls this itself on every invocation;
        PortfolioBacktestEngine (which drives these same private
        exit-check helpers directly, across many bot/symbol pairs in
        one simulation, without ever calling run()) calls it once at
        the start of its own simulation instead.

        Every trade_id below is also prefixed with open_pos["bot_id"],
        not just symbol/run_id/counter — another real, live-found
        collision: PortfolioBacktestEngine scopes trade_counter per
        (bot_id, symbol) but shares one run_id across the whole
        portfolio run, so two different bots trading the same symbol
        in one portfolio run previously produced identical trade_ids
        (both bots' first trade: f"{symbol}_{run_id}_0") and collided
        on the same UNIQUE constraint this method's own run_id fix was
        added for."""
        self._run_id = uuid.uuid4().hex[:8]
        return self._run_id

    def run(
        self,
        bars: List[Bar],
        strategy: StrategyAdapter,
        symbol: str,
        context: Optional[Dict] = None,
    ) -> List[ClosedBacktestTrade]:
        self.new_run_id()
        context = context or {}
        trades: List[ClosedBacktestTrade] = []
        open_pos: Optional[Dict] = None
        trade_counter = 0

        for i, bar in enumerate(bars):
            if open_pos is not None:
                if open_pos.get("ladder_pending") is not None:
                    closed_trade = self._advance_ladder(open_pos, bar, i, symbol, trade_counter)
                else:
                    closed_trade = self._advance_simple(open_pos, bar, i, symbol, trade_counter)

                held = i - open_pos["entry_index"]
                force_timeout = held >= self.max_hold_bars
                if closed_trade is None and force_timeout:
                    closed_trade = self._force_close(open_pos, bar.close, bar.timestamp, held, symbol, trade_counter, "timeout")

                if closed_trade is not None:
                    trades.append(closed_trade)
                    trade_counter += 1
                    open_pos = None
                continue  # one open position at a time; don't evaluate new signals mid-trade

            window = BarWindow(bars, i)
            signal = strategy.evaluate(window, context)
            if signal is None:
                continue

            entry_price = bar.close + self.cost_model.entry_adjustment(signal.direction)
            open_pos = {
                "direction": signal.direction,
                "entry_price": entry_price,
                "stop_price": signal.stop_price,
                "target_price": signal.target_price,
                "bot_id": signal.bot_id,
                "entry_index": i,
                "entry_time": bar.timestamp,
                "ladder_pending": list(signal.ladder) if signal.ladder else None,
                "initial_stop_price": signal.initial_stop_price if signal.initial_stop_price is not None else signal.stop_price,
                "trailing_activation_r": signal.trailing_activation_r,
                "trailing_stop_mode": signal.trailing_stop_mode,
                "trailing_active": False,
                "trailing_peak": None,
                "remaining_fraction": 1.0,
                "realized_r": 0.0,
                "legs": [],
                "lot_size": signal.lot_size,
            }

        # Force-close anything still open at the end of the data
        if open_pos is not None and bars:
            last_bar = bars[-1]
            trades.append(self._force_close(
                open_pos, last_bar.close, last_bar.timestamp,
                len(bars) - 1 - open_pos["entry_index"], symbol, trade_counter, "timeout",
            ))

        return trades

    # -- plain single-stop/single-target path (original behavior, untouched) --

    def _advance_simple(self, open_pos: Dict, bar: Bar, i: int, symbol: str, trade_counter: int) -> Optional[ClosedBacktestTrade]:
        exit_price, exit_reason = self._check_exit(open_pos, bar)
        if exit_price is None:
            return None
        exit_price += self.cost_model.exit_adjustment(open_pos["direction"])
        r_multiple = self._r_multiple(open_pos, exit_price) - self.cost_model.commission_r
        return ClosedBacktestTrade(
            trade_id=f"{open_pos['bot_id']}_{symbol}_{self._run_id}_{trade_counter}",
            bot_id=open_pos["bot_id"],
            symbol=symbol,
            direction=open_pos["direction"],
            entry_price=open_pos["entry_price"],
            exit_price=round(exit_price, 6),
            stop_price=open_pos["stop_price"],
            r_multiple=round(r_multiple, 4),
            bars_held=i - open_pos["entry_index"],
            entry_time=open_pos["entry_time"],
            exit_time=bar.timestamp,
            exit_reason=exit_reason,
            lot_size=open_pos.get("lot_size"),
        )

    @staticmethod
    def _check_exit(open_pos: Dict, bar: Bar) -> tuple[Optional[float], Optional[str]]:
        direction = open_pos["direction"]
        stop, target = open_pos["stop_price"], open_pos["target_price"]

        if direction == "long":
            stop_hit = bar.low <= stop
            target_hit = bar.high >= target
        else:
            stop_hit = bar.high >= stop
            target_hit = bar.low <= target

        if stop_hit:
            # Pessimistic convention: if both trigger in the same bar,
            # assume the stop was hit first — never assume the friendlier
            # outcome when OHLC data alone can't tell you the intrabar
            # order.
            return stop, "stop"
        if target_hit:
            return target, "target"
        return None, None

    # -- partial-exit ladder path (position_monitor.py's own math, ported) --

    def _advance_ladder(self, open_pos: Dict, bar: Bar, i: int, symbol: str, trade_counter: int) -> Optional[ClosedBacktestTrade]:
        direction = open_pos["direction"]
        is_long = direction == "long"
        stop = open_pos["stop_price"]

        # The current (possibly already-ratcheted) stop is always
        # checked first each bar — mirrors _check_trade's own ordering.
        stop_hit = (bar.low <= stop) if is_long else (bar.high >= stop)
        if stop_hit:
            return self._close_ladder_trade(open_pos, stop, bar.timestamp, i, symbol, trade_counter, "stop")

        if open_pos["trailing_active"]:
            # position_monitor.py's own _check_trailing advances the
            # peak off a single live ticker price per polling cycle;
            # an OHLC bar has no single "price," so the bar's favorable
            # extreme (high for long, low for short) is the natural,
            # pessimism-consistent generalization — it's the best the
            # position could have done this bar, and the hit check
            # below uses the opposite (unfavorable) extreme against
            # the newly-advanced trail, so a bar that moves favorably
            # then reverses is never assumed to have escaped with the
            # more favorable outcome.
            peak = open_pos["trailing_peak"]
            peak = max(peak, bar.high) if is_long else min(peak, bar.low)
            open_pos["trailing_peak"] = peak
            trail_stop = self._trailing_stop_from_peak(open_pos, peak)
            trail_hit = (bar.low <= trail_stop) if is_long else (bar.high >= trail_stop)
            if trail_hit:
                return self._close_ladder_trade(open_pos, trail_stop, bar.timestamp, i, symbol, trade_counter, "ladder")
            return None

        # One pending-leg trigger per bar, same "one trigger per trade
        # per cycle" discipline _check_trade enforces live — the next
        # bar re-checks the (now updated) state rather than letting two
        # legs fire off a single bar's OHLC.
        pending = open_pos["ladder_pending"]
        if not pending:
            # No ladder legs left and trailing never activated — falls
            # back to the plain target, exactly like a trade whose
            # trailing_activation_r was never configured live.
            target_hit = (bar.high >= open_pos["target_price"]) if is_long else (bar.low <= open_pos["target_price"])
            if target_hit:
                return self._close_ladder_trade(open_pos, open_pos["target_price"], bar.timestamp, i, symbol, trade_counter, "ladder")
            return None

        leg = pending[0]
        leg_hit = (bar.high >= leg.price) if is_long else (bar.low <= leg.price)
        if not leg_hit:
            return None

        pending.pop(0)
        closed_fraction_of_remaining = leg.fraction
        closed_fraction_of_original = open_pos["remaining_fraction"] * closed_fraction_of_remaining
        open_pos["remaining_fraction"] -= closed_fraction_of_original

        # Every leg is a real simulated exit against the broker, so the
        # same exit cost (slippage) applies to each one, not just a
        # trade's very last leg — this is the P&L figure; the ratchet
        # logic below deliberately keeps using the nominal, un-adjusted
        # leg.price as the stop/level reference, matching
        # position_monitor.py's own ratchet (which anchors to
        # trade.entry_price / trade.take_profit_1, not a cost-adjusted
        # fill price).
        leg_exit_price = leg.price + self.cost_model.exit_adjustment(open_pos["direction"])
        leg_r = self._r_multiple(open_pos, leg_exit_price)
        open_pos["realized_r"] += closed_fraction_of_original * leg_r
        open_pos["legs"].append({"level": leg.level, "price": round(leg_exit_price, 6), "fraction_of_original": round(closed_fraction_of_original, 6), "r_multiple": round(leg_r, 4)})

        # Ratchet — breakeven after TP1, TP1's own price after TP2.
        # Tighten-only, exactly like _partial_close's max/min guard.
        # Skipped entirely when disable_breakeven_ratchet is set (see
        # __init__'s own comment) — the stop then simply stays at
        # whatever it already was (the original stop, unless trailing
        # has separately taken over) for the rest of the trade.
        if not self.disable_breakeven_ratchet:
            if leg.level == 1:
                open_pos["stop_price"] = max(stop, open_pos["entry_price"]) if is_long else min(stop, open_pos["entry_price"])
            elif leg.level == 2 and open_pos.get("tp1_price") is not None:
                tp1 = open_pos["tp1_price"]
                open_pos["stop_price"] = max(open_pos["stop_price"], tp1) if is_long else min(open_pos["stop_price"], tp1)
        if leg.level == 1:
            open_pos["tp1_price"] = leg.price

        activation = open_pos["trailing_activation_r"]
        if activation is not None and float(leg.level) == activation:
            open_pos["trailing_active"] = True
            open_pos["trailing_peak"] = leg.price

        # A leg whose fraction closed everything that was left (e.g. a
        # final configured leg with fraction=1.0) IS the trade's real
        # close — there is no implicit extra leg after it. Finalizing
        # here, rather than falling through to the next bar's "no
        # pending legs, fall back to the plain target" branch, is what
        # this test caught: that fallback would otherwise fire a
        # phantom zero-size "final" leg against the original static
        # target on some later bar.
        if open_pos["remaining_fraction"] <= 1e-9:
            return self._finalize_ladder_trade(open_pos, i, symbol, trade_counter, bar.timestamp, "ladder")

        return None  # this bar's single allowed event has fired; stay open

    def _finalize_ladder_trade(self, open_pos: Dict, i: int, symbol: str, trade_counter: int, exit_time: datetime, exit_reason: Literal["stop", "ladder"]) -> ClosedBacktestTrade:
        """Builds the ClosedBacktestTrade from state the caller has
        ALREADY fully accumulated (every leg, including the one that
        just exhausted remaining_fraction, is already in open_pos["legs"]
        / open_pos["realized_r"]) — used when a ladder leg itself was
        the final close. See _close_ladder_trade for the other case
        (stop-hit or trailing-hit with capital still remaining, which
        still needs one more "final" leg appended for that remainder)."""
        last_leg_price = open_pos["legs"][-1]["price"]
        blended_r = open_pos["realized_r"] - self.cost_model.commission_r
        return ClosedBacktestTrade(
            trade_id=f"{open_pos['bot_id']}_{symbol}_{self._run_id}_{trade_counter}",
            bot_id=open_pos["bot_id"],
            symbol=symbol,
            direction=open_pos["direction"],
            entry_price=open_pos["entry_price"],
            exit_price=round(last_leg_price, 6),
            stop_price=open_pos["stop_price"],
            r_multiple=round(blended_r, 4),
            bars_held=i - open_pos["entry_index"],
            entry_time=open_pos["entry_time"],
            exit_time=exit_time,
            exit_reason=exit_reason,
            legs=open_pos["legs"],
            lot_size=open_pos.get("lot_size"),
        )

    def _close_ladder_trade(self, open_pos: Dict, exit_price: float, exit_time: datetime, i: int, symbol: str, trade_counter: int, exit_reason: Literal["stop", "ladder"]) -> ClosedBacktestTrade:
        """Stop-hit or trailing-hit with capital still remaining (i.e.
        NOT reached via a ladder leg exhausting remaining_fraction —
        see _finalize_ladder_trade for that case): appends one final
        leg for whatever fraction of the original position was still
        open, at `exit_price` (the stop/trail level, not yet
        cost-adjusted — that happens here, once, same as the leg-firing
        path)."""
        exit_price_adj = exit_price + self.cost_model.exit_adjustment(open_pos["direction"])
        final_fraction = open_pos["remaining_fraction"]
        final_r = self._r_multiple(open_pos, exit_price_adj)
        open_pos["realized_r"] += final_fraction * final_r
        open_pos["legs"].append({"level": "final", "price": round(exit_price_adj, 6), "fraction_of_original": round(final_fraction, 6), "r_multiple": round(final_r, 4)})

        blended_r = open_pos["realized_r"] - self.cost_model.commission_r
        return ClosedBacktestTrade(
            trade_id=f"{open_pos['bot_id']}_{symbol}_{self._run_id}_{trade_counter}",
            bot_id=open_pos["bot_id"],
            symbol=symbol,
            direction=open_pos["direction"],
            entry_price=open_pos["entry_price"],
            exit_price=round(exit_price_adj, 6),
            stop_price=open_pos["stop_price"],
            r_multiple=round(blended_r, 4),
            bars_held=i - open_pos["entry_index"],
            entry_time=open_pos["entry_time"],
            exit_time=exit_time,
            exit_reason=exit_reason,
            legs=open_pos["legs"],
            lot_size=open_pos.get("lot_size"),
        )

    @staticmethod
    def _trailing_stop_from_peak(open_pos: Dict, peak: float) -> float:
        """Delegates to compute_trailing_stop (smc_algorithms.py), the
        single shared formula also used live by position_monitor.py's
        own _trailing_stop_from_peak — see that function's own
        docstring for the "fixed" vs "step_down" modes."""
        return compute_trailing_stop(
            open_pos["entry_price"], open_pos["initial_stop_price"], open_pos["direction"],
            peak, mode=open_pos.get("trailing_stop_mode", "fixed"),
        )

    def _force_close(self, open_pos: Dict, exit_price: float, exit_time: datetime, bars_held: int, symbol: str, trade_counter: int, reason: str) -> ClosedBacktestTrade:
        exit_price_adj = exit_price + self.cost_model.exit_adjustment(open_pos["direction"])
        if open_pos.get("ladder_pending") is not None:
            final_fraction = open_pos["remaining_fraction"]
            final_r = self._r_multiple(open_pos, exit_price_adj)
            open_pos["realized_r"] += final_fraction * final_r
            open_pos["legs"].append({"level": "final", "price": round(exit_price_adj, 6), "fraction_of_original": round(final_fraction, 6), "r_multiple": round(final_r, 4)})
            r_multiple = open_pos["realized_r"] - self.cost_model.commission_r
            legs = open_pos["legs"]
        else:
            r_multiple = self._r_multiple(open_pos, exit_price_adj) - self.cost_model.commission_r
            legs = []
        return ClosedBacktestTrade(
            trade_id=f"{open_pos['bot_id']}_{symbol}_{self._run_id}_{trade_counter}",
            bot_id=open_pos["bot_id"],
            symbol=symbol,
            direction=open_pos["direction"],
            entry_price=open_pos["entry_price"],
            exit_price=round(exit_price_adj, 6),
            stop_price=open_pos["stop_price"],
            r_multiple=round(r_multiple, 4),
            bars_held=bars_held,
            entry_time=open_pos["entry_time"],
            exit_time=exit_time,
            exit_reason="timeout",
            legs=legs,
            lot_size=open_pos.get("lot_size"),
        )

    @staticmethod
    def _r_multiple(open_pos: Dict, exit_price: float) -> float:
        # Always the ORIGINAL (pre-ratchet) risk distance, never the
        # live stop_price — identical for the simple path (stop_price
        # is never mutated there, so the two are always equal anyway)
        # and correct for the ladder path (stop_price tightens over
        # time via the breakeven/TP1-floor ratchet, but every leg's
        # R-multiple must stay anchored to the trade's true original
        # risk, matching Trade.risk_amount's own immutability).
        # .get() with a stop_price fallback, not open_pos["initial_stop_price"]
        # directly — weekly_review_engine.py's own _simulate_hypothetical
        # calls this static method directly with its own, simpler
        # open_pos shape (just direction/entry_price/stop_price/
        # target_price, no initial_stop_price key at all); a hard
        # KeyError there was a real regression caught by that file's
        # own test suite, not a hypothetical concern.
        entry = open_pos["entry_price"]
        stop = open_pos.get("initial_stop_price", open_pos["stop_price"])
        risk_per_unit = abs(entry - stop)
        if risk_per_unit == 0:
            return 0.0
        if open_pos["direction"] == "long":
            return (exit_price - entry) / risk_per_unit
        return (entry - exit_price) / risk_per_unit
