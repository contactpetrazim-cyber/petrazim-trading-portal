import { ArrowRight } from 'lucide-react';
import { HERO_GRADIENT } from '../config/theme';
import { openProgrammeSteps } from './ProgrammeStepsModal';

function threeD(background: string) {
  // Same "keycap" 3D button treatment as the design handover's
  // Section 5 — a solid bottom edge for depth, dropping 2px and
  // losing its shadow on :active to fake a physical button press.
  // Only ever used on this card's button, per that section.
  return {
    background,
    boxShadow: '0 4px 0 0 rgba(0,0,0,0.15), 0 6px 14px rgba(0,0,0,0.12)',
  };
}

/**
 * StartHereCard — reconciled against petrazim_preview_v13_FINAL.jsx's
 * "Start Here" card (Section 9 of the design handover): HERO_GRADIENT
 * background, radial glow, the "Register -> Pay -> Join Community ->
 * Trade" flow line, and the 3D "Begin registration ->" button.
 *
 * `embedded` (used by CorporateHomePage, which merges this straight
 * into the welcome-hero's own gradient card per your request) skips
 * this component's own background/padding/radial-glow chrome and
 * renders just the inner content block — text and formatting inside
 * are exactly the same either way, only the outer card wrapper is
 * conditional, so a future standalone use of this component (its own
 * card) still works unchanged.
 *
 * "Begin registration" opens ProgrammeStepsModal instead of jumping
 * straight to /onboarding, by direct request ("this loads after Start
 * Here is clicked and leads you step wise ... so you are not lost") —
 * see that component's own docstring for the real per-step progress it
 * shows, and for why this calls its global openProgrammeSteps() trigger
 * rather than owning a local open/close state and its own modal
 * instance (the Home hero's "Start Here" quick-link needs to open that
 * exact same instance too).
 */
export function StartHereCard({ embedded = false }: { embedded?: boolean }) {
  const content = (
    <div className="relative z-10 max-w-xl">
      <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3 font-display">Start Here</h2>
      <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5 text-white/85 text-[15px] font-semibold mb-4">
        <span>Register</span><ArrowRight size={15} /><span>Pay</span><ArrowRight size={15} /><span>Join Community</span><ArrowRight size={15} /><span>Trade</span>
      </div>
      <button
        onClick={openProgrammeSteps}
        className="text-white font-semibold text-sm px-6 py-3 rounded-xl transition-all active:translate-y-0.5 active:shadow-none"
        style={threeD(HERO_GRADIENT)}
      >
        Begin registration →
      </button>
    </div>
  );

  return embedded ? (
    <div id="start-here">{content}</div>
  ) : (
    <div id="start-here" className="rounded-3xl p-8 md:p-10 relative overflow-hidden" style={{ background: HERO_GRADIENT }}>
      {content}
      <div className="absolute -right-10 -bottom-16 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)' }} />
    </div>
  );
}
