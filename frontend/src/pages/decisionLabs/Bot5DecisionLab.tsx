import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { LiquiditySweepVisualizer } from '../../components/smcVisualizers/LiquiditySweepVisualizer';
import { BotRulesSlide } from '../../components/BotRulesSlide';
import { ReplayRealSetup } from '../../components/ReplayRealSetup';
import { BotSimulationPlayer } from '../../components/BotSimulationPlayer';
import { useThemeStore } from '../../hooks/useTheme';

/**
 * Bot5DecisionLab — reworked to lead with the SMC Academy plan's own
 * named fidelity correction for Bot 5: the 15M liquidity sweep does
 * NOT set trade direction. Direction comes from the last 4H BOS,
 * decided BEFORE the sweep is even checked — the sweep only gates
 * entry TIMING. This directly contradicts the standard "sweep ->
 * reversal direction" textbook framing, and the codebase's own
 * comments record the original strategy being found backwards vs.
 * ICT convention, then fixed. The earlier version of this lab never
 * mentioned this distinction at all.
 */
const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'The last 4H BOS is bullish — Bot 5 is only looking for LONGS, already decided before anything on 15M is checked. A 15M SELL-SIDE sweep then occurs (stops above equal highs taken out, close back below).',
    choices: [
      {
        text: 'Still only longs — the sweep is a timing/alignment check, not a new direction signal',
        consequence: 'Correct — this is Bot 5\'s real, documented fix: direction already came from the 4H BOS. A sell-side sweep here does NOT flip the bot to looking for shorts; it only has to align with an ACTIVE bullish zone to pass gates 4-5.',
        next: 'afterDirection',
      },
      {
        text: 'A sell-side sweep means Bot 5 should now look for a short instead',
        consequence: 'This is the exact textbook "sweep sets reversal direction" assumption Bot 5\'s own code explicitly does NOT use. The code comments record this strategy being found backwards vs. ICT convention and fixed — direction is locked in by the 4H BOS alone.',
        next: 'afterDirection',
        rating: 'Worth revisiting — applied the textbook sweep-sets-direction assumption Bot 5 explicitly corrects',
      },
    ],
  },
  afterDirection: {
    id: 'afterDirection',
    prompt: 'A refined (ACTIVE, test_count<=1) 1H bullish zone aligns with the sweep\'s price, and a 5M confirmation candle satisfies both momentum and re-entry — all six real gates now pass.',
    choices: [
      {
        text: 'Real Bot 5 signal — all six gates genuinely passed, in the real order',
        consequence: 'Correct — refined zone, 4H BOS exists and is recognized, 15M sweep detected, zone/sweep alignment, and 5M confirmation: all six (BOT5-05) in sequence.',
        next: 'end',
        rating: 'Bot 5\'s real six-gate pipeline, including the sweep-is-timing correction, applied correctly',
      },
      {
        text: 'Still needs the sweep to "confirm" the long direction too, as a seventh check',
        consequence: 'There is no such gate — the sweep\'s role ends at timing/alignment. Treating it as also needing to agree on direction adds a check that doesn\'t exist in the real pipeline.',
        next: 'end',
        rating: 'Worth revisiting — invented a direction-confirmation role for the sweep that isn\'t real',
      },
    ],
  },
};

/** Bot5DecisionLab — Bot 5 (Liquidity Purge Specialist): sweep-is-timing-not-direction, and the real six-gate pipeline. */
export function Bot5DecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const textCls = dark ? 'text-white' : 'text-corporate-text-on-bg';
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const cardCls = `rounded-2xl p-5 border mb-5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;

  return (
    <div>
      <PageHeader
        title="Decision Lab — Bot 5: Liquidity Purge Specialist"
        subtitle="The real correction: the 15M sweep gates entry timing — it does not set trade direction."
      />

      <div className={cardCls}>
        <div className={`text-sm font-semibold mb-2 ${textCls}`}>The real correction this lab leads with</div>
        <p className={`text-sm ${mutedCls}`}>
          Direction comes from the last 4H BOS, decided BEFORE the 15M sweep is even checked. The
          sweep's only real job is entry timing and zone alignment — not telling the bot which way
          to trade. This reverses the standard "sweep -&gt; reversal direction" textbook framing,
          and is a real, documented fix in this codebase.
        </p>
      </div>

      <div className="mb-5">
        <LiquiditySweepVisualizer dark={dark} />
      </div>

      <div className="mb-5">
        <BotRulesSlide botId="bot_5" dark={dark} />
      </div>

      <div className="mb-5">
        <ReplayRealSetup botId="bot_5_jeafx" dark={dark} />
      </div>

      <div className="mb-5">
        <BotSimulationPlayer botId="bot_5_jeafx" dark={dark} />
      </div>

      <DecisionLabEngine
        title="Bot 5 — Liquidity Purge Specialist"
        framework="the sweep-gates-timing, not direction, correction and the real six-gate pipeline"
        startId="start"
        nodes={NODES}
        backHref="/learn"
        dark={dark}
      />
    </div>
  );
}
