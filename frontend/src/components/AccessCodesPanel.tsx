import { useEffect, useState } from 'react';
import { Ticket, CheckCircle2, Circle, Pause, Play } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface IssuedSeat {
  code: string;
  seat_label: string;
  tier: string;
  redeemed: boolean;
  redemption_count: number;
  max_redemptions: number;
  is_held: boolean;
  expires_at: string;
}

/**
 * AccessCodesPanel — this is the missing frontend for a backend that
 * already existed (corporate.py: generate-seats, my-codes). The
 * corporate seat-code system was fully built and tested weeks ago in
 * this build but never got a UI — this closes that gap, same pattern
 * the Academy status update flagged for its own AccessCodesPanel.
 *
 * Hold/Resume — adapted from the reference training portal's own
 * seat-management screen, part of the Learning Console gap-close
 * (Manager console's Access Codes panel gets a pause action without
 * deleting the seat). GET /my-codes now also returns platform-wide
 * codes for Admin/Super Admin instead of only the caller's own batch
 * (see corporate.py's own docstring) — this component doesn't need to
 * know which case it's in, the backend already scoped the list.
 */
export function AccessCodesPanel({ dark = false }: { dark?: boolean }) {
  const { token } = useAuth();
  const [codes, setCodes] = useState<IssuedSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [holding, setHolding] = useState<string | null>(null);
  const [seatCount, setSeatCount] = useState(10);
  const [tier, setTier] = useState<'essential' | 'professional' | 'executive'>('professional');

  async function loadCodes() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/payments/corporate/my-codes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCodes(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCodes(); }, []);

  // Toggles in place rather than a full reload — the hold endpoint's
  // own response leaves seat_label blank (not recomputed there, see
  // corporate.py's own docstring), so this keeps the label already
  // shown instead of blanking it after every toggle.
  async function toggleHold(code: string, nextHeld: boolean) {
    setHolding(code);
    try {
      const res = await fetch(`${API_BASE}/payments/corporate/codes/${encodeURIComponent(code)}/hold?held=${nextHeld}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCodes((prev) => prev.map((c) => (c.code === code ? { ...c, is_held: nextHeld } : c)));
      }
    } finally {
      setHolding(null);
    }
  }

  async function generateSeats() {
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/payments/corporate/generate-seats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier, seat_count: seatCount }),
      });
      if (res.ok) loadCodes();
    } finally {
      setGenerating(false);
    }
  }

  const redeemedCount = codes.filter((c) => c.redeemed).length;
  const heldCount = codes.filter((c) => c.is_held).length;

  return (
    <div className={`rounded-2xl border p-5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Access Codes</h3>
          <p className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-500'}`}>
            {codes.length > 0
              ? `${redeemedCount} of ${codes.length} seats redeemed${heldCount > 0 ? ` · ${heldCount} on hold` : ''}`
              : 'No seats issued yet'}
          </p>
        </div>
        <Ticket size={18} className="text-corporate-hero" />
      </div>

      <div className={`flex items-end gap-2 mb-4 p-3 rounded-lg ${dark ? 'bg-corporate-nav-dark' : 'bg-corporate-bg'}`}>
        <div className="flex-1">
          <label className={`text-xs block mb-1 ${dark ? 'text-white/40' : 'text-gray-500'}`}>Seats</label>
          <input
            type="number" min={1} max={500} value={seatCount}
            onChange={(e) => setSeatCount(Number(e.target.value))}
            className={`w-full border rounded-lg px-2 py-1.5 text-sm ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark text-white' : 'border-gray-200 text-corporate-text-on-bg'}`}
          />
        </div>
        <div className="flex-1">
          <label className={`text-xs block mb-1 ${dark ? 'text-white/40' : 'text-gray-500'}`}>Tier</label>
          <select
            value={tier} onChange={(e) => setTier(e.target.value as any)}
            className={`w-full border rounded-lg px-2 py-1.5 text-sm ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark text-white' : 'border-gray-200 text-corporate-text-on-bg'}`}
          >
            <option value="essential">Essential</option>
            <option value="professional">Professional</option>
            <option value="executive">Executive</option>
          </select>
        </div>
        <button
          onClick={generateSeats}
          disabled={generating || seatCount < 1}
          className="text-xs font-medium text-white bg-corporate-hero px-3 py-2 rounded-lg disabled:opacity-50"
        >
          {generating ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {loading ? (
        <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Loading…</p>
      ) : codes.length === 0 ? (
        <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Generate a batch of seats above to get started.</p>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1">
          {codes.map((c) => (
            <div
              key={c.code}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg ${c.is_held ? (dark ? 'bg-amber-500/5' : 'bg-amber-50') : ''} ${dark ? 'hover:bg-corporate-nav-dark' : 'hover:bg-corporate-bg'}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {c.is_held
                  ? <Pause size={14} className="text-amber-500 shrink-0" />
                  : c.redeemed
                  ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  : <Circle size={14} className={`shrink-0 ${dark ? 'text-white/20' : 'text-gray-300'}`} />}
                <div className="min-w-0">
                  <div className={`text-xs font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{c.seat_label || c.code}</div>
                  <div className={`font-mono text-[11px] truncate ${dark ? 'text-white/40' : 'text-gray-400'}`}>
                    {c.code} · {c.redemption_count}/{c.max_redemptions} redeemed
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs capitalize ${dark ? 'text-white/40' : 'text-gray-400'}`}>{c.tier}</span>
                <button
                  onClick={() => toggleHold(c.code, !c.is_held)}
                  disabled={holding === c.code}
                  title={c.is_held ? 'Resume this seat' : 'Hold this seat — blocks redemption without deleting it'}
                  className={`p-1.5 rounded-md disabled:opacity-40 ${
                    c.is_held
                      ? 'text-amber-500 hover:bg-amber-500/15'
                      : dark ? 'text-white/40 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-100'
                  }`}
                >
                  {c.is_held ? <Play size={13} /> : <Pause size={13} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
