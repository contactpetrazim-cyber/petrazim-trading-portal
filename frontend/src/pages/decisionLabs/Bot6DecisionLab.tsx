import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { LiquiditySweepVisualizer } from '../../components/smcVisualizers/LiquiditySweepVisualizer';
import { BotRulesSlide } from '../../components/BotRulesSlide';
import { ReplayRealSetup } from '../../components/ReplayRealSetup';
import { useThemeStore } from '../../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'Bot 6 (SMC v2) is a duplicate of Bot 5\'s own zone/purge/confirmation setup, but with one real difference: its 1H BOS bias is MANDATORY, and at least one of its two lower-timeframe reads (15M CHoCH, or 1H-FVG+15M-BOS) must actively AGREE with it — not just avoid disagreeing. The 1H BOS reads bullish. The 15M CHoCH reads bearish (disagrees), and the 1H-FVG+15M-BOS read is neutral — no clear signal either way.',
    choices: [
      { text: 'Reject this setup — bearish CHoCH disagrees, and the other read offers no agreement to fall back on', consequence: 'Correct. Bot 6\'s own rule needs AT LEAST ONE of the two reads to actively agree with its 1H bias — a neutral/unavailable read does not count as agreement, and here the one read that did fire actively disagrees.', next: 'afterReject', rating: 'Bot 6\'s mandatory-agreement rule applied correctly' },
      { text: 'Take it anyway — only one of the two reads actually disagreed, and the other was neutral, not opposed', consequence: 'This is Bot 5\'s softer rule, not Bot 6\'s: Bot 5 only rejects on a CLEAR, active disagreement. Bot 6 is deliberately stricter — it needs a real "yes" from at least one read, and a neutral read is not a yes.', next: 'afterReject', rating: 'Worth revisiting — applied Bot 5\'s softer rule instead of Bot 6\'s own' },
    ],
  },
  afterReject: {
    id: 'afterReject',
    prompt: 'A later scan on the same setup shows the 1H-FVG+15M-BOS read has now also turned bullish, agreeing with the 1H BOS bias — CHoCH is still bearish.',
    choices: [
      { text: 'Now this qualifies — one of the two reads (FVG+BOS) actively agrees with the 1H bias', consequence: 'Correct. Bot 6\'s rule is "at least one," not "both" — a single active agreement is enough even while the other read still disagrees.', next: 'end', rating: 'Correctly recognized a single agreeing read as sufficient' },
      { text: 'Still reject — CHoCH disagreeing should be a hard veto regardless of what the other read says', consequence: 'Bot 6\'s own code only drops the setup when BOTH reads fail to agree (`choch_dir != direction and fvg_bos_dir != direction`) — one active agreement is explicitly enough to proceed past this gate.', next: 'end', rating: 'Worth revisiting — treated one disagreeing read as an automatic veto' },
    ],
  },
};

/** Bot6DecisionLab — Bot 6 (SMC v2): the mandatory 1H-BOS bias with its "at least one LTF read must agree" rule, the real distinction from Bot 5's softer "reject only on disagreement" rule. */
export function Bot6DecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Bot 6: SMC v2" subtitle="Walk the real mandatory-agreement scenario at your own pace. No timer, no score." />

      <div className="mb-5">
        <LiquiditySweepVisualizer dark={dark} />
      </div>

      <div className="mb-5">
        <BotRulesSlide botId="bot_6" dark={dark} />
      </div>

      <div className="mb-5">
        <ReplayRealSetup botId="bot_6_smc_v2" dark={dark} />
      </div>

      <DecisionLabEngine title="Bot 6 — SMC v2" framework="the mandatory 1H-BOS bias requiring at least one lower-timeframe read to agree" startId="start" nodes={NODES} backHref="/learn" dark={dark} />
    </div>
  );
}
