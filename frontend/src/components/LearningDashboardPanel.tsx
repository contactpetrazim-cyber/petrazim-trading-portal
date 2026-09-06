import { useEffect, useState } from 'react';
import { Users, TrendingUp, MessageCircle, Trophy, CalendarClock, Video, Save } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

/**
 * LearningDashboardPanel — adapted from the reference training
 * portal's Trainer/Manager dashboard header ("Cohorts and Your
 * Sessions", "Next Seven Days", "Furthest Along"), backed by the real
 * GET /roster/learning-dashboard (roster.py) rather than that
 * reference's own numbers. Mounted on Partner/ManagerConsolePage and
 * AdminConsolePage — same component, the backend scopes the roster to
 * "your own" vs "everyone" exactly like RosterPanel already does.
 *
 * Deliberately does NOT show a per-session seat count the way the
 * reference does ("1/25 seats taken") — this app's real facilitator
 * capacity (services/facilitator_booking.py) caps at a fixed number of
 * sessions per DAY, not seats per session, so `at_capacity`/`capacity`
 * below describe that real constraint instead of a invented number.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

interface FurthestAlongEntry {
  full_name: string;
  progress_pct: number;
}

interface NextSessionEntry {
  booking_id: string;
  day: string;
  band: string;
  topic: string;
  booked_count: number;
  capacity: number;
  at_capacity: boolean;
}

interface LearningRosterRow {
  trader_user_id: string;
  full_name: string;
  email: string;
  sponsor: string;
  completed_stages: number;
  total_stages: number;
  community_linked: boolean;
  last_activity: string | null;
}

interface LearningDashboard {
  roster_size: number;
  active_learners_30d: number;
  avg_completion_pct: number;
  finished_count: number;
  community_joins: number;
  total_stages: number;
  furthest_along: FurthestAlongEntry[];
  next_seven_days: NextSessionEntry[];
  roster: LearningRosterRow[];
  seats_issued: number;
  active_plans: number;
  codes_live: number;
  codes_redeemed: number;
}

function StatTile({ dark, icon, label, value, sub }: { dark: boolean; icon: React.ReactNode; label: string; value: string | number; sub: string }) {
  return (
    <div className={`rounded-xl p-4 ${dark ? 'bg-corporate-nav-dark' : 'bg-corporate-bg'}`}>
      <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-white/40' : 'text-gray-500'}`}>
        {icon} {label}
      </div>
      <div className={`text-2xl font-bold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{value}</div>
      <div className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-500'}`}>{sub}</div>
    </div>
  );
}

const BAND_LABEL: Record<string, string> = { am: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };

export function LearningDashboardPanel({ dark = false }: { dark?: boolean }) {
  const { token } = useAuth();
  const [data, setData] = useState<LearningDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [topicDrafts, setTopicDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/roster/learning-dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d: LearningDashboard = await res.json();
        setData(d);
        setTopicDrafts(Object.fromEntries(d.next_seven_days.map((s) => [s.booking_id, s.topic])));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveTopic(bookingId: string) {
    setSaving(bookingId);
    try {
      await fetch(`${API_BASE}/meetings/${bookingId}/topic`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic: topicDrafts[bookingId] ?? '' }),
      });
      load();
    } finally {
      setSaving(null);
    }
  }

  const cardClass = `rounded-2xl border p-5 ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const rowClass = dark ? 'bg-corporate-nav-dark' : 'bg-corporate-bg';
  const mutedText = dark ? 'text-white/40' : 'text-gray-500';
  const bodyText = dark ? 'text-white' : 'text-corporate-text-on-bg';

  if (loading) {
    return <div className={cardClass}><p className={`text-sm ${mutedText}`}>Loading dashboard…</p></div>;
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <h3 className={`font-semibold mb-4 ${bodyText}`}>Cohorts and Your Sessions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile dark={dark} icon={<Users size={13} />} label="Roster" value={data.roster_size} sub="On your roster" />
          <StatTile dark={dark} icon={<TrendingUp size={13} />} label="Active (30 days)" value={data.active_learners_30d} sub="Made progress recently" />
          <StatTile dark={dark} icon={<Trophy size={13} />} label="Avg completion" value={`${data.avg_completion_pct}%`} sub={`${data.finished_count} finished the programme`} />
          <StatTile dark={dark} icon={<MessageCircle size={13} />} label="Community joined" value={data.community_joins} sub="Telegram linked" />
          <StatTile dark={dark} icon={<Users size={13} />} label="Seats issued" value={data.seats_issued} sub="Across all plans" />
          <StatTile dark={dark} icon={<TrendingUp size={13} />} label="Active plans" value={data.active_plans} sub="Currently in access" />
          <StatTile dark={dark} icon={<Trophy size={13} />} label="Codes live" value={data.codes_live} sub="Ready to share" />
          <StatTile dark={dark} icon={<MessageCircle size={13} />} label="Codes redeemed" value={data.codes_redeemed} sub="Seats claimed" />
        </div>
      </div>

      <div className={cardClass}>
        <h3 className={`font-semibold mb-3 flex items-center gap-2 ${bodyText}`}><CalendarClock size={16} /> Next Seven Days</h3>
        {data.next_seven_days.length === 0 ? (
          <p className={`text-sm ${mutedText}`}>No sessions scheduled in the next seven days.</p>
        ) : (
          <div className="space-y-2">
            {data.next_seven_days.map((s) => (
              <div key={s.booking_id} className={`rounded-lg p-3 ${rowClass}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className={`text-sm font-medium ${bodyText}`}>
                      {new Date(s.day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} — {BAND_LABEL[s.band] || s.band}
                    </div>
                    <div className={`text-xs ${mutedText}`}>
                      {s.booked_count}/{s.capacity} sessions booked that day{s.at_capacity ? ' · at capacity' : ''}
                    </div>
                  </div>
                  <a
                    href={`/meetings`}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border ${dark ? 'border-corporate-border-dark text-white/70' : 'border-gray-200 text-corporate-text-on-bg'}`}
                  >
                    <Video size={13} /> Join room
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={topicDrafts[s.booking_id] ?? ''}
                    onChange={(e) => setTopicDrafts((prev) => ({ ...prev, [s.booking_id]: e.target.value }))}
                    placeholder="Working topic for this session"
                    className={`flex-1 border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-corporate-accent ${
                      dark ? 'bg-corporate-surface-dark border-corporate-border-dark text-white placeholder:text-white/30' : 'border-gray-200 text-corporate-text-on-bg'
                    }`}
                  />
                  <button
                    onClick={() => saveTopic(s.booking_id)}
                    disabled={saving === s.booking_id}
                    className="flex items-center gap-1.5 text-xs font-medium text-white bg-corporate-hero px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    <Save size={13} /> Save topic
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={cardClass}>
        <h3 className={`font-semibold mb-3 ${bodyText}`}>Furthest along</h3>
        {data.furthest_along.length === 0 ? (
          <p className={`text-sm ${mutedText}`}>No one on your roster has started yet.</p>
        ) : (
          <div className="space-y-2.5">
            {data.furthest_along.map((e) => (
              <div key={e.full_name}>
                <div className={`flex items-center justify-between text-sm mb-1 ${bodyText}`}>
                  <span>{e.full_name}</span>
                  <span className={mutedText}>{e.progress_pct}%</span>
                </div>
                <div className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-corporate-bg'}`}>
                  <div className="h-full bg-corporate-accent rounded-full" style={{ width: `${Math.min(100, e.progress_pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={cardClass}>
        <h3 className={`font-semibold mb-4 ${bodyText}`}>Roster</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-left text-xs uppercase tracking-wide ${mutedText}`}>
                <th className="pb-2 pr-4">Trainee</th>
                <th className="pb-2 pr-4">Sponsor</th>
                <th className="pb-2 pr-4">Progress</th>
                <th className="pb-2 pr-4">Community</th>
                <th className="pb-2">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {data.roster.map((r) => (
                <tr key={r.trader_user_id} className={dark ? 'border-t border-corporate-border-dark' : 'border-t border-corporate-bg'}>
                  <td className="py-2.5 pr-4">
                    <div className={`font-medium ${bodyText}`}>{r.full_name}</div>
                    <div className={`text-xs ${mutedText}`}>{r.email}</div>
                  </td>
                  <td className={`py-2.5 pr-4 ${bodyText}`}>{r.sponsor}</td>
                  <td className="py-2.5 pr-4">
                    <div className={`flex items-center gap-2 ${bodyText}`}>
                      <div className={`h-1.5 w-24 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-corporate-bg'}`}>
                        <div
                          className="h-full bg-corporate-accent rounded-full"
                          style={{ width: `${r.total_stages ? Math.min(100, (r.completed_stages / r.total_stages) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-xs">{r.completed_stages}/{r.total_stages}</span>
                    </div>
                  </td>
                  <td className={`py-2.5 pr-4 ${bodyText}`}>{r.community_linked ? 'Linked' : 'Not linked'}</td>
                  <td className={`py-2.5 ${mutedText}`}>{r.last_activity ? new Date(r.last_activity).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {data.roster.length === 0 && (
                <tr><td colSpan={5} className={`py-3 text-sm ${mutedText}`}>No one on your roster yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
