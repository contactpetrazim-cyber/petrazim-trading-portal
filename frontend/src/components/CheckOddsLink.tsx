import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import type { Trade } from '../types';
import { isTimeMachineEligible } from '../lib/timeMachineEligibility';

/**
 * CheckOddsLink -- the one "see this trade's real historical odds in
 * Time Machine" link, reused everywhere a trade's full entry/stop/
 * target is already on screen (Trades cards, Forensics, Snapshot,
 * On Chart/Approval Chart, Pending Approvals cards) instead of a
 * separately hand-rolled button per surface -- by direct request
 * ("add to forensics, Snapshot, on chart and approval charts also --
 * has a 'Check odds' link" / "ADD check Odds link to each card into
 * the trades cards section"). Hands the trade to Time Machine via
 * router state (same navigate/Link `state` pattern LoginPage already
 * uses), which auto-runs the replay the instant that page opens --
 * see ExploreTimeMachinePage's own prefillTrade handling.
 *
 * Renders nothing for a trade Time Machine genuinely couldn't replay
 * (no real entry/target, invalid price ordering, or an exchange/
 * forex-MT broker with no real candle history) -- the same
 * eligibility check the "Add from" picker itself already filters by,
 * so this link never leads to a guaranteed "could not fetch" error.
 */
export function CheckOddsLink({ trade, dark, className }: { trade?: Trade | null; dark?: boolean; className?: string }) {
  if (!trade || !isTimeMachineEligible(trade)) return null;
  return (
    <Link
      to="/explore/time-machine"
      state={{ prefillTrade: trade }}
      className={className ?? `inline-flex items-center gap-1.5 text-xs font-medium ${dark ? 'text-smc-accent hover:text-white' : 'text-corporate-hero hover:text-corporate-text-on-bg'}`}
      title="Check this trade's real historical odds in Time Machine"
    >
      <History size={13} /> Check odds
    </Link>
  );
}
