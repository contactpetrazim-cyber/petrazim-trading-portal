/**
 * Corporate Design Tokens — official Petrazim Solutions palette
 * ==================================================================
 * Reconciled against petrazim_preview_v13_FINAL.jsx, the latest and
 * final visual reference (see MERGE_MANIFEST.md's package #13 note:
 * "Chosen login card style: STYLE B... last package before merge").
 * Two real changes from the earlier build these tokens replace:
 *
 * 1. The nav/hero color is no longer a flat navy (#1A3364) — it's a
 *    3-stop gradient (deep navy -> brand blue -> teal), used on hero
 *    banners and primary CTAs.
 * 2. Orange (#FF7A00) is explicitly RETIRED as a button/active-state
 *    color per the reference's own comment ("all buttons are blue now
 *    — orange retired as a button color"). Kept below only as a named
 *    reference in case a non-button accent is wanted later.
 *
 * Applies to the outer shell: nav, marketing/onboarding pages, Learn/
 * Insights/Community/Explore surfaces, and anything a first-time
 * visitor sees before they're inside a live trading console.
 *
 * DELIBERATE EXCEPTION — the Trade console keeps its dark terminal
 * theme (smc-dark/smc-card/smc-accent from the existing v2 build).
 * Reasoning: dark, high-contrast terminals are the industry standard
 * for live P&L and price data specifically because they reduce eye
 * strain and make red/green deltas pop — swapping that to a light
 * navy-on-white corporate theme would hurt the one screen where
 * legibility matters most operationally.
 */

export const HERO_GRADIENT = 'linear-gradient(105deg, #003876 0%, #005FB8 50%, #00829B 100%)';

export const PETRAZIM_COLORS = {
  background: '#EAEAF4',       // Silver White — main canvas, light mode
  backgroundDark: '#0a0e1a',   // main canvas, dark mode — same value as smc-dark,
                                // so the Trade console and corporate dark mode agree
  heroBlue: '#005FB8',         // gradient's middle stop — icons, text, small fills, all buttons
  heroBlueDeep: '#003876',     // gradient's deep-navy stop — 3D button shadow depth
  heroTeal: '#00829B',         // gradient's end stop
  accentOrangeRetired: '#FF7A00', // no longer used for buttons/active states — reference only
  surfaceDark: '#161b2e',      // card background, dark mode
  borderDark: '#2a3150',       // card/nav border, dark mode
  navDark: '#0f1424',          // top/bottom nav background, dark mode
} as const;

export const LOGO_HEIGHT_PX = 60; // "60pts" interpreted as 60px on-screen height —
                                    // flag if you meant literal print points (60pt ≈ 80px)
