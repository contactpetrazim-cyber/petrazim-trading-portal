import { HERO_GRADIENT } from '../config/theme';

/**
 * PageHeader — the gradient header used on 7 of the 8 area pages, per
 * Section 9 of the design handover: "Starts with PageHeader:
 * rounded-3xl p-7 mb-6, HERO_GRADIENT background, white Sora heading +
 * white/60% subtitle." (Trade is the 8th — it keeps its own dark
 * terminal Layout, the deliberate Section 8 exception, so it never
 * uses this component.)
 */
export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-3xl p-7 mb-6" style={{ background: HERO_GRADIENT }}>
      <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-1.5 font-display">{title}</h1>
      <p className="text-white/60 text-sm max-w-lg">{subtitle}</p>
    </div>
  );
}
