import { Link, useLocation } from 'react-router-dom';
import { Home } from 'lucide-react';

// Pages where a "back to Home dashboard" shortcut doesn't make sense:
// you're either already on it, or you're in a pre-auth/forced flow
// that has nowhere to "go home" to yet.
const HIDDEN_ON = ['/home', '/login', '/onboarding'];

/**
 * GoHomeButton — a shortcut back to the Home dashboard (/home), by
 * direct request. Originally a `fixed` top-left overlay, which
 * obstructed the Petrazim logo (also top-left) — relocated into the
 * right-side icon cluster next to Search/Settings instead, by direct
 * follow-up ("relocate the home icon to the right side beside the
 * search bar ... it's left position is obstructing the petrazim logo
 * ... move to the right"). Now a plain inline icon button matching
 * TopNav's own Search/Settings styling (and Layout's Settings gear on
 * the Trader console), not a global floating overlay — mounted once
 * per header rather than once at the app root.
 */
export function GoHomeButton({ dark = false }: { dark?: boolean }) {
  const location = useLocation();
  if (HIDDEN_ON.includes(location.pathname)) return null;

  return (
    <Link
      to="/home"
      aria-label="Go to Home dashboard"
      title="Home dashboard"
      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors text-corporate-hero ${dark ? 'hover:bg-white/10' : 'hover:bg-corporate-bg'}`}
    >
      <Home size={17} />
    </Link>
  );
}
