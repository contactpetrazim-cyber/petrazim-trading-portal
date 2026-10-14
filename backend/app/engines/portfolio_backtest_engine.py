"""
Portfolio Backtest Engine
===========================

Simulates the whole real operation — every participating bot replayed
TOGETHER against a single shared, compounding dollar ledger, with a
real capital_adequacy-equivalent notional/leverage cap enforced across
every bot's simultaneously open positions — as opposed to
BacktestEngine's isolated mode, which tests one bot's raw signal edge
in a vacuum with no cross-bot capital contention.

Deliberately built as a second orchestration layer ON TOP of
BacktestEngine's existing, already-verified exit-check machinery
(_advance_simple/_advance_ladder/_force_close/_r_multiple/...), not a
parallel reimplementation: those methods already take an explicit
`open_pos: Dict` parameter rather than storing position state on
`self`, which is exactly what makes them safely reusable here for
MANY simultaneously open positions (one dict per (bot_id, symbol)
pair) instead of BacktestEngine.run()'s own single-position-at-a-time
loop.

DISCRETE-EVENT CLOCK
----------------------
Different bots replay on different base timeframes (bot_1: 1D,
bot_5: 5M, ...) against potentially different symbols, so there is no
single shared bar sequence the way isolated mode has one. Instead,
every (bot_id, symbol) pair's own bar-close events are merged into one
globally chronological queue (ties broken by "bot_id:symbol" string,
a deterministic but otherwise arbitrary convention for the genuinely
ambiguous case of two bots closing a bar at the exact same instant —
documented here rather than hidden) and processed in that order, each
event only ever advancing ITS OWN pair's BarWindow — the no-lookahead
guarantee BarWindow already provides is preserved per pair.

SHARED LEDGER
---------------
A single running `balance` (dollars), debited/credited by each
trade's real dollar P&L on close (derived from the SAME blended
r_multiple BacktestEngine already computes, algebraically identical to
r_multiple * lot_size * original_risk_per_unit — see
compute_blended_r_multiple's own docstring in manual_trading.py for
the proof this identity is correct for both single-leg and
multi-leg/ladder trades). Every bot's own lot_size is computed by its
real EntryExitEngine.calculate_lot_size — reached via
SmcStrategyAdapter.evaluate(window, context={"account_balance": ...}),
context being the one deliberate hook isolated mode never used, added
specifically for this (see strategy_adapter.py's own comment). Before
a new position opens, its notional (lot_size * entry_price) plus every
OTHER currently-open position's own notional is checked against
balance * leverage — mirrors capital_adequacy.check_capital_adequacy's
real formula exactly, just reading the SIMULATED open-position set
instead of a live DB query of other open/pending trades for a real
user_id (there is no single real user_id in a multi-bot portfolio
simulation — this models "what if this was all one account").
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from app.engines.backtest_engine import Bar, BacktestEngine, BarWindow, ClosedBacktestTrade, CostModel
from app.engines.strategy_adapter import SmcStrategyAdapter


@dataclass
class PortfolioParticipant:
    bot_id: str
    symbol: str
    adapter: SmcStrategyAdapter
    bars: List[Bar]  # this pair's own base-timeframe bars for the simulation window


@dataclass
class PortfolioBacktestResult:
    trades: List[ClosedBacktestTrade] = field(default_factory=list)
    equity_curve: List[Dict] = field(default_factory=list)  # [{"timestamp","balance","bot_id","symbol","event","pnl"}]
    starting_balance: float = 0.0
    ending_balance: float = 0.0
    rejected_by_capital_adequacy: int = 0  # signals that were otherwise valid but couldn't be sized given the shared balance/leverage


class PortfolioBacktestEngine:
    def __init__(
        self,
        cost_model: Optional[CostModel] = None,
        max_hold_bars: int = 500,
        starting_balance: float = 10000.0,
        leverage: float = 50.0,
    ):
        self._engine = BacktestEngine(cost_model=cost_model, max_hold_bars=max_hold_bars)
        self.starting_balance = starting_balance
        self.leverage = leverage

    @staticmethod
    def _capital_adequacy_ok(existing_notional: float, new_notional: float, balance: float, leverage: float) -> bool:
        return (existing_notional + new_notional) <= (balance * leverage)

    @staticmethod
    def _dollar_pnl(open_pos: Dict, closed: ClosedBacktestTrade) -> float:
        risk_per_unit = abs(open_pos["entry_price"] - open_pos["initial_stop_price"])
        return closed.r_multiple * open_pos["lot_size"] * risk_per_unit

    def run(self, participants: List[PortfolioParticipant]) -> PortfolioBacktestResult:
        self._engine.new_run_id()
        balance = self.starting_balance
        positions: Dict[str, Optional[Dict]] = {}
        trade_counters: Dict[str, int] = {}
        trades: List[ClosedBacktestTrade] = []
        equity_curve: List[Dict] = []
        rejected = 0

        by_key: Dict[str, PortfolioParticipant] = {}
        events: List[tuple] = []
        for p in participants:
            key = f"{p.bot_id}:{p.symbol}"
            by_key[key] = p
            positions[key] = None
            trade_counters[key] = 0
            for idx, bar in enumerate(p.bars):
                events.append((bar.timestamp, key, idx))
        # Tie-break by key (bot_id:symbol) — a deterministic but
        # otherwise arbitrary convention for two bots closing a bar at
        # the exact same instant; real-world simultaneous fills are
        # inherently this ambiguous too.
        events.sort(key=lambda e: (e[0], e[1]))

        for timestamp, key, idx in events:
            p = by_key[key]
            bar = p.bars[idx]
            open_pos = positions[key]

            if open_pos is not None:
                if open_pos.get("ladder_pending") is not None:
                    closed = self._engine._advance_ladder(open_pos, bar, idx, p.symbol, trade_counters[key])
                else:
                    closed = self._engine._advance_simple(open_pos, bar, idx, p.symbol, trade_counters[key])

                held = idx - open_pos["entry_index"]
                if closed is None and held >= self._engine.max_hold_bars:
                    closed = self._engine._force_close(open_pos, bar.close, bar.timestamp, held, p.symbol, trade_counters[key], "timeout")

                if closed is not None:
                    dollar_pnl = self._dollar_pnl(open_pos, closed)
                    balance += dollar_pnl
                    trades.append(closed)
                    trade_counters[key] += 1
                    positions[key] = None
                    equity_curve.append({
                        "timestamp": closed.exit_time.isoformat(), "balance": round(balance, 2),
                        "bot_id": p.bot_id, "symbol": p.symbol, "event": "close", "pnl": round(dollar_pnl, 2),
                    })
                continue  # one open position per (bot,symbol) pair at a time, same as isolated mode

            window = BarWindow(p.bars, idx)
            signal = p.adapter.evaluate(window, {"account_balance": balance})
            if signal is None:
                continue
            if not signal.lot_size or signal.lot_size <= 0:
                continue  # shouldn't happen (every bot's own EntryExitEngine always sizes a signal) — defensive

            entry_price = bar.close + self._engine.cost_model.entry_adjustment(signal.direction)
            new_notional = abs(signal.lot_size * entry_price)
            existing_notional = sum(
                abs(pos["lot_size"] * pos["entry_price"]) for pos in positions.values() if pos is not None
            )
            if not self._capital_adequacy_ok(existing_notional, new_notional, balance, self.leverage):
                rejected += 1
                continue

            positions[key] = {
                "direction": signal.direction,
                "entry_price": entry_price,
                "stop_price": signal.stop_price,
                "target_price": signal.target_price,
                "bot_id": signal.bot_id,
                "entry_index": idx,
                "entry_time": bar.timestamp,
                "ladder_pending": list(signal.ladder) if signal.ladder else None,
                "initial_stop_price": signal.initial_stop_price if signal.initial_stop_price is not None else signal.stop_price,
                "trailing_activation_r": signal.trailing_activation_r,
                "trailing_active": False,
                "trailing_peak": None,
                "remaining_fraction": 1.0,
                "realized_r": 0.0,
                "legs": [],
                "lot_size": signal.lot_size,
            }
            equity_curve.append({
                "timestamp": bar.timestamp.isoformat(), "balance": round(balance, 2),
                "bot_id": p.bot_id, "symbol": p.symbol, "event": "open", "pnl": 0.0,
            })

        # Force-close anything still open once every pair's own data is exhausted.
        for key, open_pos in positions.items():
            if open_pos is None:
                continue
            p = by_key[key]
            last_bar = p.bars[-1]
            closed = self._engine._force_close(
                open_pos, last_bar.close, last_bar.timestamp,
                len(p.bars) - 1 - open_pos["entry_index"], p.symbol, trade_counters[key], "timeout",
            )
            dollar_pnl = self._dollar_pnl(open_pos, closed)
            balance += dollar_pnl
            trades.append(closed)
            equity_curve.append({
                "timestamp": closed.exit_time.isoformat(), "balance": round(balance, 2),
                "bot_id": p.bot_id, "symbol": p.symbol, "event": "close", "pnl": round(dollar_pnl, 2),
            })

        return PortfolioBacktestResult(
            trades=trades, equity_curve=equity_curve,
            starting_balance=self.starting_balance, ending_balance=round(balance, 2),
            rejected_by_capital_adequacy=rejected,
        )
