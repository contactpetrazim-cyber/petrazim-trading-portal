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
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Literal, Optional, Protocol

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
class BacktestSignal:
    direction: Literal["long", "short"]
    stop_price: float
    target_price: float
    bot_id: Optional[str] = None
    reason: str = ""


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
    exit_reason: Literal["target", "stop", "timeout"]

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
    def __init__(self, cost_model: Optional[CostModel] = None, max_hold_bars: int = 500):
        self.cost_model = cost_model or CostModel()
        self.max_hold_bars = max_hold_bars

    def run(
        self,
        bars: List[Bar],
        strategy: StrategyAdapter,
        symbol: str,
        context: Optional[Dict] = None,
    ) -> List[ClosedBacktestTrade]:
        context = context or {}
        trades: List[ClosedBacktestTrade] = []
        open_pos: Optional[Dict] = None
        trade_counter = 0

        for i, bar in enumerate(bars):
            if open_pos is not None:
                exit_price, exit_reason = self._check_exit(open_pos, bar)
                held = i - open_pos["entry_index"]
                force_timeout = held >= self.max_hold_bars

                if exit_price is not None or force_timeout:
                    if exit_price is None:
                        exit_price = bar.close
                        exit_reason = "timeout"
                    exit_price += self.cost_model.exit_adjustment(open_pos["direction"])

                    r_multiple = self._r_multiple(open_pos, exit_price) - self.cost_model.commission_r

                    trades.append(ClosedBacktestTrade(
                        trade_id=f"{symbol}_{trade_counter}",
                        bot_id=open_pos["bot_id"],
                        symbol=symbol,
                        direction=open_pos["direction"],
                        entry_price=open_pos["entry_price"],
                        exit_price=round(exit_price, 6),
                        stop_price=open_pos["stop_price"],
                        r_multiple=round(r_multiple, 4),
                        bars_held=held,
                        entry_time=open_pos["entry_time"],
                        exit_time=bar.timestamp,
                        exit_reason=exit_reason,
                    ))
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
            }

        # Force-close anything still open at the end of the data
        if open_pos is not None and bars:
            last_bar = bars[-1]
            exit_price = last_bar.close + self.cost_model.exit_adjustment(open_pos["direction"])
            r_multiple = self._r_multiple(open_pos, exit_price) - self.cost_model.commission_r
            trades.append(ClosedBacktestTrade(
                trade_id=f"{symbol}_{trade_counter}",
                bot_id=open_pos["bot_id"],
                symbol=symbol,
                direction=open_pos["direction"],
                entry_price=open_pos["entry_price"],
                exit_price=round(exit_price, 6),
                stop_price=open_pos["stop_price"],
                r_multiple=round(r_multiple, 4),
                bars_held=len(bars) - 1 - open_pos["entry_index"],
                entry_time=open_pos["entry_time"],
                exit_time=last_bar.timestamp,
                exit_reason="timeout",
            ))

        return trades

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
            # outcome when OHLC data alone can't tell you the intrabar order.
            return stop, "stop"
        if target_hit:
            return target, "target"
        return None, None

    @staticmethod
    def _r_multiple(open_pos: Dict, exit_price: float) -> float:
        entry, stop = open_pos["entry_price"], open_pos["stop_price"]
        risk_per_unit = abs(entry - stop)
        if risk_per_unit == 0:
            return 0.0
        if open_pos["direction"] == "long":
            return (exit_price - entry) / risk_per_unit
        return (entry - exit_price) / risk_per_unit
