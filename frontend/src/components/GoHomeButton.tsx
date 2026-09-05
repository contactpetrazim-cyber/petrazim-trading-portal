import { Link, useLocation } from 'react-router-dom';
import { Home } from 'lucide-react';
import { HERO_GRADIENT } from '../config/theme';

// Pages where a "back to Home dashboard" shortcut doesn't make sense:
// you're either already on it, or you're in a pre-auth/forced flow
// that has nowhere to "go home" to yet.
const HIDDEN_ON = ['/home', '/login', '/onboarding'];

/**
 * GoHomeButton — a floating shortcut back to the Home dashboard
 * (/home), by direct request: "Put a floating Go Home symbol or icon
 * on the top left ... it shows when a user moves away from the Home
 * dashboard page to other pages ... make it show on all pages apart
 * from the Home dashboard page." Mounted once at the app root (not
 * per-layout) so it floats identically over both the corporate shell
 * (TopNav/BottomNav) and the Trader console's own dark Layout —
 * whichever page you're actually on.
 *
 * Styled in the site's own brand blue (HERO_GRADIENT/heroBlue, config/
 * theme.ts) rather than a neutral gray, so it reads as a deliberate
 * shortcut rather than a stray icon in the corner.
 */
export function GoHomeButton() {
  const location = useLocation();
  if (HIDDEN_ON.includes(location.pathname)) return null;

  return (
    <Link
      to="/home"
      aria-label="Go to Home dashboard"
      title="Home dashboard"
      className="fixed top-3 left-3 z-50 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105"
      style={{ background: HERO_GRADIENT }}
    >
      <Home size={18} />
    </Link>
  );
}
