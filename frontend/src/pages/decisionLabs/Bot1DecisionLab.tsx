import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { OrderBlockZoneVisualizer } from '../../components/smcVisualizers/OrderBlockZoneVisualizer';
import { PremiumDiscountRangeDiagram } from '../../components/smcVisualizers/PremiumDiscountRangeDiagram';
import { BotRulesSlide } from '../../components/BotRulesSlide';
import { ReplayRealSetup } from '../../components/ReplayRealSetup';
import { useThemeStore } from '../../hooks/useTheme';

/**
 * Bot1DecisionLab — reworked around Bot 1's real five-gate pipeline
 * (BOT1-05 in the curriculum, corrected this same session: a fifth,
 * previously-missed gate — the discount/premium check on the
 * selected order block — is a real, separate `return None`, not just
 * color on the entry calculation). The earlier version of this lab
 * only tested "HTF signal vs. choppy LTF noise," which is a real but
 * much smaller part of Bot 1's actual logic — this version leads
 * with the real gate list and the two checks (order-block freshness,
 * discount/premium side) a "the signal looks fine" read can still
 * silently fail on.
 */
const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'A clean 1D uptrend is confirmed (gates 1-2 pass) and a matching bullish 4H BOS exists (gate 3 passes). An ACTIVE, bullish 4H order block also exists — but Bot 1 never checks whether it\'s "fresh" the way Bots 2/5/6 do.',
    choices: [
      {
        text: 'Correct — Bot 1\'s gate 4 is only ACTIVE + direction-matching, no test_count freshness check at all',
        consequence: 'Right — this is a real, verified per-bot difference: "fresh" (test_count<=1) is a Bot 2/5/6 convention, not universal. Bot 1 would accept this zone regardless of how many times it\'s already been retested, as long as it\'s still ACTIVE and bullish.',
        next: 'afterFresh',
      },
      {
        text: 'Bot 1 must also require freshness — every SMC bot on this platform works the same way',
        consequence: 'This assumes a universal rule where none exists. Bot 1\'s real gate 4 has no test_count check — only Bots 2, 5, and 6 filter on freshness. Treating this as universal is exactly the kind of textbook-generalization error this curriculum exists to correct.',
        next: 'afterFresh',
        rating: 'Worth revisiting — assumed a universal rule that isn\'t actually universal',
      },
    ],
  },
  afterFresh: {
    id: 'afterFresh',
    prompt: 'That same order block is ACTIVE and bullish (gates 1-4 all pass) — but it sits in the PREMIUM half of the 4H range, not discount.',
    choices: [
      {
        text: 'No signal — gate 5 fails: a long must sit in discount, this one is premium',
        consequence: 'Correct, and this is the real fifth gate this curriculum\'s own correction this session added: `(direction == "long" and entry_zone.classification == "premium") -> return None`. Four gates passing is not enough on its own.',
        next: 'end',
        rating: 'All five real Bot 1 gates correctly applied, including the corrected fifth',
      },
      {
        text: 'Signal still fires — gates 1-4 already passed, premium/discount is just a nice-to-have',
        consequence: 'This treats the fifth gate as optional, which Bot 1\'s real code does not. The discount/premium check is its own distinct `return None`, reached only after gate 4 already passed — just as hard a gate as the first four.',
        next: 'end',
        rating: 'Worth revisiting — treated a real hard gate as optional',
      },
    ],
  },
};

/** Bot1DecisionLab — Bot 1 (Macro Swing Structure): the real five-gate pipeline, including the corrected fifth gate. */
export function Bot1DecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const textCls = dark ? 'text-white' : 'text-corporate-text-on-bg';
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const cardCls = `rounded-2xl p-5 border mb-5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;

  return (
    <div>
      <PageHeader
        title="Decision Lab — Bot 1: Macro Swing Structure"
        subtitle="The real five-gate pipeline — including the corrected fifth gate (discount/premium on the selected order block)."
      />

      <div className={cardCls}>
        <div className={`text-sm font-semibold mb-2 ${textCls}`}>Bot 1's real gating order (MacroSwingStructureBot.analyze())</div>
        <p className={`text-sm ${mutedCls}`}>
          Five sequential gates, each a real <code>return None</code>: 1D swing count -&gt; 1D
          trend clarity -&gt; 4H BOS alignment -&gt; 4H zone availability (ACTIVE + direction, NO
          freshness test) -&gt; the selected zone's own discount/premium side. Step through all
          five below.
        </p>
      </div>

      <div className="mb-5">
        <BotRulesSlide botId="bot_1" dark={dark} />
      </div>

      <div className="mb-5">
        <OrderBlockZoneVisualizer dark={dark} />
      </div>

      <div className="mb-5">
        <PremiumDiscountRangeDiagram dark={dark} />
      </div>

      <div className="mb-5">
        <ReplayRealSetup botId="bot_1_macro_swing" dark={dark} />
      </div>

      <DecisionLabEngine
        title="Bot 1 — Macro Swing Structure"
        framework="the real five-gate pipeline, including the corrected fifth gate"
        startId="start"
        nodes={NODES}
        backHref="/learn"
        dark={dark}
      />
    </div>
  );
}
