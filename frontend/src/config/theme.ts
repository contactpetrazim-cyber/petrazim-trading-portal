/**
 * Corporate Design Tokens — official Petrazim Solutions palette
 * ==================================================================
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
 * legibility matters most operationally. Flag this back to me if
 * you'd rather have one unified theme everywhere instead.
 */

export const PETRAZIM_COLORS = {
  background: '#EAEAF4',   // Silver White — main canvas
  heroBlue: '#1A3364',     // Hero Blue — deep corporate background block
  accentOrange: '#FF7A00', // Vibrant Orange — CTAs, focus indicators, priority nav
} as const;

export const LOGO_HEIGHT_PX = 60; // "60pts" interpreted as 60px on-screen height —
                                    // flag if you meant literal print points (60pt ≈ 80px)
