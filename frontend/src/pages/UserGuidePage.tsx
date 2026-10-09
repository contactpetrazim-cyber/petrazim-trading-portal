import { Link } from 'react-router-dom';
import { FoldedCard } from '../components/FoldedCard';
import { useThemeStore } from '../hooks/useTheme';
import { DAY1_GUIDE } from '../config/userGuide';

export function UserGuidePage() {
  const dark = useThemeStore().theme === 'dark';
  const text = dark ? 'text-white' : 'text-corporate-text-on-bg';
  const muted = dark ? 'text-white/50' : 'text-gray-500';
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className={`text-2xl font-bold mb-2 ${text}`}>Day 1 User Guide</h1>
      <p className={`text-sm mb-6 ${muted}`}>Everything a new trader needs on the first day, step by step.</p>
      <div className="space-y-3">
        {DAY1_GUIDE.map((phase) => (
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
    </div>
  );
}
