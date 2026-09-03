# Architecture Alignment Check — vs. the Master IA/UX Spec

Direct answer to "confirm we have a similar architecture": yes on the
locked structural requirements, no on most of the deep deliverable
list — here's exactly which is which, so nothing is assumed done that
isn't.

## Fully aligned (built, matches spec exactly)

| Spec requirement | Status |
|---|---|
| Exactly 8 nav areas: Learn, Practise, Trade, Insights, TradingView, Tools, Community, Explore, in that order, unrenamed | Built — FEATURE_AREAS in featureRegistry.ts |
| TradingView as a first-class area, not a widget buried in Trade | Built — dedicated /tradingview route + nav tab |
| "Petrazim Trading Frame" concept — a branded shell around TradingView | Built — TV-bezel styled TradingViewFramePage.tsx |
| Card-based, folded-until-triggered default state | Built — FoldedCard.tsx primitive + SiteMapPage.tsx demo |
| Click always works; hover is an enhancement, not a requirement | Built — expandOnHover is opt-in in FoldedCard, click is default |
| Never claim TradingView account/drawing sync without verifying it's real | Built — TRADINGVIEW_BOUNDARY_TABLE.md, verified against current official docs, not assumed |
| Never ask for or store a TradingView password | Built — no such flow exists anywhere in this codebase |
| Distinguish Petrazim UI from TradingView UI clearly | Built — the three-mode chooser (Free Chart / My Workspace / Real TradingView) names this explicitly on-screen |

## Partially aligned (a real piece exists, spec wants much more)

| Spec requirement | What exists | Gap |
|---|---|---|
| Feature schema (AREA/CATEGORY/PURPOSE/USER/VALUE/DEFAULT STATE/EXPANDED STATE/DATA REQUIRED/DEPENDENCIES/PRIORITY/PHASE/PETRAZIM-OR-THIRD-PARTY/MOBILE BEHAVIOUR per feature) | FeatureEntry has id/label/area/route/description/keywords | 6 of 13 required fields missing per entry |
| Metrics architecture (Market/Trading/Performance/Behavioural, grouped) | Individual engines produce metrics (Monte Carlo, Weekly Review) | Not organized into one coherent metrics taxonomy/API surface |
| Card type system (15 named card types with defined behavior each) | 1 generic FoldedCard primitive | Spec wants 15 distinct, purpose-built card types |
| Workspace architecture (Trading/Analysis/Learning/Research, context-preserving) | Individual pages exist | No workspace-switching layer connecting them |

## Not yet built (real gaps, not oversights — genuinely large scope)

- Tracking/event taxonomy (login, session, card expansion, tool use, etc.)
- Notification architecture (categories x priority levels)
- Universal search extended to markets/users/reports (current search only covers the feature registry, not live data)
- Dashboard architecture as its own designed surface (currently StartHereCard + individual pages, no unified home)
- Full sitemap expansion to the spec's depth (current registry is ~25 entries; spec implies 80-100+)
- Accessibility audit (keyboard nav, reduced-motion, screen-reader labels) — not yet verified against any of the built components
- Foldable-device-specific behavior — built responsively but not tested against an actual fold/unfold viewport transition

## Recommendation

The spec's own Section 29 (Phased Implementation) is the right call
here too: Phase 1 (nav + cards + the 8 area shells) is genuinely done.
Phase 2 (TradingView) is done to the extent it honestly can be, given
TradingView's own architecture. Phases 3-6 (analytics, personalization,
community, advanced tools) are real, substantial remaining work — same
honest pacing principle as the curriculum authoring: build it for
real, phase by phase, rather than claim a 36-section spec is complete
after one pass.
