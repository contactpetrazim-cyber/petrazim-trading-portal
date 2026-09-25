import { useState } from 'react';
import { Moon, Sunrise, Zap, RotateCcw, Clock3 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { BotConfig } from '../types';
import { botsApi } from '../services/api';

/**
 * BotSleepAndSubAuto — two premium bot-control panels, by direct
 * request:
 *
 * (1) Sleep — pauses this bot's scanning for a set window (3H/6H/12H/
 *     1D/3D/7D or a custom duration), resuming to exactly the same
 *     settings it had before (see BotConfig.sleep_until's own backend
 *     comment for why there's nothing to "restore" — sleep never
 *     touches any other setting, it's a pure timestamp gate).
 *
 * (2) Sub-Auto Mode — gives this bot pre-approval to trade
 *     autonomously up to a TOTAL trade count and a MAX per day, both
 *     chosen up front. Once engaged, every signal executes immediately
 *     — no per-trade approval — until either cap is hit; the daily cap
 *     just pauses today (resumes tomorrow), the total cap ends the
 *     engagement and restores whatever execution_mode this bot had
 *     before Sub-Auto was turned on.
 *
 * Both have a "Reset" action that interrupts and reverts immediately,
 * independent of any preset/custom values chosen.
 */

const SLEEP_PRESETS: { label: string; hours: number }[] = [
  { label: '3H', hours: 3 },
  { label: '6H', hours: 6 },
  { label: '12H', hours: 12 },
  { label: '1D', hours: 24 },
  { label: '3D', hours: 72 },
  { label: '7D', hours: 168 },
];

const TOTAL_PRESETS = [10, 20, 30, 50];
const DAILY_PRESETS = [1, 2, 3, 5, 10];

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

export function BotSleepAndSubAuto({ bot, dark, onChanged }: { bot: BotConfig; dark: boolean; onChanged: () => void }) {
  const isAsleep = !!bot.sleep_until && new Date(bot.sleep_until).getTime() > Date.now();

  const [customHours, setCustomHours] = useState('');
  const [sleeping, setSleeping] = useState(false);

  const [selTotal, setSelTotal] = useState<number | 'custom' | null>(null);
  const [customTotal, setCustomTotal] = useState('');
  const [selDaily, setSelDaily] = useState<number | 'custom' | null>(null);
  const [customDaily, setCustomDaily] = useState('');
  const [engaging, setEngaging] = useState(false);
  const [subAutoError, setSubAutoError] = useState<string | null>(null);

  async function sleepFor(hours: number) {
    setSleeping(true);
    try {
      await botsApi.setBotSleep(bot.bot_id, hours);
      onChanged();
    } finally {
      setSleeping(false);
    }
  }

  async function wakeUp() {
    setSleeping(true);
    try {
      await botsApi.setBotSleep(bot.bot_id, null);
      onChanged();
    } finally {
      setSleeping(false);
    }
  }

  const totalValue = selTotal === 'custom' ? Number(customTotal) : selTotal;
  const dailyValue = selDaily === 'custom' ? Number(customDaily) : selDaily;

  async function engageSubAuto() {
    setSubAutoError(null);
    if (!totalValue || totalValue < 1) { setSubAutoError('Choose a total trade count.'); return; }
    if (!dailyValue || dailyValue < 1) { setSubAutoError('Choose a max trades per day.'); return; }
    setEngaging(true);
    try {
      await botsApi.setBotSubAuto(bot.bot_id, { enabled: true, total_cap: totalValue, daily_cap: dailyValue });
      setSelTotal(null); setSelDaily(null); setCustomTotal(''); setCustomDaily('');
      onChanged();
    } catch (e: any) {
      setSubAutoError(e?.response?.data?.detail || 'Could not engage Sub-Auto Mode.');
    } finally {
      setEngaging(false);
    }
  }

  async function resetSubAuto() {
    setEngaging(true);
    try {
      await botsApi.setBotSubAuto(bot.bot_id, { enabled: false });
      onChanged();
    } finally {
      setEngaging(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Sleep */}
      <div className={`rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
          {isAsleep ? <Moon size={14} className="text-indigo-400" /> : <Clock3 size={14} className="text-gray-400" />}
          Sleep
        </div>
        {isAsleep ? (
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-400">
              Asleep until <span className="font-medium">{format(new Date(bot.sleep_until!), 'MMM d, HH:mm')}</span>
              {' '}({formatDistanceToNow(new Date(bot.sleep_until!), { addSuffix: true })}) — resumes to the same settings automatically.
            </div>
            <button
              onClick={wakeUp} disabled={sleeping}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 disabled:opacity-50 shrink-0"
            >
              <Sunrise size={13} /> Wake Up
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {SLEEP_PRESETS.map((p) => (
              <Chip key={p.label} active={false} dark={dark} onClick={() => sleepFor(p.hours)}>{p.label}</Chip>
            ))}
            <input
              type="number" min={1} placeholder="Custom hrs" value={customHours}
              onChange={(e) => setCustomHours(e.target.value)}
              className={`w-24 px-2 py-1.5 rounded-lg text-xs border ${dark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200'}`}
            />
            <button
              onClick={() => customHours && sleepFor(Number(customHours))}
              disabled={!customHours || sleeping}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 ${dark ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Sleep
            </button>
          </div>
        )}
      </div>

      {/* Sub-Auto Mode */}
      <div className={`rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
          <Zap size={14} className={bot.sub_auto_active ? 'text-amber-400' : 'text-gray-400'} />
          Sub-Auto Mode
        </div>
        {bot.sub_auto_active ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{bot.sub_auto_trades_executed ?? 0} / {bot.sub_auto_total_cap} total &nbsp;·&nbsp; {bot.sub_auto_daily_count ?? 0} / {bot.sub_auto_daily_cap} today</span>
              <button
                onClick={resetSubAuto} disabled={engaging}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-50 shrink-0"
              >
                <RotateCcw size={13} /> Reset
              </button>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-200'}`}>
              <div
                className="h-full bg-amber-400"
                style={{ width: `${Math.min(100, ((bot.sub_auto_trades_executed ?? 0) / (bot.sub_auto_total_cap || 1)) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-500">Trading autonomously, pre-approved — resumes original settings once the total is reached.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <div className="text-[11px] text-gray-500 mb-1">Total Trades</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {TOTAL_PRESETS.map((n) => (
                  <Chip key={n} active={selTotal === n} dark={dark} onClick={() => setSelTotal(n)}>{n}</Chip>
                ))}
                <Chip active={selTotal === 'custom'} dark={dark} onClick={() => setSelTotal('custom')}>Custom</Chip>
                {selTotal === 'custom' && (
                  <input
                    type="number" min={1} placeholder="#" value={customTotal}
                    onChange={(e) => setCustomTotal(e.target.value)}
                    className={`w-16 px-2 py-1.5 rounded-lg text-xs border ${dark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200'}`}
                  />
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500 mb-1">Max Trades per Day</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {DAILY_PRESETS.map((n) => (
                  <Chip key={n} active={selDaily === n} dark={dark} onClick={() => setSelDaily(n)}>{n}</Chip>
                ))}
                <Chip active={selDaily === 'custom'} dark={dark} onClick={() => setSelDaily('custom')}>Custom</Chip>
                {selDaily === 'custom' && (
                  <input
                    type="number" min={1} placeholder="#" value={customDaily}
                    onChange={(e) => setCustomDaily(e.target.value)}
                    className={`w-16 px-2 py-1.5 rounded-lg text-xs border ${dark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200'}`}
                  />
                )}
              </div>
            </div>
            {subAutoError && <p className="text-xs text-red-400">{subAutoError}</p>}
            <button
              onClick={engageSubAuto} disabled={engaging}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 disabled:opacity-50"
            >
              <Zap size={13} /> {engaging ? 'Engaging…' : 'Engage Sub-Auto Mode'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
