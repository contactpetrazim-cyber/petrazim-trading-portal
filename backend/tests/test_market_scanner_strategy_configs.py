from dataclasses import dataclass
from typing import Optional

from app.services.market_scanner import MarketScanner


@dataclass
class FakeBotConfig:
    """Minimal stand-in for BotConfig — _build_strategy_configs only
    ever reads bot_id/strategy_key/strategy_params, so a real ORM
    instance (with its DB-session ties) isn't needed to test it."""
    bot_id: str
    strategy_key: Optional[str]
    strategy_params: Optional[dict]


class TestBuildStrategyConfigs:
    def test_no_bots_returns_empty(self):
        assert MarketScanner._build_strategy_configs([]) == {}

    def test_all_empty_params_yields_empty_config_for_family(self):
        bots = [
            FakeBotConfig("bot_2_ob_reversal", "bot_2", {}),
            FakeBotConfig("bot_2_ob_reversal_2", "bot_2", None),
        ]
        assert MarketScanner._build_strategy_configs(bots) == {"bot_2": {}}

    def test_single_row_with_params_applies_to_whole_family(self):
        bots = [FakeBotConfig("bot_1_macro_swing", "bot_1", {"left_bars": 7})]
        assert MarketScanner._build_strategy_configs(bots) == {"bot_1": {"left_bars": 7}}

    def test_multiple_rows_agreeing_applies_that_config(self):
        bots = [
            FakeBotConfig("bot_3_fvg_expansion", "bot_3", {"left_bars": 4}),
            FakeBotConfig("bot_3_fvg_expansion_2", "bot_3", {"left_bars": 4}),
            FakeBotConfig("bot_3_fvg_expansion_3", "bot_3", {}),  # empty row doesn't count as disagreement
        ]
        assert MarketScanner._build_strategy_configs(bots) == {"bot_3": {"left_bars": 4}}

    def test_conflicting_rows_in_same_family_fall_back_to_empty(self):
        """The real architectural limit: BotOrchestrator has one shared
        instance per family, so two sibling rows wanting DIFFERENT
        tuning can't both be honored. Must fail safe (today's original
        hardcoded default), never silently pick one row's config."""
        bots = [
            FakeBotConfig("bot_2_ob_reversal", "bot_2", {"left_bars": 4}),
            FakeBotConfig("bot_2_ob_reversal_2", "bot_2", {"left_bars": 6}),
        ]
        assert MarketScanner._build_strategy_configs(bots) == {"bot_2": {}}

    def test_independent_families_dont_interfere(self):
        bots = [
            FakeBotConfig("bot_1_macro_swing", "bot_1", {"left_bars": 8}),
            FakeBotConfig("bot_5_jeafx", "bot_5", {"right_bars": 3}),
        ]
        result = MarketScanner._build_strategy_configs(bots)
        assert result == {"bot_1": {"left_bars": 8}, "bot_5": {"right_bars": 3}}

    def test_bot_with_no_strategy_key_is_skipped(self):
        bots = [FakeBotConfig("legacy_row", None, {"left_bars": 9})]
        assert MarketScanner._build_strategy_configs(bots) == {}
