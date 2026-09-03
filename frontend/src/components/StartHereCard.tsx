import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { HERO_GRADIENT } from '../config/theme';

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
 * Trade" flow line, and the 3D "Begin registration ->" button. The
 * version this replaces predated the design handover and didn't match
 * it (flat corporate-hero fill, no 3D button, "Access Trading" instead
 * of the reference's exact flow wording) — kept its one real behavior,
 * navigating to /onboarding.
 */
export function StartHereCard() {
  const navigate = useNavigate();

  return (
    <div id="start-here" className="rounded-3xl p-8 md:p-10 relative overflow-hidden" style={{ background: HERO_GRADIENT }}>
      <div className="relative z-10 max-w-xl">
        <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3 font-display">Start Here</h2>
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5 text-white/85 text-[15px] font-semibold mb-4">
          <span>Register</span><ArrowRight size={15} /><span>Pay</span><ArrowRight size={15} /><span>Join Community</span><ArrowRight size={15} /><span>Trade</span>
        </div>
        <button
          onClick={() => navigate('/onboarding')}
          className="text-white font-semibold text-sm px-6 py-3 rounded-xl transition-all active:translate-y-0.5 active:shadow-none"
          style={threeD(HERO_GRADIENT)}
        >
          Begin registration →
        </button>
      </div>
      <div className="absolute -right-10 -bottom-16 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)' }} />
    </div>
  );
}
