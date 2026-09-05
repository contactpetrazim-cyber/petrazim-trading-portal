import { PageHeader } from '../../components/PageHeader';
import { DecisionLabEngine, type DecisionNode } from '../../components/DecisionLabEngine';
import { useThemeStore } from '../../hooks/useTheme';

const NODES: Record<string, DecisionNode> = {
  start: {
    id: 'start',
    prompt: 'Two candidate order blocks sit at the same general area. Zone A is one clean down-candle right before a strong displacement move. Zone B is a wide, choppy 6-candle base with several overlapping wicks.',
    choices: [
      { text: 'Favor Zone A — a single, decisive candle right before displacement is the cleaner, higher-quality origin', consequence: 'Zone quality (Core 4\'s own subject) genuinely varies — a tight, decisive origin candle is a stronger signature of real institutional footprint than a messy, indecisive base.', next: 'afterChoice' },
      { text: 'They\'re equivalent — any order block is an order block', consequence: 'Treating every candidate zone as equally valid ignores exactly what "zone quality" (Core 4\'s own real subject) means — not every base is an equally strong signal.', next: 'afterChoice', rating: 'Worth revisiting — treated zone quality as binary, not a real spectrum' },
    ],
  },
  afterChoice: {
    id: 'afterChoice',
    prompt: 'Price returns to Zone A. It\'s already been tested and broken through once before, earlier in the week (mitigated).',
    choices: [
      { text: 'Treat it as lower-probability now — a mitigated zone has already done its job once', consequence: 'A zone that\'s already been tested and traded through has already delivered whatever reaction it was going to — treating a mitigated zone with the same weight as a fresh one overstates what\'s actually still there.', next: 'end', rating: 'Zone quality AND mitigation both read correctly' },
      { text: 'Trade it exactly the same as if it were untested', consequence: 'Ignoring mitigation status is leaving real information on the table — a fresh, untested zone and an already-mitigated one aren\'t the same trade.', next: 'end', rating: 'Worth revisiting — ignored mitigation status' },
    ],
  },
};

/** SupplyDemandDecisionLab — Core 4 (Supply, Demand & Zones): zone quality and mitigation. */
export function SupplyDemandDecisionLab() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return (
    <div>
      <PageHeader title="Decision Lab — Supply, Demand & Zones" subtitle="Walk a real zone-quality scenario at your own pace. No timer, no score." />
      <DecisionLabEngine title="Supply, Demand & Zones" framework="zone quality and mitigation" startId="start" nodes={NODES} backHref="/learn" dark={dark} />
    </div>
  );
}
