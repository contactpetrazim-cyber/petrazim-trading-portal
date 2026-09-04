# Honest Gap — Master Curriculum Content Map (Phase 1)

Machine-ingestion-ready hierarchy. Every leaf node below becomes one
lesson/quiz/drill/flashcard-set object with: unique ID, title,
category, difficulty, prerequisites, learning objectives, tags,
related bots, assessment, mastery requirement — per the mandatory
schema. IDs are stable strings; content authored under a given ID can
be revised without breaking references from the quiz bank, flashcards,
or the progression engine's TrackStage.lesson_id foreign key.

Status legend: [DONE] authored this batch, [ ] mapped, not yet authored

---

## PART 0 — HONEST GAP ORIENTATION (ORIENT)
- [DONE] ORIENT-01 What Honest Gap Is (and Isn't)
- [DONE] ORIENT-02 Trading vs. Gambling, Signal vs. Setup vs. Trade
- [DONE] ORIENT-03 Framework vs. Proven Edge — Why Probability Matters
- [DONE] ORIENT-04 Why Losses Are Normal, Why Risk Management Beats Being Right
- [DONE] ORIENT-05 How to Use Learn / Practise / Mastery — a Learner's Map
- [DONE] ORIENT-06 How the Five Bots Relate to One Another

## CORE 1 — MARKET BASICS (C1)
- [DONE] C1-01 What a Market Is — Buyers, Sellers, Price, Bid/Ask, Spread
- [DONE] C1-02 Candlestick Anatomy — Open, High, Low, Close, Body, Wick
- [DONE] C1-03 Bullish vs. Bearish Candles, Momentum, Expansion & Contraction
- [DONE] C1-04 Liquidity and Volatility — First Look
- [DONE] C1-05 Timeframes and Chart Navigation
- [DONE] C1-06 Sessions, Market Open/Close, Gaps

## CORE 2 — MARKET STRUCTURE (C2)
- [DONE] C2-01 Swing Highs and Swing Lows
- [DONE] C2-02 Higher Highs/Lows, Lower Highs/Lows — Defining Trend
- [DONE] C2-03 Trend vs. Range vs. Transition
- [DONE] C2-04 Internal vs. External Structure
- [DONE] C2-05 Protected Highs and Lows
- [DONE] C2-06 BOS — Break of Structure
- [DONE] C2-07 CHoCH — Change of Character
- [DONE] C2-08 Wick vs. Body Break, Displacement, False Break
- [DONE] C2-09 Structural Invalidation

## CORE 3 — LIQUIDITY (C3)
- [DONE] C3-01 What Liquidity Means in This Framework
- [DONE] C3-02 Buy-Side / Sell-Side Liquidity, Equal Highs/Lows
- [DONE] C3-03 Trendline Liquidity, Liquidity Pools
- [DONE] C3-04 Liquidity Sweeps — Sweep vs. Breakout vs. Random Wick
- [DONE] C3-05 Sweep + Displacement + CHoCH — Reading Sequences
- [DONE] C3-06 Why Not Every Pool Is Tradable

## CORE 4 — SUPPLY, DEMAND & ZONES (C4)
- [DONE] C4-01 Supply and Demand, Origin of Displacement
- [DONE] C4-02 Order Blocks — Bullish and Bearish
- [DONE] C4-03 Breaker Blocks and Mitigation Blocks
- [DONE] C4-04 Fresh / Tested / Mitigated / Invalid Zones
- [DONE] C4-05 Zone Boundaries — Body vs. Full-Range vs. Wick-Inclusive
- [DONE] C4-06 Zone Age, Zone Quality, Confluence

## CORE 5 — FAIR VALUE GAPS & IMBALANCE (C5)
- [DONE] C5-01 What Imbalance Means, FVG Formation
- [DONE] C5-02 Bullish/Bearish FVG, Minimum Gap
- [DONE] C5-03 FVG Fill — Partial, Full, Inversion, Retracement
- [DONE] C5-04 FVG vs. Ordinary Price Noise — When Not to Trade It

## CORE 6 — PREMIUM / DISCOUNT (C6)
- [DONE] C6-01 Dealing Range, External Leg, Equilibrium
- [DONE] C6-02 Premium and Discount, Long/Short Location
- [DONE] C6-03 Multiple Dealing Ranges, Interaction With Liquidity/Zones

## CORE 7 — MULTI-TIMEFRAME ANALYSIS (C7)
- [DONE] C7-01 The Five-Layer Stack — Macro/Direction/Opportunity/Trigger/Execution
- [DONE] C7-02 MTF Alignment vs. Conflict, Transition States
- [DONE] C7-03 Long/Short Decision Trees, No-Trade Conditions

## CORE 8 — RISK MANAGEMENT (C8)
- [DONE] C8-01 Risk Per Trade, Fixed Fractional Sizing
- [DONE] C8-02 Stop-Loss, Invalidation, R-Multiple
- [DONE] C8-03 Reward-to-Risk, Partial Exits, Breakeven, Trailing
- [DONE] C8-04 Max Daily/Weekly Loss, Correlated Exposure
- [DONE] C8-05 Leverage, Margin, Spread, Slippage, Fees
- [DONE] C8-06 Kill Switches and Circuit Breakers
- [DONE] C8-07 Why a "3:1 Setup" Does Not Equal 3:1 Realized Expectancy

## CORE 9 — TRADE MANAGEMENT (C9)
- [DONE] C9-01 Before Entry Through Exit — the Full Lifecycle
- [DONE] C9-02 Valid Loss vs. Bad Loss, Good Trade That Loses vs. Bad Trade That Wins
- [DONE] C9-03 Judging Process Separately From Outcome

## CORE 10 — TRADING PSYCHOLOGY (PSY)
- [DONE] PSY-01 Emotional Regulation Under Live Risk
- [DONE] PSY-02 Cognitive Errors: Confirmation Bias, Recency, Overconfidence
- [DONE] PSY-03 Behavioural Discipline: Following Your Own Rules Under Pressure
- [DONE] PSY-04 Process Psychology: Plan, Observe, Decide, Execute, Record, Review, Improve
- [DONE] PSY-05 Pre-Trade Checklist Discipline
- [DONE] PSY-06 Post-Trade Review Without Self-Deception
- [DONE] PSY-07 Detectors: Impulse, Revenge Trading, FOMO
- [DONE] PSY-08 Confidence Calibration: Matching Certainty to Actual Edge
- [DONE] PSY-09 Shutdown Protocol: Recognizing When to Stop for the Day
- [DONE] PSY-10 Psychology Capstone

## BOT SPECIALIZATIONS (BOT1-BOT5)
Each: 10-lesson sequence (Concept, Identification, Context, Setup,
Invalidation, Entry, Management, Failure, Practice, Capstone), verified
line-by-line against each bot's real `analyze()` pipeline in
`backend/app/core/bot_strategies.py` — not generic SMC content restyled
per bot.

- [DONE] BOT1-01 through BOT1-10 — Bot 1, Macro Swing Structure
  (Damir/Brooks style: 1D trend + 4H BOS confirmation, 5:1 target)
- [DONE] BOT2-01 through BOT2-10 — Bot 2, Order Block Reversal (ICT
  style: 4H-then-1H zone fallback, 15M CHoCH, sweep-conditional
  entry/stop, 3:1 target)
- [DONE] BOT3-01 through BOT3-10 — Bot 3, Imbalance Expansion
  (Photon/Phantom style: 1H FVG 30-70% mitigation window, 15M BOS,
  hand-calculated entry/stop, 4:1 target)
- [DONE] BOT4-01 through BOT4-10 — Bot 4, Volume & Liquidity Sweep
  (Dalton/Weis/Wyckoff style: 6-swing range, Spring/Upthrust with
  volume divergence, CHoCH pairing, single flat target)
- [DONE] BOT5-01 through BOT5-10 — Bot 5, Liquidity Purge Specialist
  (Jeafx SMC style — renamed per the Phase 1 rebrand, content
  preserved; refined-zone test_count filter, 5M confirmation candle,
  fixed 2:1 target). Completes all 5 bot specialization tracks
  (50 lessons total).

## ORDER FLOW TRADING (OF) — added outside the original 17-phase plan,
per direct request; category ADVANCED (first real use of that
TrackCategory value).
- [DONE] OF-01 Concept — What Order Flow Actually Is
- [DONE] OF-02 Reading the Tape — Time & Sales and Aggressor Side
- [DONE] OF-03 Volume Profile — Value Area, POC, and Auction Market Theory
- [DONE] OF-04 Footprint Charts and Bid/Ask Delta
- [DONE] OF-05 The Order Book and DOM — Visible Liquidity vs. Real Intent
- [DONE] OF-06 Absorption and Exhaustion
- [DONE] OF-07 Order Flow Setups — Divergence, Absorption Reversals, POC Rejection
- [DONE] OF-08 Common Order Flow Manipulation — Spoofing, Layering, Stop Hunts
- [DONE] OF-09 Common Mistakes in Order Flow Trading
- [DONE] OF-10 Order Flow + SMC Synthesis
- [DONE] OF-11 Capstone — Full Order Flow Read

## BOOK KNOWLEDGE (BOOK)
- [DONE] BOOK-01 Al Brooks — Price Action in Context
- [DONE] BOOK-02 James Dalton — Auction Market Theory
- [DONE] BOOK-03 Richard Wyckoff — The Historical Foundation
- [DONE] BOOK-04 David Weis — Wyckoff's Method, Modernized
- [DONE] BOOK-05 Mark Douglas — The Psychology of Probabilistic Thinking
- [DONE] BOOK-06 Cross-Framework Synthesis

## MARKET REGIMES (REGIME), BOT SELECTION (SELECT)
- [ ] 12 regimes; regime-to-bot matrix, confidence matrix, no-trade matrix.

## PRACTICE (PRAC), QUIZ BANK (QUIZ), FLASHCARDS (CARD)
- [ ] Practice prompt types (12 categories) populated per concept above.
- [ ] Quiz bank populated per concept, tagged by bot/level/difficulty.
- [ ] Flashcard sets populated per concept.

## GAMES & VISUALS (GAME, VIS)
- [ ] Missions, boss challenges, detective/radar/map metaphors per spec.
- [ ] Visual specs (staircase, liquidity map, OB/FVG lifecycle, etc.)

## MISCONCEPTIONS (MISC) & ERRORS (ERR)
- [ ] 100+ misconceptions, error taxonomy — both per the specified format.

## CAPSTONES (CAP)
- [ ] Per-core, per-bot, psychology, risk-management, final portfolio exam.

---

Authoring order from here (matches the brief's own 17-phase plan):
Core 0-2 remainder -> Core 3-5 -> Core 6-10 (incl. Psychology, done)
-> Bot 1-5 -> Book Knowledge (done) -> Practice/Drills -> Quiz Bank ->
Flashcards -> Games/Visuals -> Capstones -> final QA pass.
