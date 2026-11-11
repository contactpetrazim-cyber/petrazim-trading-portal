-- 030: Recommended Bots rollout (2026-11-11) — DATA migration, applied
-- once directly against Supabase; kept here as the auditable record and
-- the exact revert. By direct request: "the testing phase is finished
-- ... create new bots for each instrument pair ... to start trading each
-- pair afresh. Pause all the ongoing bots."
--
-- Selection rule (per instrument): rank every bot family that traded it
-- by evidence-weighted expectancy = avg R x sqrt(closed trades), eligible
-- only with n >= 5, total PnL > 0 and profit factor > 1; take the top two.
-- Brent has only one bot that qualifies even loosely (bot_3, n=3), so it
-- gets one bot, not two — no losing bot is created to fill a slot.
--
--   BTCUSDT.P               bot_3 (n=50, 82% win, +3.50R)   bot_7  (n=14, 86%, +3.05R)
--   EURUSDT.P               bot_3 (n=25, 76%, +2.21R)       bot_2  (n=6, 50%, +0.25R)
--   JPYUSDT.P               bot_8 (n=19, 58%, +0.21R)       bot_3  (n=11, 64%, +0.12R)
--   NAS100USDT.P            bot_3 (n=18, 50%, +0.13R)       bot_17 (n=14, 50%, +0.07R)
--   NCCO1OILBRENT2USDUSDT.P bot_3 (n=3, 33%, +1.26R)        — none qualifies —
--   NCCO1OILWTI2USDUSDT.P   bot_3 (n=17, 65%, +0.67R)       bot_8  (n=6, 50%, +0.21R)
--   XAUTUSDT.P              bot_12 (n=9, 78%, +0.71R)       bot_17 (n=33, 61%, +0.33R)
--
-- Each new bot is a clone of the source instance that produced that
-- evidence (its config verbatim: strategy_key, risk, R:R, trailing,
-- exchange, mode, balance), narrowed to the one instrument, owned by
-- the platform Super Admin so all 13 sit under one Instrument Focus
-- (max 3 instruments at a time — services/instrument_selection.py).
-- bot_id carries "_rec_" — the convention the Bots page's "Recommended
-- Bots" card keys on (frontend lib/botGrading.ts isRecommendedBot).
--
-- Open trades on paused bots are untouched: position_monitor.py manages
-- every ACTIVE trade to completion regardless of its bot's status.

BEGIN;

INSERT INTO bot_configs (
  id, bot_id, bot_name, bot_type, strategy_key, user_id, status, execution_mode, bot_mode, margin_mode,
  trading_mode, paper_trading_enabled, symbols, timeframes, exchange, exchange_mode,
  risk_per_trade, max_daily_trades, max_concurrent_trades, max_portfolio_exposure, min_rr_ratio,
  entry_types, limit_order_offset, use_trailing_stop, trailing_stop_activation, trailing_stop_distance,
  tp1_percent, tp2_percent, tp3_percent, require_mtf_alignment, require_liquidity_sweep,
  require_fvg_confirmation, require_order_block, batch_size, batch_allocation, strategy_params,
  strategy_engine, account_balance_usd, leverage, schedule_sessions, schedule_days, schedule_half_day,
  sub_auto_active, sub_auto_trades_executed, sub_auto_daily_count, created_at, updated_at
)
SELECT
  gen_random_uuid(), r.new_id, r.new_name, s.bot_type, s.strategy_key, '4d703396-b4e0-4561-a098-a8f6eb97f5b7'::uuid,
  'ACTIVE', s.execution_mode, s.bot_mode, s.margin_mode,
  s.trading_mode, s.paper_trading_enabled, json_build_array(r.sym), s.timeframes, s.exchange, s.exchange_mode,
  s.risk_per_trade, s.max_daily_trades, s.max_concurrent_trades, s.max_portfolio_exposure, s.min_rr_ratio,
  s.entry_types, s.limit_order_offset, s.use_trailing_stop, s.trailing_stop_activation, s.trailing_stop_distance,
  s.tp1_percent, s.tp2_percent, s.tp3_percent, s.require_mtf_alignment, s.require_liquidity_sweep,
  s.require_fvg_confirmation, s.require_order_block, s.batch_size, s.batch_allocation, coalesce(s.strategy_params, '{}'::json),
  s.strategy_engine, s.account_balance_usd, s.leverage, s.schedule_sessions, s.schedule_days, s.schedule_half_day,
  false, 0, 0, now(), now()
