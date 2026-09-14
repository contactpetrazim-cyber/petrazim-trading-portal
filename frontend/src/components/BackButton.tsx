import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// The landing/dashboard surfaces a "back" action doesn't make sense on
// — either it's the very first screen after login (nothing to return
// to) or a pre-auth/forced flow with no prior in-app page yet. Mirrors
// GoHomeButton's own HIDDEN_ON convention. '/dashboard' is the Trader
// console's own landing page (Layout, not CorporateLayout) — the
// "landing page dashboard" the request explicitly excludes.
const HIDDEN_ON = ['/home', '/dashboard', '/login', '/onboarding'];

/**
 * BackButton — a quick "return to the previous page" shortcut, by
 * direct request ("introduce a back icon for every page except the
 * landing page dashboard throughout the entire trading portal").
 * Mounted once in each shared header (TopNav for the corporate shell,
 * Layout for the Trader console) rather than added to every individual
 * page — matches GoHomeButton's own "mounted once per header, not a
 * global floating overlay" pattern. Uses real browser history
 * (navigate(-1)) so it returns to whatever page was actually visited
 * before this one, not a hardcoded parent route that might not match
 * how the trainee actually got here.
 */
export function BackButton({ dark = false }: { dark?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  if (HIDDEN_ON.includes(location.pathname)) return null;

  return (
    <button
      onClick={() => navigate(-1)}
      aria-label="Go back to the previous page"
      title="Back"
      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors text-corporate-hero ${dark ? 'hover:bg-white/10' : 'hover:bg-corporate-bg'}`}
    >
      <ArrowLeft size={17} />
    </button>
  );
}
