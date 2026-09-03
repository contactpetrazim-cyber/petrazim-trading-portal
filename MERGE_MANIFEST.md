# MERGE MANIFEST — Consolidating All Petrazim v2/v3 Packages

Across this conversation you've received seven zips (the sandbox this
assistant works in resets between some turns, so each zip only
contains what was built in that session — nothing is duplicated
unnecessarily, but nothing after the first zip is a complete project
on its own either). This document is the map for putting them all
together into one real repository. This is exactly the kind of task
Claude Code in your GitHub Codespace should do directly — it can
actually unzip, diff, and move files on a real filesystem, which this
chat interface cannot do for content from previous turns it no longer
has access to.

## The seven packages, in build order

1. petrazim_v2_phase1to6_additions.zip — Monte Carlo engine,
   no-lookahead backtest engine, go-live validation gate + attestation
   audit trail, Weekly Review Engine (coach debrief), SQL migration +
   SQLAlchemy repository layer for all of the above.
2. petrazim_v3_phase1and2.zip — User/role model (Trader/Fund
   Manager/Partner/Admin/Super Admin), JWT auth with server-side role
   guards, unified login page, role-colored badges, Super Admin seed
   script, payment/access-tier models, Telegram bot service + webhook
   auto-approval.
3. petrazim_v3_explore_concepts_1to5.zip — Standalone Probability
   Coach, Risk-of-Ruin Calculator, Prop-Firm Challenge Simulator,
   Correlation Heat Map, Tiered Signal Broadcast.
4. petrazim_v3_reference_aligned_lms.zip — Locked-sequence stage
   progression, XP/streak engine, certificates, LearningPathCard.tsx.
5. petrazim_v3_onboarding_corporate_seats.zip — Corporate seat-code
   generator (N unique codes per N seats), payment-success webhook,
   mandatory community gate, full onboarding flow orchestrator.
6. petrazim_v3_tradingview_and_curriculum.zip — Free TradingView
   widget + split-screen chart page, Honest Gap curriculum content map
   + authored Part 0/Core 1 lessons + book knowledge + SVG diagrams.
7. This package — Full TradingView frame ("Petrazim Trading Frame" TV
   bezel) with blocked-frame detection, the 8th nav tab (TradingView),
   FoldedCard.tsx (site-wide collapsed-card primitive), SiteMapPage.tsx.

