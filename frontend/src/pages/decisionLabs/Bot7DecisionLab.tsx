import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { FVGFillVisualizer } from '../../components/smcVisualizers/FVGFillVisualizer';
import { BotRulesSlide } from '../../components/BotRulesSlide';
import { ReplayRealSetup } from '../../components/ReplayRealSetup';
import { useThemeStore } from '../../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'Bot 7 (FVG Expansion v3) is Bot 3\'s own setup with one real change: direction comes from the 15M BOS FIRST, and the FVG is selected by DEPTH only among candidates that already match that confirmed direction — instead of Bot 3\'s own approach of picking a candidate FVG first and then checking BOS agreement after the fact. Two bullish 1H FVGs currently qualify (30-70% mitigated): a SHALLOW one that formed more recently, and a DEEPER one that formed slightly earlier. The 15M BOS reads bullish.',
    choices: [
      { text: 'Select the deeper FVG — depth-based selection among the already-confirmed-direction candidates, not recency', consequence: 'Correct. Bot 7 decides direction first (15M BOS), then picks by DEPTH among whichever FVGs already match it — deepest for a long, highest for a short — recency plays no role in this step.', next: 'afterSelect', rating: 'Bot 7\'s depth-based selection applied correctly' },
      { text: 'Select the more recent, shallower FVG — it formed later, so it\'s the more current read', consequence: 'That\'s Bot 3\'s own original approach (pick a candidate FVG first, by recency, then check BOS agreement afterward) — not Bot 7\'s. Bot 7 deliberately changed this exact step to depth-based selection among direction-confirmed candidates.', next: 'afterSelect', rating: 'Worth revisiting — applied Bot 3\'s recency-based selection instead of Bot 7\'s own depth-based rule' },
    ],
  },
  afterSelect: {
    id: 'afterSelect',
    prompt: 'Now imagine the 15M BOS instead reads bearish, with the same two bullish 1H FVGs still sitting in the 30-70% mitigated window (no bearish FVG candidate exists at all).',
    choices: [
      { text: 'No signal — neither bullish FVG can be entered against a bearish BOS, regardless of depth', consequence: 'Correct. Direction is locked in by the 15M BOS BEFORE any FVG is even considered — a candidate whose gap_type doesn\'t match that confirmed direction is never eligible, no matter how deep or well-formed it is.', next: 'end', rating: 'Correctly recognized that direction gates eligibility before depth is ever considered' },
      { text: 'Take the deeper bullish FVG anyway — it\'s still the best-quality candidate available', consequence: 'This ignores the real ordering of Bot 7\'s own two steps: BOS sets direction FIRST, and only candidates matching that direction are even considered for the depth-selection step. A bullish FVG is never eligible against a bearish BOS.', next: 'end', rating: 'Worth revisiting — selected by quality before checking direction eligibility' },
    ],
  },
};

/** Bot7DecisionLab — Bot 7 (FVG Expansion v3): BOS-decides-direction-first, then depth-based FVG selection — the real distinction from Bot 3's recency-based pick-then-check order. */
export function Bot7DecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Bot 7: FVG Expansion v3" subtitle="Walk the real direction-first, depth-selected scenario at your own pace. No timer, no score." />

      <div className="mb-5">
        <FVGFillVisualizer dark={dark} />
      </div>

      <div className="mb-5">
        <BotRulesSlide botId="bot_7" dark={dark} />
      </div>

      <div className="mb-5">
        <ReplayRealSetup botId="bot_7_fvg_expansion_v3" dark={dark} />
      </div>

      <DecisionLabEngine title="Bot 7 — FVG Expansion v3" framework="direction-first BOS confirmation, then depth-based FVG selection" startId="start" nodes={NODES} backHref="/learn" dark={dark} />
    </div>
  );
}
