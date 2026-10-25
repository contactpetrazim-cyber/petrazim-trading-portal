import { Activity } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { FoldedCard } from '../components/FoldedCard';
import { BotSimulationPlayer } from '../components/BotSimulationPlayer';
import { useThemeStore } from '../hooks/useTheme';

// Same botId strings each bot's own Decision Lab already passes to
// BotSimulationPlayer (Bot1DecisionLab.tsx etc.) — kept in sync by
// hand since there's no shared registry of these yet.
const BOTS = [
  { id: 'bot_1_macro_swing', title: 'Bot 1 — Macro Swing Structure' },
  { id: 'bot_2_ob_reversal', title: 'Bot 2 — Order Block Reversal' },
  { id: 'bot_3_fvg_expansion', title: 'Bot 3 — Imbalance Expansion' },
  { id: 'bot_4_volume_liq', title: 'Bot 4 — Volume & Liquidity Sweep' },
  { id: 'bot_5_jeafx', title: 'Bot 5 — Liquidity Purge Specialist' },
  { id: 'bot_6_smc_v2', title: 'Bot 6 — SMC v2' },
  { id: 'bot_7_fvg_expansion_v3', title: 'Bot 7 — FVG Expansion v3' },
] as const;

/**
 * BotSimulationsPage — a single, easily-reachable hub for every bot's
 * animated "watch it happen" simulation, by direct request ("make the
 * link easily accessible"). The simulations themselves (plan item 6
 * of buzzing-mixing-micali.md's SMC Bot Academy section) already
 * existed, but only embedded inside each bot's own full Decision Lab
 * page — reaching one meant navigating Learn -> that bot's Mastery
 * track -> a lesson -> its Decision Lab link. This surfaces all 7 in
 * one place, one click from the Learn hub.
 *
 * Folded by default (unmountOnClose) so opening this page doesn't
 * fire all 7 bots' own simulation fetches at once — only the one(s)
 * actually expanded ever call GET /curriculum/bots/{bot_id}/simulation.
 */
export function BotSimulationsPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';

  return (
    <div>
      <PageHeader
        title="Bot Simulations"
        subtitle="Watch each bot's real SMC detectors fire bar-by-bar on a real setup — one long and one short example per bot."
      />
      <div className="space-y-3">
        {BOTS.map((bot) => (
          <FoldedCard
            key={bot.id}
            title={bot.title}
            summary="Watch this bot's own structure detection play out, bar by bar"
            icon={<Activity size={18} />}
            dark={dark}
            unmountOnClose
          >
            <BotSimulationPlayer botId={bot.id} dark={dark} />
          </FoldedCard>
        ))}
      </div>
    </div>
  );
}
