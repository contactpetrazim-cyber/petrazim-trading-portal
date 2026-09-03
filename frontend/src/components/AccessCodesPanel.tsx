import { useEffect, useState } from 'react';
import { Ticket, CheckCircle2, Circle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface IssuedSeat {
  code: string;
  tier: string;
  redeemed: boolean;
  expires_at: string;
}

/**
 * AccessCodesPanel — this is the missing frontend for a backend that
 * already existed (corporate.py: generate-seats, my-codes). The
 * corporate seat-code system was fully built and tested weeks ago in
 * this build but never got a UI — this closes that gap, same pattern
 * the Academy status update flagged for its own AccessCodesPanel.
 */
export function AccessCodesPanel() {
  const { token } = useAuth();
  const [codes, setCodes] = useState<IssuedSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
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

  return (
    <div className="bg-white rounded-2xl border border-corporate-bg p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-corporate-text-on-bg">Access Codes</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {codes.length > 0 ? `${redeemedCount} of ${codes.length} seats redeemed` : 'No seats issued yet'}
          </p>
        </div>
        <Ticket size={18} className="text-corporate-hero" />
      </div>

      <div className="flex items-end gap-2 mb-4 p-3 bg-corporate-bg rounded-lg">
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-1">Seats</label>
          <input
            type="number" min={1} max={500} value={seatCount}
            onChange={(e) => setSeatCount(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-corporate-text-on-bg"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-1">Tier</label>
          <select
            value={tier} onChange={(e) => setTier(e.target.value as any)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-corporate-text-on-bg"
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
        <p className="text-sm text-gray-400">Loading…</p>
      ) : codes.length === 0 ? (
        <p className="text-sm text-gray-400">Generate a batch of seats above to get started.</p>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1">
          {codes.map((c) => (
            <div key={c.code} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-corporate-bg">
              <div className="flex items-center gap-2">
                {c.redeemed
                  ? <CheckCircle2 size={14} className="text-emerald-500" />
                  : <Circle size={14} className="text-gray-300" />}
                <span className="font-mono text-xs text-corporate-text-on-bg">{c.code}</span>
              </div>
              <span className="text-xs text-gray-400 capitalize">{c.tier}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
