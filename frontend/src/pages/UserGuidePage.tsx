import { Link, useLocation } from 'react-router-dom';
import { FoldedCard } from '../components/FoldedCard';
import { useThemeStore } from '../hooks/useTheme';
import { GUIDE_PHASES, GUIDE_DIAGRAMS } from '../config/userGuide';
import { GuideDiagram } from '../components/GuideDiagram';

export function UserGuidePage() {
  const dark = useThemeStore().theme === 'dark';
  const { hash } = useLocation();
  const text = dark ? 'text-corporate-text-on-hero' : 'text-corporate-text-on-bg';
  const muted = dark ? 'text-corporate-text-on-hero/60' : 'text-corporate-text-on-bg/65';
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className={`text-2xl font-bold mb-6 ${text}`}>User Guide</h1>
      <div className="space-y-3">
        {GUIDE_PHASES.map((phase) => (
          <section key={`${phase.id}-${hash}`} id={phase.id} aria-label={phase.title} className="scroll-mt-24">
            <FoldedCard title={phase.title} summary={phase.summary} dark={dark} wrapSummary unmountOnClose defaultOpen={hash === `#${phase.id}`}>
              <p className={`text-sm mb-5 ${muted}`}>{phase.summary}</p>
              {phase.id === 'phase-4' ? (
                <div className="grid sm:grid-cols-2 gap-3">{Object.values(GUIDE_DIAGRAMS).map((d) => <GuideDiagram key={d.title} spec={d} dark={dark} />)}</div>
              ) : phase.sections.length === 0 ? (
                <p className={`text-sm ${muted}`}>Awaiting approval for this phase.</p>
              ) : phase.sections.map((section) => (
                <section key={section.id} className="mb-7 last:mb-0">
                  <h2 className={`font-semibold mb-1 ${text}`}>{section.title}</h2>
                  <p className={`text-xs mb-4 ${muted}`}>{section.summary}</p>
                  {GUIDE_DIAGRAMS[section.id] && <GuideDiagram spec={GUIDE_DIAGRAMS[section.id]} dark={dark} />}
                  <ol className="space-y-4">
                    {section.steps.map((step, i) => (
                      <li key={step.title} className="flex gap-3">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-corporate-accent text-corporate-text-on-hero text-xs flex items-center justify-center">{i + 1}</span>
                        <div className="min-w-0">
                          <h3 className={`text-sm font-semibold ${text}`}>{step.title}</h3>
                          {step.body.map((body) => <p key={body} className={`text-sm mt-1 leading-relaxed ${muted}`}>{body}</p>)}
                          {step.link && <Link to={step.link.to} className="inline-block text-sm mt-2 font-medium text-corporate-accent underline underline-offset-4">{step.link.label} →</Link>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </FoldedCard>
          </section>
        ))}
      </div>
    </div>
  );
}
