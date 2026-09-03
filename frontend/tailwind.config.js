
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'smc-dark': '#0a0e1a',
        'smc-card': '#111827',
        'smc-border': '#1f2937',
        'smc-accent': '#3b82f6',
        'smc-success': '#10b981',
        'smc-danger': '#ef4444',
        'smc-warning': '#f59e0b',
        'smc-long': '#22c55e',
        'smc-short': '#ef4444',
        // Corporate palette (Learn/Insights/Community/Explore/nav chrome).
        // Reconciled against petrazim_preview_v13_FINAL.jsx (the final
        // reference — see config/theme.ts for the full rationale):
        // hero/accent are now the brand-blue gradient's middle stop,
        // not flat navy; accent is no longer orange, which the
        // reference explicitly retires as a button color.
        corporate: {
          bg: '#EAEAF4',
          hero: '#005FB8',
          'hero-deep': '#003876',
          'hero-teal': '#00829B',
          'hero-light': '#26417d',
          accent: '#005FB8',
          'accent-hover': '#004a94',
          'accent-orange-retired': '#FF7A00', // reference only — no longer used for buttons/active states
          'text-on-hero': '#FFFFFF',
          // Was #1A1A2E — a fourth near-identical-but-wrong dark navy,
          // the same class of drift the design handover explicitly
          // warns about for blues ("three near-identical blues that
          // didn't quite match"). petrazim_preview_v13_FINAL.jsx's
          // body-text token is #141a33 everywhere; this is used by 16
          // files via text-corporate-text-on-bg, so this one fix
          // cascades correctly instead of needing 16 separate edits.
          'text-on-bg': '#141a33',
          'nav-dark': '#0f1424',
          'surface-dark': '#161b2e',
          'border-dark': '#2a3150',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Sora', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
