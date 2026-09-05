import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Video, X } from 'lucide-react';

const BAND_LABELS: Record<string, string> = { am: 'AM', afternoon: 'Afternoon', evening: 'Evening' };
const API_BASE = import.meta.env.VITE_API_URL || '';

interface DayAvailability {
  day: string;
  bands_available: string[];
  bands_booked: string[];
  at_capacity: boolean;
}

/**
 * FacilitatorCalendar — the 3-month strip. Each day shows its three
 * bands (AM/Afternoon/Evening); available bands are clickable, booked
 * or over-capacity bands are visibly locked. Backs the /meetings route.
 *
 * userTier is passed in from the authenticated user's current access
 * tier — Essential-tier users see the upsell dialog instead of the
 * booking dialog when they tap an otherwise-available slot, since
 * eligibility is ultimately enforced server-side anyway (this is UX,
 * not the real gate).
 *
 * `dark` only reaches the calendar strip and the eligibility banner —
 * the booking modal stays plain white regardless, matching every
 * other "decision moment" card in this app (AccessExpiredGate,
 * LoginCardStyleB, PortalSelectionCard all do the same).
 *
 * `token` — POST /meetings/book requires an active-access user
 * (require_active_access -> get_current_user, both reading a Bearer
 * token via FastAPI's OAuth2PasswordBearer) but this component never
 * received or sent one; confirmBooking sent `credentials: 'include'`
 * instead, which does nothing against a Bearer-only backend. Every
 * booking attempt 401'd — by direct bug report ("Facilitator sessions
 * booking not working"). Now the real token is required and sent.
 *
 * `tierLoading` — MeetingsPage's own tier check is separate from and
 * can resolve slower than this component's calendar-strip fetch (its
 * own `loading` below only covers that strip). Rendering `!eligible`
 * the instant the strip loads — before the tier check has actually
 * finished — showed a genuinely Professional/Executive trader the
 * upgrade gate as if it were final, by direct bug report ("Professional
 * /Executive feature ... not working"). Now withheld until the tier
 * check itself has actually settled.
 */
export function FacilitatorCalendar({
  userTier,
  tierLoading,
  token,
  dark = false,
}: {
  userTier: 'essential' | 'professional' | 'executive' | null;
  tierLoading: boolean;
  token: string | null;
  dark?: boolean;
}) {
  const navigate = useNavigate();
  const [strip, setStrip] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ day: string; band: string } | null>(null);
  const [topic, setTopic] = useState('');
  const [booking, setBooking] = useState(false);
  const [result, setResult] = useState<{ jitsi_room_url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eligible = userTier === 'professional' || userTier === 'executive';

  useEffect(() => {
    fetch(`${API_BASE}/meetings/availability`)
      .then((r) => r.json())
      .then((data) => setStrip(data))
      .finally(() => setLoading(false));
  }, []);

  function openSlot(day: string, band: string) {
    setError(null);
    setResult(null);
    setSelected({ day, band });
  }

  async function confirmBooking() {
    if (!selected || !topic.trim()) return;
    if (!token) {
      setError('Your session has expired — please sign in again.');
      return;
    }
    setBooking(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/meetings/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ day: selected.day, band: selected.band, topic }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Booking failed');
      }
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBooking(false);
    }
  }

  if (loading) return <p className={`text-sm ${dark ? 'text-white/40' : 'text-gray-400'}`}>Loading calendar…</p>;

  return (
    <div>
      {!tierLoading && !eligible && (
        <div className={`rounded-xl p-4 mb-4 flex items-start gap-3 border ${dark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
          <Lock size={18} className={`shrink-0 mt-0.5 ${dark ? 'text-amber-400' : 'text-amber-600'}`} />
          <div>
            <div className={`text-sm font-medium ${dark ? 'text-amber-300' : 'text-amber-800'}`}>Professional/Executive feature</div>
            <div className={`text-xs mt-1 ${dark ? 'text-amber-300/70' : 'text-amber-700'}`}>
              Facilitator sessions are available on Professional and Executive tiers. Upgrade to book time
              with a facilitator, Fund Manager, or Partner.
            </div>
            <button
              onClick={() => navigate('/payments')}
              className="mt-2 text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-corporate-accent"
            >
              View plans
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="flex gap-2 pb-2" style={{ minWidth: `${strip.length * 92}px` }}>
          {strip.map((d) => (
            <div key={d.day} className={`w-20 shrink-0 rounded-xl border p-2 text-center ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`}>
              <div className={`text-[10px] mb-2 ${dark ? 'text-white/40' : 'text-gray-500'}`}>
                {new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
              <div className="space-y-1">
                {['am', 'afternoon', 'evening'].map((band) => {
                  const isBooked = d.bands_booked.includes(band);
                  const isAvailable = d.bands_available.includes(band) && eligible;
                  return (
                    <button
                      key={band}
                      disabled={!isAvailable}
                      onClick={() => isAvailable && openSlot(d.day, band)}
                      className={`w-full text-[10px] py-1.5 rounded-md font-medium transition-colors ${
                        isBooked
                          ? dark ? 'bg-white/5 text-white/30 line-through' : 'bg-gray-100 text-gray-400 line-through'
                          : isAvailable
                          ? 'bg-corporate-accent/10 text-corporate-accent hover:bg-corporate-accent hover:text-white'
                          : dark ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      {BAND_LABELS[band]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-corporate-text-on-bg">Book a session</h3>
              <button onClick={() => setSelected(null)}><X size={18} className="text-gray-400" /></button>
            </div>

            {!result ? (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  {new Date(selected.day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}{' '}
                  · {BAND_LABELS[selected.band]}
                </p>
                <label className="text-xs font-medium text-gray-500 block mb-1">Topic</label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What would you like to cover?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 text-corporate-text-on-bg outline-none focus:border-corporate-accent"
                />
                {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
                <button
                  onClick={confirmBooking}
                  disabled={!topic.trim() || booking}
                  className="w-full bg-corporate-accent text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-50"
                >
                  {booking ? 'Booking…' : 'Confirm booking'}
                </button>
              </>
            ) : (
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <Video size={22} className="text-emerald-600" />
                </div>
                <p className="text-sm text-gray-600 mb-4">Session confirmed. A Fireflies notetaker will join automatically if configured.</p>
                <a
                  href={result.jitsi_room_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-corporate-hero text-white font-medium py-2.5 rounded-lg text-sm"
                >
                  Join room
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
