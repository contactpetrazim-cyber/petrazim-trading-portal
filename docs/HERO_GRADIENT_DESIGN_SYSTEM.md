# Petrazim Hero Gradient — Design System Reference

Complete, precise specification of the primary brand gradient and its
usage rules — written so this exact blend can be reproduced identically
in any future Petrazim app, portal, or engine, by a human or an AI,
without guessing.

---

## 1. The Gradient — Exact Values

**Name:** Petrazim Hero Gradient (internal reference: HERO_GRADIENT)

| Property | Value |
|---|---|
| Type | Linear gradient, 3 color stops |
| Angle | 105° (left-to-right with a slight downward tilt — NOT a pure horizontal 90°) |
| Stop 1 | #003876 at 0% — Deep Dark Navy |
| Stop 2 | #005FB8 at 50% — Royal/Vibrant Blue |
| Stop 3 | #00829B at 100% — Teal-Cyan Accent |

CSS:
```css
background: linear-gradient(105deg, #003876 0%, #005FB8 50%, #00829B 100%);
```

Tailwind (arbitrary values):
```html
<div class="bg-gradient-to-r from-[#003876] via-[#005FB8] to-[#00829B]">
```
Note: Tailwind's bg-gradient-to-r is a true 90°, not 105° — close enough
visually for most uses, but use the raw CSS background property with
linear-gradient(105deg, ...) when the exact 105° angle matters (e.g.
large hero sections where the tilt is visible).

React inline style (used throughout this build):
```js
const HERO_GRADIENT = 'linear-gradient(105deg, #003876 0%, #005FB8 50%, #00829B 100%)';
<div style={{ background: HERO_GRADIENT }}>
```

---

## 2. Derived Solid Colors

Two solid colors are drawn FROM the gradient's own stops — never
invented separately — so small UI elements (icons, text, thin borders)
visually belong to the same family as the large gradient surfaces.

| Token | Hex | Source | Used for |
|---|---|---|---|
| HERO_BLUE | #005FB8 | Gradient's middle stop | Icon tints, link/active text color, small solid-fill buttons, progress-bar fill color on light backgrounds |
| HERO_BLUE_DEEP | #003876 | Gradient's first stop | 3D button shadow depth (see 4), darkest accents |

Rule: never introduce a third "brand blue" that isn't one of these
three values (the two gradient endpoints/middle, or the full gradient
itself). This is precisely the inconsistency this update corrected —
three different blues that were "similar but different."

---

## 3. Where the Gradient Applies (large surfaces)

Use the FULL 3-stop HERO_GRADIENT, never a 2-stop simplification or
a different angle, on:

- Page hero sections (dashboard welcome banner, "Start Here" card)
- Section headers on every secondary page (Learn, Practise, Trade,
  Insights, Tools, Community, Explore)
- Primary call-to-action buttons that carry real visual weight
  (Explore, Begin Registration, Renew Access)
- Modal/panel headers for primary flows (chat header, dark-theme-toggle
  active state)

## 4. Where the Solid Colors Apply (small surfaces)

Use HERO_BLUE (#005FB8) — never the full gradient — on:

- Icons (search, settings, active nav state, card icon tints)
- Text links, active states, small metric numbers
- Progress bar fill on white/light card backgrounds (a gradient fill
  on a thin bar reads as noisy, not premium)
- Secondary "Continue" buttons inside a card that's already sitting on
  a light background

Why the split matters: a gradient on every single button and icon
site-wide looks busy and undermines the sense of "this is the one
important color" a hero gradient is supposed to create. Reserve the
full gradient for surfaces that are meant to draw the eye; use the
solid derived blue everywhere else.

## 5. The "3D Button" Technique

Primary CTA buttons (Explore, Begin Registration) use the gradient as
the fill AND a layered box-shadow for a raised "keycap" depth effect:

```js
function threeD(background) {
  return {
    background,
    boxShadow: '0 4px 0 0 rgba(0,0,0,0.15), 0 6px 14px rgba(0,0,0,0.12)',
  };
}
// usage: style={threeD(HERO_GRADIENT)}
```

On press (:active), the button should translate down and lose its
shadow, simulating a physical press:
```css
.active\:translate-y-0\.5:active { transform: translateY(2px); }
.active\:shadow-none:active { box-shadow: none; }
```

This shadow recipe works identically whether the fill is a solid color
or the full gradient — no adjustment needed per surface.

---

## 6. Supporting Palette (unchanged, still in effect)

| Token | Hex | Role |
|---|---|---|
| Canvas background | #EAEAF4 | Page background, card gaps |
| Accent (CTA/highlight) | retired as of this build | All buttons now use HERO_BLUE/HERO_GRADIENT instead of orange |
| Card white | #FFFFFF | Card surfaces on light backgrounds |
| Dark-mode surface | #161B2E | Card surfaces when dark theme is active |
| Dark-mode canvas | #0A0E1A | Page background when dark theme is active |

Exception — the Trade console / TradingView frame: these two surfaces
intentionally do NOT use the hero gradient or light canvas. They use a
near-black terminal theme (#0A0E1A background, pure black #000 for the
chart screen) regardless of the light/dark toggle — this is a
deliberate, separate design decision (dark terminals are the
professional standard for live P&L legibility), not an oversight or
inconsistency to fix.

---

## 7. Radial Glow Accent

Hero cards include a soft white radial glow in the bottom-right corner
for visual depth — always white, always the same recipe, regardless of
which gradient surface it sits on:

```css
background: radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%);
```
Positioned as a 256x256px circle, offset -40px right and -64px bottom
from the card's corner (i.e., mostly overflowing outside the rounded
corner, clipped by overflow: hidden on the parent).

---

## 8. Typography Pairing (for completeness)

The gradient is used with two typefaces, loaded via Google Fonts:
- Headings: Sora, weights 600/700/800
- Body: Inter, weights 400/500/600/700/800

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap');
```
White text (#FFFFFF at full opacity for headings, rgba(255,255,255,0.8)
for body copy, rgba(255,255,255,0.6) for eyebrow/label text) is used
on all gradient surfaces — never dark text on the gradient, contrast is
insufficient across the lighter teal end.

---

## 9. Quick-Reference Checklist for a New App/Portal

1. Define HERO_GRADIENT, HERO_BLUE, HERO_BLUE_DEEP as the three
   values in sections 1-2. Do not invent new blues.
2. Every hero/header/primary-CTA surface uses HERO_GRADIENT at 105 degrees,
   with the exact three stops in section 1.
3. Every icon/text/small-fill uses HERO_BLUE (#005FB8).
4. Primary buttons get the 3D keycap treatment (section 5).
5. Canvas stays #EAEAF4; cards stay white (or #161B2E in dark mode).
6. Any "operational" screen showing live data at a glance (trading
   terminals, monitoring dashboards) is exempt from the gradient/light
   canvas rule and uses the dark terminal palette instead — a
   deliberate exception, documented here so it's never mistaken for
   inconsistency in a future audit.
