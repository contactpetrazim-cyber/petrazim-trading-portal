"""Trailing Loss Guard streak counting — the live cases found after the
Recommended Bots rollout, plus the cases that must still trip."""

from datetime import datetime, timedelta

from app.models.trade import Trade
from app.services.trailing_loss_guard import _evaluate

NOW = datetime(2026, 11, 11, 17, 0)


def _t(hours_ago, r, risk=10.0, minutes=0):
    return Trade(realized_pnl=r * risk, r_multiple=r, risk_amount=risk,
                 exit_timestamp=NOW - timedelta(hours=hours_ago, minutes=minutes))


def run(trades):
    return _evaluate(sorted(trades, key=lambda t: t.exit_timestamp, reverse=True), now=NOW)


def test_three_separate_losses_within_48h_trip():
    res = run([_t(1, -1), _t(10, -1), _t(30, -1)])
    assert res.tripped and "3 consecutive losses" in res.reason


def test_simultaneous_stop_outs_are_one_event():
    # Live EUR case: five bots stopped out inside 3 seconds by one move.
    # (Hours chosen outside the 4h cumulative window to isolate the streak rule.)
    assert not run([_t(6, -1, minutes=m) for m in (0, 0, 0, 0, 0)]).tripped


def test_clusters_still_count_once_each():
    res = run([_t(6, -1), _t(6, -1, minutes=5), _t(20, -1), _t(30, -1), _t(30, -1, minutes=3)])
    assert res.tripped  # three distinct events


def test_losses_spread_beyond_48h_do_not_form_a_streak():
    # Live BTC case: four losses across five days.
    assert not run([_t(13, -0.96), _t(61, -0.96), _t(109, -0.99), _t(124, -1)]).tripped


def test_win_breaks_the_streak():
    assert not run([_t(1, -1), _t(5, -1), _t(8, 2.0), _t(20, -1)]).tripped


def test_scratch_is_neutral():
    assert not run([_t(1, -1), _t(5, -0.03), _t(10, -1)]).tripped     # scratch doesn't count...
    assert run([_t(1, -1), _t(5, -0.03), _t(10, -1), _t(20, -1)]).tripped  # ...nor break it


def test_cumulative_four_hour_cutout_unchanged():
    # One simultaneous 5R hit inside 4h still earns the short cooldown.
    res = run([_t(1, -1, minutes=m) for m in (0, 0, 0, 0, 0)])
    assert res.tripped and "cumulative loss" in res.reason


def test_empty_history_never_trips():
    assert not run([]).tripped
