import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Lock, Loader2, Mic, Video, X } from 'lucide-react';
import { apiFetch } from './AccessExpiredGate';
import { fetchJsonWithRetry } from '../lib/resilientFetch';

const BAND_LABELS: Record<string, string> = { am: 'AM', afternoon: 'Afternoon', evening: 'Evening' };
const BAND_SHORT: Record<string, string> = { am: 'AM', afternoon: 'PM', evening: 'EV' };
const API_BASE = import.meta.env.VITE_API_URL || '';

interface DayAvailability {
  day: string;
  bands_available: string[];
  bands_booked: string[];
  at_capacity: boolean;
}

interface MyBooking {
  id: string;
  day: string;
  band: string;
  topic: string;
  jitsi_room_url: string;
  status: string;
}

function monthKey(day: string) {
  return day.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Monday-first offset for the 1st of a month. */
function leadingBlanks(key: string) {
  const [y, m] = key.split('-');
  const dow = new Date(Number(y), Number(m) - 1, 1).getDay();
  return (dow + 6) % 7;
}

function daysInMonth(key: string) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m), 0).getDate();
}

function longDate(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * FacilitatorCalendar — month-grid version, matching the booking UI
 * design used on the Petrazim Academy training portal (Lovable): a
 * 3-month calendar grid with a subtle availability dot per day (no
 * seat counts anywhere, by that design's own rule), an inline day
 * panel below the grid instead of a modal, and a "Your sessions" card
 * backed by the /meetings/my-bookings + DELETE endpoints — both of
 * which already existed on this backend but were never wired into the
 * old day-strip UI this replaces.
 *
 * Deliberately NOT ported from the Academy: its "I need Pillar N —
 * next opportunities" finder and its Fireflies-backed session-recap
 * panel. Both depend on a fixed pillar/curriculum calendar and a
 * recap-generation endpoint this backend doesn't have — faking either
 * would show real trainees a feature that silently does nothing.
 *
 * userTier gates booking exactly as before (Essential sees the
 * upgrade panel instead of the calendar); the booking modal's
 * replacement — the inline day panel — stays on the same
 * plain-card-on-app-background treatment as the rest of this app's
 * "decision moment" surfaces.
 */
export function FacilitatorCalendar({
  userTier,
  tierLoading,
  token,
  privileged = false,
  dark = false,
}: {
  userTier: 'essential' | 'professional' | 'executive' | null;
  tierLoading: boolean;
  token: string | null;
  /** Facilitators themselves — Fund Manager, Partner, Admin, Super Admin
   * — host these sessions, so a tier gate never applies to them. They
   * were being shown the "upgrade to Professional" wall on their own
   * facilitator page. */
  privileged?: boolean;
  dark?: boolean;
}) {
  const navigate = useNavigate();
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthIndex, setMonthIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  // Fireflies is now a platform-wide Super Admin master control
  // (GET/PATCH /meetings/fireflies-setting), not a per-booking choice
  // — by direct request ("Remove fireflies button from facilitator
  // session section and put a Fireflies toggle on vs off in the
  // portals follow hierarchy"). This just reads and shows the
  // resolved state; only a Super Admin can change it (Admin Console).
  const [firefliesEnabled, setFirefliesEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_BASE}/meetings/fireflies-setting`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setFirefliesEnabled(d.enabled))
      .catch(() => {});
  }, [token]);
  const [booking, setBooking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ band: string; jitsi_room_url: string } | null>(null);

  const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const eligible = privileged || userTier === 'professional' || userTier === 'executive';


  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    // Retries through a cold backend start instead of failing once and
    // leaving an empty calendar with no way back — the reported
    // "facilitator sessions not working" looked exactly like this.
    fetchJsonWithRetry<DayAvailability[]>(`${API_BASE}/meetings/availability`, {})
      .then((data) => { if (alive) setDays(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setError('Meeting availability is unavailable right now.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const reloadMyBookings = () => {
    if (!token) { setBookingsLoading(false); return; }
    setBookingsLoading(true);
    fetch(`${API_BASE}/meetings/my-bookings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMyBookings((data as MyBooking[]).filter((b) => b.status !== 'cancelled')))
      .finally(() => setBookingsLoading(false));
  };
  useEffect(reloadMyBookings, [token]);

  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  const months = useMemo(() => {
    const keys: string[] = [];
    for (const d of days) {
      const key = monthKey(d.day);
      if (!keys.includes(key)) keys.push(key);
    }
    return keys;
  }, [days]);
  const activeMonth = months[Math.min(monthIndex, Math.max(0, months.length - 1))] ?? null;
  const selectedDay = selected ? byDay.get(selected) ?? null : null;

  function openDay(day: string) {
    setError(null);
    setConfirmed(null);
    setSelected(day);
  }

  async function book(band: string) {
    if (!selectedDay) return;
    if (!token) { setError('Your session has expired — please sign in again.'); return; }
    setBooking(band);
    setError(null);
    try {
      const res = await apiFetch(`${API_BASE}/meetings/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ day: selectedDay.day, band, topic: topic.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Booking failed');
      }
      const data = await res.json();
      setConfirmed({ band, jitsi_room_url: data.jitsi_room_url });
      setTopic('');
      reloadMyBookings();
      setDays((prev) => prev.map((d) => (d.day === selectedDay.day
        ? { ...d, bands_booked: [...d.bands_booked, band], bands_available: d.bands_available.filter((b) => b !== band) }
        : d)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBooking(null);
    }
  }

  async function release(id: string) {
    if (!token) return;
    setCancelling(id);
    try {
      await fetch(`${API_BASE}/meetings/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      reloadMyBookings();
    } finally {
      setCancelling(null);
    }
  }

  const cardCls = `rounded-3xl border p-5 shadow-[0_1px_2px_rgba(20,26,51,0.06),0_8px_24px_-12px_rgba(20,26,51,0.18)] ${
    dark ? 'bg-corporate-surface-dark border-corporate-border-dark/70' : 'bg-white border-gray-200'
  }`;
  const mutedCls = dark ? 'text-white/40' : 'text-gray-500';

  if (loading) return <p className={`text-sm ${mutedCls}`}>Loading calendar…</p>;

  if (!selected && error && days.length === 0) {
    return (
      <div className={`rounded-xl border p-4 text-sm ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark text-white/60' : 'bg-white border-corporate-bg text-gray-500'}`}>
        <p>{error}</p>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="mt-2 text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-corporate-accent"
        >
          Try again
        </button>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {!tierLoading && !eligible && (
        <div className={`rounded-xl p-4 flex items-start gap-3 border ${dark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
          <Lock size={18} className={`shrink-0 mt-0.5 ${dark ? 'text-amber-400' : 'text-amber-600'}`} />
          <div>
            <div className={`text-sm font-medium ${dark ? 'text-amber-300' : 'text-amber-800'}`}>Professional/Executive feature</div>
            <div className={`text-xs mt-1 ${dark ? 'text-amber-300/70' : 'text-amber-700'}`}>
              Facilitator sessions are available on Professional and Executive tiers. Upgrade to book time
              with a facilitator, Fund Manager, or Partner.
            </div>
            <button onClick={() => navigate('/payments')} className="mt-2 text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-corporate-accent">
              View plans
            </button>
          </div>
        </div>
      )}

      {/* Month-grid calendar */}
      <div className={cardCls}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className={`text-[0.7rem] font-bold uppercase tracking-[0.16em] ${mutedCls}`}>Availability</p>
            <h2 className={`font-display text-lg font-bold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
              {activeMonth ? monthLabel(activeMonth) : 'Calendar'}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              disabled={monthIndex === 0}
              onClick={() => setMonthIndex((i) => Math.max(0, i - 1))}
              className={`rounded-lg border p-1.5 disabled:opacity-30 ${dark ? 'border-corporate-border-dark text-white/60' : 'border-gray-200 text-gray-500'}`}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              aria-label="Next month"
              disabled={monthIndex >= months.length - 1}
              onClick={() => setMonthIndex((i) => Math.min(months.length - 1, i + 1))}
              className={`rounded-lg border p-1.5 disabled:opacity-30 ${dark ? 'border-corporate-border-dark text-white/60' : 'border-gray-200 text-gray-500'}`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {activeMonth && (
          <>
            <div className={`grid grid-cols-7 gap-1 text-center text-[0.65rem] font-bold uppercase tracking-[0.1em] ${mutedCls}`}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="py-1">{d}</span>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {Array.from({ length: leadingBlanks(activeMonth) }).map((_, i) => <span key={`b${i}`} aria-hidden />)}
              {Array.from({ length: daysInMonth(activeMonth) }).map((_, i) => {
                const day = `${activeMonth}-${String(i + 1).padStart(2, '0')}`;
                const entry = byDay.get(day);
                const open = eligible && !!entry && entry.bands_available.length > 0;
                const mine = !!entry && entry.bands_booked.length > 0;
                const isSelected = selected === day;
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!entry}
                    onClick={() => openDay(day)}
                    aria-label={`${day}${open ? ' — sessions available' : ''}`}
                    className={`relative aspect-square rounded-xl border text-sm font-semibold transition-colors ${
                      !entry
                        ? 'cursor-default border-transparent ' + (dark ? 'text-white/15' : 'text-gray-300')
                        : dark
                          ? `border-corporate-border-dark/60 text-white/70 hover:border-corporate-accent/60 ${isSelected ? 'border-corporate-accent bg-corporate-accent/10 text-white' : ''}`
                          : `border-gray-200 text-corporate-text-on-bg hover:border-corporate-accent/60 ${isSelected ? 'border-corporate-accent bg-corporate-accent/10' : ''}`
                    }`}
                  >
                    {i + 1}
                    {mine ? (
                      <span className="absolute inset-x-0 bottom-1 mx-auto block size-1.5 rounded-full bg-corporate-accent" />
                    ) : open ? (
                      <span className="absolute inset-x-0 bottom-1 mx-auto block size-1.5 rounded-full bg-corporate-accent/35" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className={`mt-3 text-xs ${mutedCls}`}>
              A faint dot means a session is still open; a solid dot marks a day you already hold a seat on.
              Pick a date to see AM, Afternoon, and Evening availability.
            </p>
          </>
        )}
      </div>

      {/* Inline day panel — replaces the old booking modal */}
      {selectedDay && (
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={16} className="text-corporate-accent" />
            <h3 className={`font-display text-base font-bold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
              {longDate(selectedDay.day)}
            </h3>
          </div>

          <div className="max-w-md mb-4">
            <label className={`text-xs font-semibold ${mutedCls}`} htmlFor="session-topic">
              What would you like to cover? (optional)
            </label>
            <input
              id="session-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={240}
              placeholder="e.g. Reviewing this week's risk management"
              className={`mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-corporate-accent ${
                dark ? 'bg-white/5 border-corporate-border-dark text-white placeholder:text-white/30' : 'border-gray-200 text-corporate-text-on-bg'
              }`}
            />
          </div>

          {firefliesEnabled !== null && (
            <div className={`w-full max-w-md flex items-center gap-2.5 rounded-lg p-3 mb-4 border ${dark ? 'border-corporate-border-dark' : 'border-gray-200'}`}>
              <Mic size={16} className={firefliesEnabled ? 'text-corporate-accent' : mutedCls} />
              <span className={`text-xs ${mutedCls}`}>
                {firefliesEnabled
                  ? 'Fireflies notetaker: On — this session will be recorded and transcribed automatically.'
                  : 'Fireflies notetaker: Off, platform-wide (set by a Super Admin) — this session will not be recorded.'}
              </span>
            </div>
          )}

          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

          <ul className="space-y-2">
            {['am', 'afternoon', 'evening'].map((band) => {
              const isBooked = selectedDay.bands_booked.includes(band);
              const isAvailable = eligible && selectedDay.bands_available.includes(band);
              const justConfirmed = confirmed?.band === band;
              return (
                <li key={band} className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${dark ? 'border-corporate-border-dark/70' : 'border-gray-200'}`}>
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-xs font-bold ${dark ? 'bg-corporate-accent/15 text-corporate-accent' : 'bg-corporate-accent/10 text-corporate-accent'}`}>
                    {BAND_SHORT[band]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{BAND_LABELS[band]}</span>
                    {justConfirmed && (
                      <a href={confirmed.jitsi_room_url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-xs font-semibold text-corporate-accent underline">
                        Join room
                      </a>
                    )}
                  </span>
                  {isBooked ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-corporate-accent">
                      <CheckCircle2 size={16} /> Booked
                    </span>
                  ) : isAvailable ? (
                    <button
                      type="button"
                      disabled={booking !== null}
                      onClick={() => book(band)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-corporate-accent disabled:opacity-50"
                    >
                      {booking === band ? <Loader2 size={14} className="animate-spin" /> : null}
                      Book this session
                    </button>
                  ) : (
                    <span className={`text-xs font-semibold ${mutedCls}`}>
                      {selectedDay.at_capacity ? 'Fully booked — choose another session' : eligible ? 'Not available' : 'Upgrade to book'}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Your sessions */}
      {token && (
        <div className={cardCls}>
          <h3 className={`font-display text-base font-bold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Your sessions</h3>
          {bookingsLoading ? (
            <Loader2 size={16} className={`mt-2 animate-spin ${mutedCls}`} />
          ) : myBookings.length ? (
            <ul className="mt-3 space-y-2">
              {myBookings.map((b) => (
                <li key={b.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${dark ? 'border-corporate-border-dark/70' : 'border-gray-200'}`}>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
                      {longDate(b.day)} · {BAND_LABELS[b.band] ?? b.band}
                    </span>
                    {b.topic && <span className={`mt-0.5 block text-xs ${mutedCls}`}>{b.topic}</span>}
                  </span>
                  <a
                    href={b.jitsi_room_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${dark ? 'border-corporate-border-dark text-white' : 'border-gray-200 text-corporate-text-on-bg'}`}
                  >
                    <Video size={14} /> Join
                  </a>
                  <button
                    type="button"
                    disabled={cancelling === b.id}
                    onClick={() => release(b.id)}
                    className={`flex items-center gap-1 text-xs font-semibold ${mutedCls} hover:text-red-500`}
                  >
                    <X size={14} /> Release
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`mt-2 text-sm ${mutedCls}`}>No sessions booked yet. Pick a date above to get started.</p>
          )}
        </div>
      )}
    </div>
  );
}
