import { Link } from 'react-router-dom';
import { FoldedCard } from '../components/FoldedCard';
import { useThemeStore } from '../hooks/useTheme';
import { DAY1_GUIDE, MASTER_TRADING_GUIDE, type GuidePhase } from '../config/userGuide';

export function UserGuidePage() {
  const dark = useThemeStore().theme === 'dark';
  const text = dark ? 'text-white' : 'text-corporate-text-on-bg';
  const muted = dark ? 'text-white/50' : 'text-gray-500';
  const section = (title: string, intro: string, phases: GuidePhase[]) => (
    <section className="mb-10">
      <h2 className={`text-xl font-bold mb-1 ${text}`}>{title}</h2>
      <p className={`text-sm mb-4 ${muted}`}>{intro}</p>
      <div className="space-y-3">
        {phases.map((phase) => (
          <FoldedCard key={phase.id} title={phase.title} summary={phase.summary} dark={dark}>
            <ol className="space-y-4">
              {phase.steps.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-corporate-accent text-white text-xs flex items-center justify-center">{i + 1}</span>
                  <div>
                    <div className={`text-sm font-semibold ${text}`}>{s.title}</div>
                    {s.body.map((b) => <p key={b} className={`text-xs mt-1 ${muted}`}>{b}</p>)}
                    {s.link && <Link to={s.link.to} className="inline-block text-xs mt-2 font-medium text-corporate-accent">{s.link.label} →</Link>}
                  </div>
                </li>
              ))}
            </ol>
          </FoldedCard>
        ))}
      </div>
    </section>
  );
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className={`text-2xl font-bold mb-6 ${text}`}>User Guide</h1>
      {section('Day 1 Guide', 'Everything a new trader needs on the first day, step by step.', DAY1_GUIDE)}
      {section('Trading, Bots & Charts', 'Charts, account connections, manual trades, bots and risk review.', MASTER_TRADING_GUIDE)}
    </div>
  );
}
