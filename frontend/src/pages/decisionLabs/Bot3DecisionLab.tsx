import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { FVGFillVisualizer } from '../../components/smcVisualizers/FVGFillVisualizer';
import { BotRulesSlide } from '../../components/BotRulesSlide';
import { ReplayRealSetup } from '../../components/ReplayRealSetup';
import { BotSimulationPlayer } from '../../components/BotSimulationPlayer';
import { useThemeStore } from '../../hooks/useTheme';

/**
 * Bot3DecisionLab — reworked against the SMC Academy plan's own
 * named finding: the earlier version of this lab talked only vaguely
 * about "mitigated vs. unmitigated" and never mentioned the real
 * 30-70% fill-percentage rule, the 15M BOS-after-FVG-pick ordering,
 * or depth-based FVG selection (`FVGExpansionBot`/`FVGExpansionV3Bot`
 * in `bot_strategies.py`). This version leads with the real
 * threshold on a real interactive chart, states Bot 3's actual
 * two-gate pipeline (BOT3-05 in the curriculum) in its real checked
 * order, and contrasts it explicitly with Bot 7's two real
 * differences rather than treating "mitigated" as a vague concept.
 */
const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'A 1H FVG forms and is still ACTIVE, but it\'s currently sitting at 18% filled — already tested once, but nowhere close to the 30-70% window Bot 3 actually requires.',
    choices: [
      {
        text: 'Not eligible yet — Bot 3\'s real filter is 0.3 <= mitigated_percent <= 0.7, and 18% fails that',
        consequence: 'Correct — this is Bot 3\'s real, literal gate 1 (BOT3-02): `partial_fvgs = [f for f in fvgs if 0.3 <= f.mitigated_percent <= 0.7 and f.status.name == "ACTIVE"]`. A gap that\'s barely been touched (18%) is excluded exactly the same way a nearly-full one (90%+) would be.',
        next: 'afterWindow',
      },
      {
        text: '"Partially mitigated" is close enough — it\'s been touched, that should count',
        consequence: 'This treats the 30-70% window as a vague idea rather than the hard, specific numeric gate it actually is in `bot_strategies.py` — 18% is outside the window and Bot 3 would never select this gap, regardless of how close it "feels."',
        next: 'afterWindow',
        rating: 'Worth revisiting — treated a hard numeric gate as a soft judgment call',
      },
    ],
  },
  afterWindow: {
    id: 'afterWindow',
    prompt: 'A second 1H FVG is sitting at 52% filled (inside the real window) and still ACTIVE. The 15M timeframe currently shows no BOS at all.',
    choices: [
      {
        text: 'No signal yet — Bot 3 checks the FVG window FIRST, then requires a matching 15M BOS as gate 2',
        consequence: 'Correct, and in the right order: Bot 3 selects its FVG before ever looking at 15M BOS (BOT3-03). Without a 15M BOS at all, gate 2 fails and `FVGExpansionBot.analyze()` returns `None` — even though the FVG itself fully qualified.',
        next: 'compareBot7',
      },
      {
        text: 'The FVG qualifying is enough on its own — the 15M check is just a formality',
        consequence: 'Bot 3 has exactly two hard gates (BOT3-05), not one — a qualifying FVG with no confirming 15M BOS still returns no signal. Treating gate 2 as optional misreads the real sequential pipeline.',
        next: 'compareBot7',
        rating: 'Worth revisiting — treated a required gate as optional',
      },
    ],
  },
  compareBot7: {
    id: 'compareBot7',
    prompt: 'Bot 7 (FVG Expansion v3) uses the SAME 30-70% window and the SAME timeframe pair as Bot 3. A trader assumes Bot 7 must therefore pick the exact same FVG as Bot 3 whenever both qualify.',
    choices: [
      {
        text: 'Not necessarily — Bot 7 reads 15M direction FIRST and picks the FVG with the most room to react from, not the most recent one',
        consequence: 'Correct — these are Bot 7\'s only two real differences from Bot 3 (BOT7-03/04): direction-first ordering, and depth-based selection (deepest for a long, highest for a short) when more than one FVG qualifies. Everything else — including the 30-70% window itself — is identical, line-for-line.',
        next: 'end',
        rating: 'Bot 3 vs Bot 7\'s real differences correctly identified',
      },
      {
        text: 'Yes — same window, same timeframes, so the selected FVG must always match',
        consequence: 'This misses Bot 7\'s two real, isolated changes — direction-first BOS and depth-based selection — which can genuinely pick a DIFFERENT qualifying FVG than Bot 3\'s "most recently detected" rule would, even from the exact same candidate pool.',
        next: 'end',
        rating: 'Worth revisiting — missed Bot 7\'s two real, isolated differences',
      },
    ],
  },
};

/** Bot3DecisionLab — Bot 3 (Imbalance Expansion): the real 30-70% FVG window + 15M BOS confirmation. */
export function Bot3DecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const textCls = dark ? 'text-white' : 'text-corporate-text-on-bg';
  const cardCls = `rounded-2xl p-5 border mb-5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;

  return (
    <div>
      <PageHeader
        title="Decision Lab — Bot 3: Imbalance Expansion"
        subtitle="The real 30-70% FVG fill window and 15M BOS confirmation — not a vague 'mitigated vs. unmitigated' idea."
      />

      <div className={cardCls}>
        <div className={`text-sm font-semibold mb-2 ${textCls}`}>Bot 3's real gating order (FVGExpansionBot.analyze())</div>
        <ol className={`text-sm space-y-1.5 list-decimal list-inside ${textCls}`}>
          <li>
            Select an eligible 1H FVG — <code>ACTIVE</code> status AND{' '}
            <code>0.3 &lt;= mitigated_percent &lt;= 0.7</code>. No eligible FVG, no signal.
          </li>
          <li>
            Confirm a matching 15M BOS exists. No 15M BOS, or the wrong type, no signal —
            checked SECOND, after the FVG is already selected.
          </li>
        </ol>
        <div className={`mt-2 text-xs ${mutedCls}`}>
          That's the complete list — exactly two hard gates, the shortest of any bot covered in
          this curriculum (see BOT3-05). Try the fill slider below, then the scenarios.
        </div>
      </div>

      <div className="mb-5">
        <FVGFillVisualizer dark={dark} />
      </div>

      <div className="mb-5">
        <BotRulesSlide botId="bot_3" dark={dark} />
      </div>

      <div className="mb-5">
        <ReplayRealSetup botId="bot_3_fvg_expansion" dark={dark} />
      </div>

      <div className="mb-5">
        <BotSimulationPlayer botId="bot_3_fvg_expansion" dark={dark} />
      </div>

      <DecisionLabEngine
        title="Bot 3 — Imbalance Expansion"
        framework="the real 30-70% FVG fill window and 15M BOS confirmation"
        startId="start"
        nodes={NODES}
        backHref="/learn"
        dark={dark}
      />

      <div className={`${cardCls} mt-5`}>
        <div className={`text-sm font-semibold mb-1.5 ${textCls}`}>Compare with Bot 7</div>
        <p className={`text-sm ${mutedCls}`}>
          Bot 7 (FVG Expansion v3) shares this exact 30-70% window and timeframe pair, with two
          isolated differences: direction-first BOS ordering, and depth-based FVG selection.{' '}
          <Link to="/learn/decision-lab/bot-7" className="text-corporate-hero font-medium">
            Open the Bot 7 Decision Lab
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
