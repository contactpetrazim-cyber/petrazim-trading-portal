import { LineChart, Briefcase, Handshake, Shield, ChevronRight, LayoutGrid } from 'lucide-react';
import { CardLogoBand } from './CardLogoBand';

// Same icon-per-portal mapping as petrazim_preview_v13_FINAL.jsx's
// PortalSelectionCard demo (Section 4/12 of the design handover).
const PORTAL_ICONS: Record<string, typeof Shield> = {
  admin: Shield,
  fund_manager: Briefcase,
  partner: Handshake,
  trader: LineChart,
};

export interface PortalOption {
  id: string;
  label: string;
  route: string;
}

/**
 * PortalSelectionCard — the real component from the design handover's
 * Component Inventory (Section 12), backed by the real
 * GET /auth/available-portals data instead of the reference's
 * hardcoded four-portal demo list. Shown after login when the user's
 * role has more than one console available (per
 * portal_access.needs_portal_selection on the backend — a Trader
 * never sees this, a Fund Manager sees Fund Manager + Trader, etc.),
 * and reused from SettingsPanel's "Switch Portal" item for anyone who
 * wants to jump consoles later in the session.
 *
 * Uses the same "important moment" card anatomy as AccessExpiredGate:
 * CardLogoBand, icon-in-circle, bold centered heading — per Section 4
 * of the handover, every full-screen modal card in this family shares
 * that identical header recipe.
 */
export function PortalSelectionCard({
  portals,
  onSelect,
  onClose,
}: {
  portals: PortalOption[];
  onSelect: (route: string) => void;
  onClose?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardLogoBand />
        <div className="w-16 h-16 rounded-full bg-[#EAEAF4] flex items-center justify-center mx-auto mb-5">
          <LayoutGrid size={26} style={{ color: '#005FB8' }} />
        </div>
        <h2 className="font-extrabold text-2xl text-[#141a33] mb-2 leading-tight">Select Your Portal</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Your account has access to more than one console. Choose where to go.
        </p>

        <div className="space-y-2 text-left">
          {portals.map((p) => {
            const Icon = PORTAL_ICONS[p.id] ?? LayoutGrid;
            return (
              <button
                key={p.id}
                onClick={() => onSelect(p.route)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-[#005FB8] transition-colors"
              >
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: '#005FB81a', color: '#005FB8' }}
                >
                  <Icon size={16} />
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#141a33]">{p.label}</div>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mt-5">
          Only portals your role can access are shown — never above your own level.
        </p>
      </div>
    </div>
  );
}
