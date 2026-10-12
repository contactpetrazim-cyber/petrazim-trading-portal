import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GUIDE_PHASES, GUIDE_DIAGRAMS } from '../config/userGuide';
import { GuideDiagram } from './GuideDiagram';

const SLIDES = GUIDE_PHASES.flatMap((p) => p.sections.map((s) => ({ phase: p.title, ...s })));

export function GuideSlideshow({ dark }: { dark: boolean }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const text = dark ? 'text-corporate-text-on-hero' : 'text-corporate-text-on-bg';
  const muted = dark ? 'text-corporate-text-on-hero/60' : 'text-corporate-text-on-bg/65';
  const btn = 'px-4 py-2 rounded-lg text-sm font-medium border border-corporate-accent/40 text-corporate-accent disabled:opacity-40';
  return (
    <div className="rounded-xl border border-corporate-accent/25 p-4">
      <p className={`text-xs ${muted}`}>{s.phase} · Slide {i + 1} of {SLIDES.length}</p>
      <h2 className={`font-semibold mt-1 ${text}`}>{s.title}</h2>
      <p className={`text-xs mb-3 ${muted}`}>{s.summary}</p>
      {GUIDE_DIAGRAMS[s.id] && <GuideDiagram spec={GUIDE_DIAGRAMS[s.id]} dark={dark} />}
      <ol className={`text-sm space-y-1 mb-4 ${text}`}>
        {s.steps.map((st, n) => <li key={st.title}>{n + 1}. {st.title}{st.link && <> — <Link to={st.link.to} className="text-corporate-accent underline underline-offset-4">{st.link.label}</Link></>}</li>)}
      </ol>
      <div className="flex justify-between">
        <button className={btn} disabled={i === 0} onClick={() => setI(i - 1)}>← Back</button>
        <button className={btn} disabled={i === SLIDES.length - 1} onClick={() => setI(i + 1)}>Next →</button>
      </div>
    </div>
  );
}