FROM (VALUES
  ('bot_3_rec_btcusdt',    'Recommended · Bot 3 FVG Expansion · BTC',            'BTCUSDT.P',               'bot_3_fvg_expansion'),
  ('bot_7_rec_btcusdt',    'Recommended · Bot 7 FVG Expansion v3 · BTC',         'BTCUSDT.P',               'bot_7_fvg_expansion_v3'),
  ('bot_3_rec_eurusdt',    'Recommended · Bot 3 FVG Expansion · EUR',            'EURUSDT.P',               'bot_3_fvg_expansion_2'),
  ('bot_2_rec_eurusdt',    'Recommended · Bot 2 OB Reversal · EUR',              'EURUSDT.P',               'bot_2_ob_reversal_2'),
  ('bot_8_rec_jpyusdt',    'Recommended · Bot 8 SMC v2 Single-Anchor · JPY',     'JPYUSDT.P',               'bot_8_smc_v2_single_anchor_3'),
  ('bot_3_rec_jpyusdt',    'Recommended · Bot 3 FVG Expansion · JPY',            'JPYUSDT.P',               'bot_3_fvg_expansion_2'),
  ('bot_3_rec_nas100',     'Recommended · Bot 3 FVG Expansion · NAS100',         'NAS100USDT.P',            'bot_3_fvg_expansion_3'),
  ('bot_17_rec_nas100',    'Recommended · Bot 17 FVG OB-POI · NAS100',           'NAS100USDT.P',            'bot_17_fvg_expansion_ob_poi_3'),
  ('bot_3_rec_brent',      'Recommended · Bot 3 FVG Expansion · Brent',          'NCCO1OILBRENT2USDUSDT.P', 'bot_3_fvg_expansion_4'),
  ('bot_3_rec_wti',        'Recommended · Bot 3 FVG Expansion · WTI',            'NCCO1OILWTI2USDUSDT.P',   'bot_3_fvg_expansion_4'),
  ('bot_8_rec_wti',        'Recommended · Bot 8 SMC v2 Single-Anchor · WTI',     'NCCO1OILWTI2USDUSDT.P',   'bot_8_smc_v2_single_anchor_5'),
  ('bot_12_rec_xautusdt',  'Recommended · Bot 12 OB Reversal Runner · XAUT',     'XAUTUSDT.P',              'bot_12_ob_reversal_runner_2'),
  ('bot_17_rec_xautusdt',  'Recommended · Bot 17 FVG OB-POI · XAUT',             'XAUTUSDT.P',              'bot_17_fvg_expansion_ob_poi_2')
) AS r(new_id, new_name, sym, source_id)
JOIN bot_configs s ON s.bot_id = r.source_id
ON CONFLICT (bot_id) DO NOTHING;

-- Pause every previously active bot (the 66 listed in the revert below).
UPDATE bot_configs SET status = 'PAUSED', updated_at = now()
WHERE status = 'ACTIVE' AND bot_id !~ '^bot_[0-9]+_rec_';

COMMIT;

-- ── REVERT (run manually only if the rollout must be undone) ─────────
-- BEGIN;
-- UPDATE bot_configs SET status = 'ACTIVE', updated_at = now() WHERE bot_id IN (
--   'bot_1_macro_swing','bot_1_macro_swing_2','bot_1_macro_swing_3','bot_10_volume_liq_held_reclaim',
--   'bot_10_volume_liq_held_reclaim_2','bot_11_ob_reversal_wider_stop','bot_11_ob_reversal_wider_stop_2',
--   'bot_11_ob_reversal_wider_stop_3','bot_11_ob_reversal_wider_stop_4','bot_12_ob_reversal_runner',
--   'bot_12_ob_reversal_runner_2','bot_12_ob_reversal_runner_3','bot_12_ob_reversal_runner_4',
--   'bot_13_fvg_expansion_htf_gated','bot_14_jeafx_htf_gated','bot_15_smc_v2_early_trail',
--   'bot_16_single_anchor_early_trail','bot_17_fvg_expansion_ob_poi','bot_17_fvg_expansion_ob_poi_2',
--   'bot_17_fvg_expansion_ob_poi_3','bot_17_fvg_expansion_ob_poi_4','bot_18_smc_v2_ob_poi',
--   'bot_18_smc_v2_ob_poi_2','bot_18_smc_v2_ob_poi_3','bot_18_smc_v2_ob_poi_4','bot_18_smc_v2_ob_poi_5',
--   'bot_19_smc_v2_1h_entry','bot_19_smc_v2_1h_entry_2','bot_19_smc_v2_1h_entry_3','bot_19_smc_v2_1h_entry_4',
--   'bot_19_smc_v2_1h_entry_5','bot_2_ob_reversal','bot_2_ob_reversal_2','bot_2_ob_reversal_3',
--   'bot_2_ob_reversal_4','bot_20_jeafx_1h_entry','bot_20_jeafx_1h_entry_2','bot_20_jeafx_1h_entry_3',
--   'bot_20_jeafx_1h_entry_3_copy','bot_21_smc_v2_single_anchor_1h_entry','bot_21_smc_v2_single_anchor_1h_entry_2',
--   'bot_21_smc_v2_single_anchor_1h_entry_3','bot_21_smc_v2_single_anchor_1h_entry_4',
--   'bot_21_smc_v2_single_anchor_1h_entry_5','bot_22_jeafx_htf_gated_1h_entry','bot_3_fvg_expansion',
--   'bot_3_fvg_expansion_2','bot_3_fvg_expansion_3','bot_3_fvg_expansion_4','bot_5_jeafx','bot_5_jeafx_2',
--   'bot_5_jeafx_3','bot_5_jeafx_3_copy','bot_6_smc_v2','bot_6_smc_v2_2','bot_6_smc_v2_3','bot_6_smc_v2_4',
--   'bot_6_smc_v2_5','bot_7_fvg_expansion_v3','bot_8_smc_v2_single_anchor','bot_8_smc_v2_single_anchor_2',
--   'bot_8_smc_v2_single_anchor_3','bot_8_smc_v2_single_anchor_4','bot_8_smc_v2_single_anchor_5',
--   'bot_9_volume_liq_wide_range','bot_9_volume_liq_wide_range_2');
-- UPDATE bot_configs SET status = 'PAUSED', updated_at = now() WHERE bot_id ~ '^bot_[0-9]+_rec_';
-- COMMIT;
