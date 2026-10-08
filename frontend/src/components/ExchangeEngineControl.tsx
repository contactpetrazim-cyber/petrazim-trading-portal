import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Pin, RefreshCw, Wallet } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { BotConfig } from '../types';
import { botsApi } from '../services/api';

/**
 * ExchangeEngineControl — the "optimal preferred exchange" picker, by
 * direct request ("Develop an optimal prefered exchange engine
 * that's easy to use ... and reliable ... also integrate the auto
 * switch to available margin capital").
 *
 * Two modes, replacing the old create-only, never-editable exchange
 * pin:
 *   - Fixed: pick one exchange by hand (same 4 quick buttons the
 *     create-bot form already has, or type any other). Exactly
 *     today's BotConfig.exchange behavior — just finally editable
 *     after creation, not only at creation.
 *   - Auto (Best Available): backend/services/exchange_engine.py
 *     picks the best of THIS bot's own credentialed exchanges where
 *     its symbol is tradeable, ranked by live margin then reliability
 *     — shown here plainly (which exchange, and why) rather than as a
 *     black box, with a manual "Re-check now" to force an immediate
 *     re-evaluation instead of waiting out the sticky cooldown.
 */

const QUICK_EXCHANGES = ['binance', 'bybit', 'bingx', 'mexc'];

export function ExchangeEngineControl({
  bot, dark, marginAutoSwitchEnabled, onChanged,
}: {
  bot: BotConfig;
  dark: boolean;
  marginAutoSwitchEnabled: boolean;
  onChanged: () => void;
}) {
  const [customExchange, setCustomExchange] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mode = bot.exchange_mode ?? 'fixed';

  async function setFixedExchange(exchange: string) {
    setSaving(true); setError(null);
    try {
      await botsApi.setBotExchange(bot.bot_id, { exchange, mode: 'fixed' });
      setCustomExchange('');
      onChanged();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not set the exchange.');
    } finally {
      setSaving(false);
    }
  }

  async function switchMode(next: 'fixed' | 'auto') {
    setSaving(true); setError(null);
    try {
      await botsApi.setBotExchange(bot.bot_id, { mode: next });
      onChanged();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not switch exchange mode.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {mode === 'auto' ? <Zap size={14} className="text-amber-400" /> : <Pin size={14} className="text-gray-400" />}
          Exchange
          {/* Links to the Exchange Balances page, by direct request
              ("For Bots - we can link to the exchange account info
              page ..... Exchange Bal -link on the bot forms"). */}
          <Link
            to="/exchange-balances"
            onClick={(e) => e.stopPropagation()}
            className={`flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ${dark ? 'text-white/50 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-corporate-hero hover:bg-gray-100'}`}
            title="See every exchange account's real, live balance"
          >
            <Wallet size={11} /> Exchange Bal
          </Link>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => switchMode('fixed')}
            disabled={saving || mode === 'fixed'}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
              mode === 'fixed' ? 'bg-indigo-500 text-white' : dark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Fixed
          </button>
          <button
            onClick={() => switchMode('auto')}
            disabled={saving || mode === 'auto'}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
              mode === 'auto' ? 'bg-amber-500 text-white' : dark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Auto
          </button>
        </div>
      </div>

      {mode === 'fixed' ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_EXCHANGES.map((ex) => (
            <button
              key={ex}
              onClick={() => setFixedExchange(ex)}
              disabled={saving}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors border ${
                bot.exchange === ex
                  ? 'bg-indigo-500 text-white border-transparent'
                  : dark ? 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {ex}
            </button>
          ))}
          <input
            type="text" placeholder="Or type one…" value={customExchange}
            onChange={(e) => setCustomExchange(e.target.value)}
            className={`w-28 px-2 py-1.5 rounded-lg text-xs border ${dark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200'}`}
          />
          <button
            onClick={() => customExchange.trim() && setFixedExchange(customExchange.trim())}
            disabled={saving || !customExchange.trim()}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 ${dark ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Set
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {!marginAutoSwitchEnabled && (
            <div className={`px-3 py-2 rounded-lg text-xs ${dark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
              The Admin's master switch for margin auto-switch is currently off — this bot stays on its Fixed exchange ({bot.exchange || 'default'}) until an Admin turns it on.
            </div>
          )}
          {bot.active_exchange ? (
            <>
              <div className="text-sm font-semibold capitalize">{bot.active_exchange}</div>
              <p className="text-xs text-gray-500">{bot.active_exchange_reason}</p>
              {bot.active_exchange_picked_at && (
                <p className="text-[11px] text-gray-500">
                  Picked {formatDistanceToNow(new Date(bot.active_exchange_picked_at), { addSuffix: true })} — stays unless something changes.
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-500">Not picked yet — resolves on this bot's next scan.</p>
          )}
          <button
            onClick={() => switchMode('auto')}
            disabled={saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 ${dark ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-700'}`}
            title="Re-sends the same Auto mode, which the next scan re-evaluates against immediately rather than waiting out the sticky cooldown."
          >
            <RefreshCw size={13} /> Re-check now
          </button>
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
