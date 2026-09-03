import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/**
 * StartHereCard — the prominent onboarding entry point for first-time
 * visitors. "Start Here · Register → Pay → Access Trading." Only
 * render this when onboarding.current_step !== 'complete' — once
 * someone's through the flow, this card should disappear rather than
 * nag a returning trader (same principle as the Academy's registration
 * card auto-hiding post-enrollment).
 */
export function StartHereCard() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/onboarding')}
      className="w-full text-left bg-corporate-hero rounded-2xl p-6 md:p-8 relative overflow-hidden group hover:opacity-95 transition-opacity"
    >
      <div className="relative z-10">
        <span className="inline-block bg-corporate-accent text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
          NEW HERE?
        </span>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Start Here</h2>
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-white/90 text-sm md:text-base font-medium">
          <span>Register</span>
          <ArrowRight size={16} />
          <span>Pay</span>
          <ArrowRight size={16} />
          <span>Access Trading</span>
        </div>
        <p className="text-white/60 text-sm mt-3 max-w-md">
          Three quick steps — registration, secure payment, and community access —
          then you're in.
        </p>
      </div>

      {/* Decorative background element, purely visual */}
      <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-corporate-accent/20 group-hover:scale-110 transition-transform" />
    </button>
  );
}
