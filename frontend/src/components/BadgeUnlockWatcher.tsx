import { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './ToastStack';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const SEEN_BADGES_KEY = 'petrazim:seenBadgeIds';
const SEEN_LEVEL_KEY = 'petrazim:seenLevel';
const LAST_CHECK_KEY = 'petrazim:lastAwardsCheck';
const COOLDOWN_MS = 20_000;

/** Event other components dispatch (see LearnTrackPage's completeStage)
 * to force an immediate re-check right after an action that could have
 * earned a badge, instead of waiting for the next natural remount. */
export const AWARDS_REFRESH_EVENT = 'petrazim:awards-refresh';

interface Badge { id: string; title: string; description: string; icon: string; earned: boolean }
interface Awards { badges: Badge[] }
interface Stats { xp: number; level: number }

function readIdSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * BadgeUnlockWatcher — mounted once at the app root (App.tsx), not per
 * page, so it fires regardless of which screen a trainee is on when a
 * badge or level-up actually lands. Adapts the reference training
 * portal's BadgeUnlockWatcher pattern (a persisted "already celebrated"
 * id set, diffed against a live evaluation, first hydration silent) —
 * this app has no client-side progress store to read synchronously the
 * way the reference does, so it diffs against the real GET
 * /curriculum/awards + /curriculum/stats responses instead, with a
 * short cooldown (dedupes the request across CorporateLayout
 * remounting on every corporate-page navigation) that an explicit
 * AWARDS_REFRESH_EVENT bypasses for an immediate check right after an
 * action that could plausibly have earned something.
 */
export function BadgeUnlockWatcher() {
  const { token } = useAuth();
  const showToast = useToast();
  const checking = useRef(false);

  useEffect(() => {
    if (!token) return;

    async function check(force: boolean) {
      if (checking.current) return;
      const lastCheck = Number(sessionStorage.getItem(LAST_CHECK_KEY) || 0);
      if (!force && Date.now() - lastCheck < COOLDOWN_MS) return;
      checking.current = true;
      sessionStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [awardsRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/curriculum/awards`, { headers }),
          fetch(`${API_URL}/curriculum/stats`, { headers }),
        ]);

        if (awardsRes.ok) {
          const awards: Awards = await awardsRes.json();
          const seen = readIdSet(SEEN_BADGES_KEY);
          const isFirstLoad = seen.size === 0 && localStorage.getItem(SEEN_BADGES_KEY) === null;
          const earnedNow = awards.badges.filter((b) => b.earned);
          const fresh = earnedNow.filter((b) => !seen.has(b.id));
          // First-ever check seeds the baseline silently — otherwise
          // every badge already earned before this feature shipped
          // would all toast at once on a trainee's next page load.
          if (!isFirstLoad) {
            fresh.forEach((b) => {
              showToast({ icon: b.icon, title: `Badge earned — ${b.title}`, description: b.description, variant: 'badge' });
            });
          }
          localStorage.setItem(SEEN_BADGES_KEY, JSON.stringify(earnedNow.map((b) => b.id)));
        }

        if (statsRes.ok) {
          const stats: Stats = await statsRes.json();
          const seenLevelRaw = localStorage.getItem(SEEN_LEVEL_KEY);
          const seenLevel = seenLevelRaw ? Number(seenLevelRaw) : null;
          if (seenLevel !== null && stats.level > seenLevel) {
            showToast({
              icon: '⭐',
              title: `Level up — Level ${stats.level}`,
              description: `${stats.xp} XP total`,
              variant: 'level',
            });
          }
          localStorage.setItem(SEEN_LEVEL_KEY, String(stats.level));
        }
      } catch {
        // Best-effort — a failed celebration check should never surface
        // as an error to the trainee; the next mount/event retries it.
      } finally {
        checking.current = false;
      }
    }

    check(false);
    function onRefresh() { check(true); }
    window.addEventListener(AWARDS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(AWARDS_REFRESH_EVENT, onRefresh);
  }, [token, showToast]);

  return null;
}
