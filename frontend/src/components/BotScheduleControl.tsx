import { useState } from 'react';
import { Clock3 } from 'lucide-react';
import { BotConfig } from '../types';
import { botsApi } from '../services/api';
import { TRADING_SESSIONS, WEEKDAYS, tradingSessionLabel } from '../config/tradingSessions';

/**
 * BotScheduleControl — Trading Schedule, a BOT-LEVEL setting applying
 * regardless of Sub-Auto or execution mode, by direct request
 * ("integrate as quick filters for the semi auto AND normal bot
 * setups"). Used to be Sub-Auto-only (BotSleepAndSubAuto.tsx's own
 * schedule chips); now a real execution gate on EVERY signal this bot
 * produces (execution_engine.py's process_signal) — outside the
 * configured window(s), the bot is skipped entirely for that signal,
 * same as its own Sleep gate.
 *
 * Sessions are real forex trading-session windows (not an arbitrary
 * split) — see config/tradingSessions.ts's own comment for the Core
 * (London/NY overlap, Tokyo/London overlap) vs Non-core (Asian
 * Session, Twilight Zone) structure this was built from. Each
 * dimension (sessions/days/half-day) defaults to/can be reset to
 * "All" — by direct request ("also include an 'All'").
 */

function Chip({ active, dark, onClick, children }: { active: boolean; dark: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
        active
          ? 'bg-indigo-500 text-white border-transparent'
          : dark ? 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

function scheduleLabel(sessions?: string[] | null, days?: number[] | null, halfDay?: string | null): string {
  const sessionsLabel = sessions && sessions.length > 0 ? sessions.map(tradingSessionLabel).join(', ') : 'All';
  const daysLabel = days && days.length > 0
    ? days.map((d) => WEEKDAYS.find((x) => x.key === d)?.label || d).join(', ')
    : 'All';
  const halfDayLabel = halfDay === 'am' ? 'AM' : halfDay === 'pm' ? 'PM' : 'All';
  return `Sessions: ${sessionsLabel} · Days: ${daysLabel} · Half-day: ${halfDayLabel}`;
}

export function BotScheduleControl({ bot, dark, onChanged }: { bot: BotConfig; dark: boolean; onChanged: () => void }) {
  const [selSessions, setSelSessions] = useState<Set<string>>(new Set());
  const [selDays, setSelDays] = useState<Set<number>>(new Set());
  const [selHalfDay, setSelHalfDay] = useState<'all' | 'am' | 'pm'>('all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSession(key: string) {
    setSelSessions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function toggleDay(key: number) {
    setSelDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await botsApi.setBotSchedule(bot.bot_id, {
        sessions: Array.from(selSessions), days: Array.from(selDays), half_day: selHalfDay,
      });
      onChanged();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not update the Trading Schedule.');
    } finally {
      setSaving(false);
    }
  }

  const hasRestriction = (bot.schedule_sessions && bot.schedule_sessions.length > 0)
    || (bot.schedule_days && bot.schedule_days.length > 0)
    || !!bot.schedule_half_day;

  return (
    <div className={`rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
      <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
        <Clock3 size={14} className={hasRestriction ? 'text-indigo-400' : 'text-gray-400'} />
        Trading Schedule
      </div>
      <p className={`text-[11px] mb-2 ${dark ? 'text-white/50' : 'text-gray-500'}`}>
        Outside the saved window, this bot is skipped entirely — same for autonomous, HITL, and Sub-Auto signals alike.
      </p>
      <div className="text-[11px] text-gray-500 mb-2">
        Currently: {scheduleLabel(bot.schedule_sessions, bot.schedule_days, bot.schedule_half_day)}
      </div>
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={selSessions.size === 0} dark={dark} onClick={() => setSelSessions(new Set())}>All Sessions</Chip>
          {TRADING_SESSIONS.map((s) => (
            <Chip key={s.key} active={selSessions.has(s.key)} dark={dark} onClick={() => toggleSession(s.key)}>
              {s.label} {s.tier === 'core' ? '· core' : '· non-core'}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={selDays.size === 0} dark={dark} onClick={() => setSelDays(new Set())}>All Days</Chip>
          {WEEKDAYS.map((d) => (
            <Chip key={d.key} active={selDays.has(d.key)} dark={dark} onClick={() => toggleDay(d.key)}>{d.label}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={selHalfDay === 'all'} dark={dark} onClick={() => setSelHalfDay('all')}>All Day</Chip>
          <Chip active={selHalfDay === 'am'} dark={dark} onClick={() => setSelHalfDay('am')}>AM</Chip>
          <Chip active={selHalfDay === 'pm'} dark={dark} onClick={() => setSelHalfDay('pm')}>PM</Chip>
          <button
            onClick={save}
            disabled={saving}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 ${dark ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            {saving ? 'Saving…' : 'Set Schedule'}
          </button>
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
