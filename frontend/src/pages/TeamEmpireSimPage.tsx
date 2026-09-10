import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { EmpireSimEngine, type EmpireSimConfig } from '../components/EmpireSimEngine';
import { PROP_FIRM_EMPIRE_CONFIG } from '../config/propFirmEmpireConfig';
import { TRADING_PSYCHOLOGY_EMPIRE_CONFIG } from '../config/tradingPsychologyEmpireConfig';
import { ORDER_FLOW_EMPIRE_CONFIG } from '../config/orderFlowEmpireConfig';
import { useThemeStore } from '../hooks/useTheme';

/**
 * TeamEmpireSimPage — Section 10b's Team Empire Simulation. "One
 * shared engine + configs" (the spec's own framing): EmpireSimEngine
 * never changes, only which EmpireSimConfig is handed to it. Starts
 * on a scenario picker rather than jumping straight into the Prop
 * Firm config, since that was the only one that existed — with three
 * real configs now, hardcoding one would silently hide the other two.
 * Not scored/persisted like the solo games — this is a same-screen
 * group activity, not an individual XP-earning drill, matching the
 * spec's own framing of it as a distinct feature from Section 10a.
 */
const SCENARIOS: { config: EmpireSimConfig; description: string }[] = [
  { config: PROP_FIRM_EMPIRE_CONFIG, description: 'Funded-account risk management — 8 weeks of a prop firm challenge.' },
  { config: TRADING_PSYCHOLOGY_EMPIRE_CONFIG, description: 'Emotional regulation under drawdown, tilt, and winning streaks.' },
  { config: ORDER_FLOW_EMPIRE_CONFIG, description: 'Tape reading calls — absorption, stop hunts, icebergs, volume profile.' },
];

export function TeamEmpireSimPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const [selected, setSelected] = useState<EmpireSimConfig | null>(null);

  if (selected) {
    return (
      <div>
        <PageHeader
          title="Team Empire Simulation"
          subtitle="4-5 teams, same-screen pass-and-play. Weekly risk decisions, weighted outcomes, a comparative debrief."
        />
        <button
          onClick={() => setSelected(null)}
          className={`mb-4 text-sm font-medium ${dark ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-corporate-text-on-bg'}`}
        >
          ← Choose a different scenario
        </button>
        <EmpireSimEngine config={selected} backHref="/practise/game" dark={dark} />
      </div>
    );
  }

  const cardCls = `rounded-2xl p-6 border text-left transition-colors ${
    dark ? 'bg-corporate-surface-dark border-corporate-border-dark hover:bg-white/5' : 'bg-white border-corporate-bg hover:bg-corporate-bg'
  }`;

  return (
    <div>
      <PageHeader title="Team Empire Simulation" subtitle="Pick a scenario — 4-5 teams, same-screen pass-and-play." />
      <div className="grid gap-4 sm:grid-cols-3">
        {SCENARIOS.map(({ config, description }) => (
          <button key={config.theme} onClick={() => setSelected(config)} className={cardCls}>
            <div className={`text-base font-semibold mb-1.5 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
              {config.theme}
            </div>
            <div className={`text-sm ${dark ? 'text-white/60' : 'text-gray-500'}`}>{description}</div>
            <div className={`text-xs mt-3 ${dark ? 'text-white/40' : 'text-gray-400'}`}>{config.rounds.length} rounds</div>
          </button>
        ))}
      </div>
    </div>
  );
}
