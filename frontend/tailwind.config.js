
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
        // Corporate palette (Learn/Insights/Community/Explore/nav chrome)
        // merged in from tailwind.config.corporate-extend.js — see MERGE_MANIFEST.md
        corporate: {
          bg: '#EAEAF4',
          hero: '#1A3364',
          'hero-light': '#26417d',
          accent: '#FF7A00',
          'accent-hover': '#e66d00',
          'text-on-hero': '#FFFFFF',
          'text-on-bg': '#1A1A2E',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