## Target directory structure (after merging all seven)

    petrazim/
    |-- backend/
    |   `-- app/
    |       |-- core/auth.py                          [from #2]
    |       |-- database.py                           [ORIGINAL base repo -- see note below]
    |       |-- engines/
    |       |   |-- monte_carlo_engine.py             [from #1]
    |       |   |-- backtest_engine.py                [from #1]
    |       |   |-- validation_gate.py                [from #1]
    |       |   |-- weekly_review_engine.py           [from #1]
    |       |   |-- standalone_coach_engine.py        [from #6]
    |       |   |-- risk_of_ruin_calculator.py        [from #6]
    |       |   |-- prop_firm_simulator.py            [from #6]
    |       |   |-- correlation_engine.py             [from #6]
    |       |   |-- journal_reviewer.py               [from #5]
    |       |   |-- payout_optimizer.py               [from #5]
    |       |   `-- progression_engine.py             [from #4]
    |       |-- models/
    |       |   |-- user.py                           [from #2]
    |       |   |-- access.py                         [from #2]
    |       |   |-- telegram_link.py                  [from #2]
    |       |   |-- curriculum.py                     [from #4]
    |       |   |-- marketplace.py                    [from #5, Explore #6]
    |       |   |-- white_label.py                    [from #5, Explore #7]
    |       |   `-- signal_api.py                     [from #5, Explore #8]
    |       |-- routers/
    |       |   |-- auth.py, admin.py                 [from #2]
    |       |   |-- monte_carlo.py                    [from #1]
    |       |   |-- validation_gate.py                [from #1]
    |       |   |-- weekly_review.py                  [from #1]
    |       |   |-- payments.py                       [from #2]
    |       |   |-- payment_webhooks.py               [from #6]
    |       |   |-- corporate.py                      [from #6]
    |       |   |-- onboarding.py                     [from #6]
    |       |   `-- telegram_webhook.py               [from #2]
    |       |-- services/
    |       |   |-- payments.py, telegram.py          [from #2]
    |       |   |-- signal_broadcast.py               [from #3]
    |       |   `-- corporate_codes.py                [from #6]
    |       |-- scripts/seed_super_admin.py           [from #2]
    |       `-- db/session.py, models.py, repository.py [from #1]
    |   |-- migrations/
    |   |   |-- 001_create_core_tables.sql            [from #1]
    |   |   |-- 002_users_and_roles.sql               [from #2]
    |   |   `-- 003_access_payments_telegram.sql      [from #2]
    |   `-- tests/ (all *_test.py files from #1)
    |
    |-- frontend/
    |   `-- src/
    |       |-- assets/petrazim_logo.jpg              [from #6]
    |       |-- config/
    |       |   |-- theme.ts                          [from #6]
    |       |   `-- featureRegistry.ts                [USE #7's VERSION -- newest]
    |       |-- components/
    |       |   |-- PetrazimLogo.tsx, TopNav.tsx      [from #6]
    |       |   |-- GlobalSearchModal.tsx             [from #6]
    |       |   |-- FloatingTradeAI.tsx               [from #6]
    |       |   |-- TradingViewChart.tsx              [from #6]
    |       |   |-- LearningPathCard.tsx              [from #4]
    |       |   |-- RegistrationGateCard.tsx          [from #5]
    |       |   |-- CommunityGateStep.tsx             [from #5]
    |       |   |-- StartHereCard.tsx                 [from #5]
    |       |   `-- FoldedCard.tsx                    [from #7 -- NEW]
    |       `-- pages/
    |           |-- ChartPage.tsx                     [from #6]
    |           |-- OnboardingPage.tsx                [from #5]
    |           |-- TradingViewFramePage.tsx          [from #7 -- NEW]
    |           `-- SiteMapPage.tsx                   [from #7 -- NEW]
    |
    `-- curriculum/
        |-- 00_MASTER_CONTENT_MAP.md                  [from #6]
        |-- PART_0_ORIENTATION.md                     [from #6]
        |-- CORE_1_MARKET_BASICS.md                   [from #6]
        |-- BOOK_KNOWLEDGE.md                         [from #6]
        `-- visuals/*.svg                             [from #6]

## Known conflicts to resolve (not guesses — flagged explicitly)

- featureRegistry.ts exists in both #6 and #7. Use #7's version — it's
  the same file with the TradingView tab and entries added. #6's copy
  is now stale.
- app/models/access.py was recreated identically in #2, #5, and #6
  (dependency reconstruction each time the sandbox reset). They should
  be byte-identical — if diff shows any difference, that's a real bug
  to fix, not a stylistic choice between versions.
- app/models/telegram_link.py — same situation, recreated in #2 and #6.
- RegistrationGateCard.tsx exists in an earlier, simpler form and a
  later recreated form (#5) — use #5's, and note the flagged gap in it
  (no password field, documented inline in OnboardingPage.tsx).

## database.py and the original bot engines — one real gap

None of these seven packages include app/database.py, app/config.py,
or the original Phase-1 bot-evaluator/risk-engine code — those live in
your ORIGINAL codebase (the one extracted from local-repo-converted.txt
early in this conversation, before any of this assistant's additions).
Every file above imports from app.database assuming it already exists
there. Merging means layering these seven packages on top of that
original codebase, not replacing it.

## Recommended merge sequence (for Claude Code)

1. Start from your original repo (the one with app/database.py,
   app/config.py, the bot evaluators, and the existing frontend App.tsx).
2. Unzip #1 into it — pure additions, no conflicts.
3. Unzip #2 — introduces models/user.py; wire app/main.py to include
   the new routers (auth, admin, payments, telegram_webhook).
4. Unzip #3, #4, #5 in order — mostly additive; watch for the
   access.py/telegram_link.py duplicate recreations noted above.
5. Unzip #6, then #7 last (#7's featureRegistry.ts wins over #6's).
6. Apply the App.tsx routing diff from App.tsx.DIFF_NOTES.txt (built
   earlier, in package #2) to wire every new page into actual routes.
7. Run pip install -r requirements.txt (+ requirements-additions.txt
   from #1) and npm install, then try a real local run — this is where
   integration bugs between files written in different sandbox sessions
   will actually surface, which no amount of chat-based review can
   catch without a running process.
8. Run the SQL migrations in order (001, 002, 003) against your
   Postgres instance.

This is genuinely faster and more reliable done by Claude Code with
real file access than by continuing to generate zips here — it can
verify each step actually works rather than trusting cross-session
consistency by memory.

---

## Package #8 (this round) — TradingView reality-check + alignment audit

- docs/TRADINGVIEW_BOUNDARY_TABLE.md — verified against current
  official TradingView docs (not assumed).
- docs/ARCHITECTURE_ALIGNMENT_CHECK.md — full spec vs. built-so-far audit.
- backend/app/models/chart_layout.py, backend/app/routers/chart_layouts.py
  — Petrazim's own chart save/load backend (Alternative B).
- frontend/src/components/OpenInTradingView.tsx — deep-link alternative (Alternative C).
- frontend/src/pages/TradingViewFramePage.tsx — REPLACES the #7 version;
  the old iframe-detection approach is superseded by the three-mode
  chooser now that TradingView's real constraints are confirmed, not guessed.

**Conflict resolution:** use #8's TradingViewFramePage.tsx, discard #7's.

---

## Package #9 (this round) — Access expiry lockout, exact card match

- backend/app/core/access_gate.py — require_active_access() dependency,
  blocks with a 402 + structured detail (title/message/progress/promo_hint)
  once UserAccess has expired. Add this as a dependency (alongside or
  instead of get_current_user) on any router that should be fully
  locked post-expiry.
- frontend/src/components/AccessExpiredGate.tsx — REPLACES any earlier
  version. Wrap the app root with this once; use apiFetch() instead of
  raw fetch() on protected calls so the 402 is caught automatically.
- Verified: exact copy format matches the specified example
  byte-for-byte ("30/08/2026, 02:41:45" style). Visual layout confirmed
  against the provided reference screenshot — same structure, same
  icon/progress-box/button arrangement, Petrazim's blue gradient and
  terminology substituted in.
- Progress numbers (stages/tracks/XP) are REAL, computed from
  StageCompletion/TrackStage/UserLearningStats — not placeholder text.

---

## Package #10 — Weekly curriculum cycle + email confirmations

- backend/app/services/curriculum_cycle.py — the Mon-Sat, 12-module,
  2-cycles-included weekly schedule engine. 12-module mapping is an
  explicit adaptation (the Academy's "Pillar 1-12" doesn't map 1:1 —
  see the file docstring for the substitution used, correct it if a
  different 12 is wanted).
- backend/app/services/email.py — cycle + standalone confirmation
  email content (join link first, matching the confirmed working
  pattern), transport itself stubbed pending a real provider.
- Both fully tested: 90-day generation, non-Monday rejection, next-
  occurrence lookup (including the tricky same-day and exact-Monday
  edge cases), cycle coverage checks, standalone booking cap, and
  join-link-first email formatting — all verified above, not just
  written.

---

## Package #11 — Flow order correction: Register -> Pay -> Community -> Trade

Only the artifact's decorative hero-copy needed changing — checked
first, and the actual backend state machine (onboarding.py) and the
real orchestrator (OnboardingPage.tsx) were ALREADY built with
Payment before Community all along. The mismatch was purely cosmetic,
introduced when the artifact's flow text was changed per a request
two rounds back without looping that change into the real code (that
gap was flagged explicitly at the time, then never actually applied —
turns out the "real" order was right and only the preview text was wrong).

No backend or OnboardingPage.tsx changes in this package — nothing to
ship there, formatting/styling of the flow banner is unchanged, only
the word order of "Pay" and "Join Community" swapped back.

---

## Package #12 — Roster management + access codes UI + facilitator fixes

Direct answer: yes, the unified login was built (Phase 1) — this
package fills in what was genuinely missing, which your Academy status
update surfaced clearly by comparison.

- backend/app/models/roster.py + backend/app/routers/roster.py — invite
  a Trader (creates account + one-time password, same pattern as
  corporate seats), assign/reassign/detach, and a role-scoped roster
  list (Admin sees everyone, Fund Manager/Partner see only their own —
  verified above via the scoping logic test).
- frontend/src/components/RosterPanel.tsx — mounted on both
  ManagerConsolePage.tsx and PartnerConsolePage.tsx.
- frontend/src/components/AccessCodesPanel.tsx — this was a real gap:
  the corporate seat-code BACKEND has existed since an earlier package
  and was fully tested, but never had a UI. Closed now, mounted
  alongside RosterPanel on both consoles.
- Facilitator calendar: Sundays now excluded from the strip entirely
  (not shown as a zero-availability day — genuinely absent), with a
  server-side rejection as defense in depth even if a Sunday slot is
  requested directly. Verified: Saturday still fully bookable — only
  Sunday is excluded, not the whole weekend.
- "Switch Portal" added to the Settings panel — the missing "Select
  portal" entry, adapted.
- migrations/005_roster_assignments.sql

**Still queued, unchanged from before:** Google OAuth wiring (real
credentials exist, the call flow itself doesn't yet), expiry-lockdown
applied consistently across every learner sub-route (currently only
/meetings uses the gate), Fireflies post-meeting summary + Daily.co
fallback, and the weekly-cycle group-class frontend (the backend
engine — curriculum_cycle.py — is built and tested; it has no UI yet,
and when built it should follow the "no seat counts, just
available/fully booked" messaging principle from the start, per this
round's feedback).

---

## Package #13 (FINAL, this round) — Portal system + login card + logo consistency

- backend/app/services/portal_access.py — the downward-only portal
  hierarchy, fully tested (verified: no role can reach a portal above
  or sideways from it; Trader correctly skips the selection screen
  entirely since it has only one option).
- backend/app/core/portal_gate.py — require_portal_access() dependency,
  the server-side enforcement (never trust a client "I selected portal
  X" claim).
- backend/app/routers/portals.py — GET /auth/available-portals, the
  data source for the frontend selection screen.
- migrations/005_roster_assignments.sql (from the previous round, now
  finalized alongside this).
- frontend/src/components/AccessExpiredGate.tsx — logo added to match
  the login/portal card family (all three "important moment" cards now
  share one consistent header: logo top-left, icon-in-circle, bold
  heading).
- Chosen login card style: STYLE B (icon-in-circle grammar, matching
  Access Expired and Portal Selection). Style A was shown for
  comparison and not selected — kept in the artifact history but not
  carried into the real component build.

**This is the last package before merge.** Everything from Package #1
through #13 is what goes into the GitHub repo — see
docs/MERGE_AND_DEPLOY_GUIDE.md for the full sequence and environment
variable checklist, both still accurate and unchanged by this round.
