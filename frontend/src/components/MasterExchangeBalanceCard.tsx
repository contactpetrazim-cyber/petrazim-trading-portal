import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, HelpCircle, Zap, Pin } from 'lucide-react';
import { botsApi } from '../services/api';
import { MasterExchangeBalancesResponse, BotExchangeBalanceEntry, TraderExchangeBalanceEntry } from '../types';

/**
 * MasterExchangeBalanceCard — the Admin portal's "sees all" view, by
 * direct request ("Create a Master Exchange Balance card in the Admin
 * portal that sees all"), the counterpart to the trader-facing
 * Exchange Balances page having its own `bot_accounts` gated to
 * Admin/Super Admin only ("the exchange balance info should be gated
 * based on user"). Unlike that page, both sections here have NO
 * ownership scoping — every platform bot sub-account, and every
 * trader's own connected exchange, tagged with whose it is.
 * Lazy-loaded: only fetches once this card is actually opened, not on
 * every Admin console page load — this endpoint makes ~20+ real,
 * concurrent live exchange calls, not a cheap DB read.
 */
export function MasterExchangeBalanceCard({ dark }: { dark: boolean }) {
  const [data, setData] = useState<MasterExchangeBalancesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await botsApi.getMasterExchangeBalances());
      setLoadedOnce(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not load exchange balances.');
    } finally {
      setLoading(false);
    }
  }

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';

  function BalanceCell({ entry }: { entry: BotExchangeBalanceEntry | TraderExchangeBalanceEntry }) {
    if (entry.error) {
      return (
        <span className="flex items-center gap-1 text-xs text-red-400" title={entry.error}>
          <AlertTriangle size={12} /> Unreadable
        </span>
      );
    }
    if (entry.unrecognized_shape) {
      return (
        <span className={`flex items-center gap-1 text-xs ${mutedCls}`} title="This broker's balance response isn't normalized yet.">
          <HelpCircle size={12} /> Unknown
        </span>
      );
    }
    const balance = entry.balance ?? 0;
    return (
      <span className={`text-sm font-semibold ${balance > 0 ? (dark ? 'text-emerald-400' : 'text-emerald-600') : mutedCls}`}>
        ${balance.toFixed(2)}
      </span>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {!loadedOnce && !loading && (
        <button
          onClick={load}
          className={`px-3 py-2 rounded-lg text-sm font-medium ${dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          Load live balances
        </button>
      )}
      {loading && <p className={`text-sm ${mutedCls}`}>Loading every account, live — this takes a few seconds…</p>}
      {error && (
        <div className={`rounded-lg px-3 py-2 text-xs ${dark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
          {error} <button onClick={load} className="underline">Retry</button>
        </div>
      )}
      {loadedOnce && data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-xs ${mutedCls}`}>
              {data.bot_accounts.length} platform bot account{data.bot_accounts.length === 1 ? '' : 's'} ·{' '}
              {data.trader_accounts.length} trader account{data.trader_accounts.length === 1 ? '' : 's'}
            </span>
            <button
              onClick={load} disabled={loading}
              className={`flex items-center gap-1 text-xs font-medium ${dark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-corporate-text-on-bg'}`}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          <div>
            <div className={`text-xs font-semibold mb-1.5 ${mutedCls}`}>Platform Bot Accounts</div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {data.bot_accounts.map((e, i) => (
                <div key={`${e.bot_id}-${e.exchange}-${i}`} className={`py-1.5 ${i > 0 ? `border-t ${dark ? 'border-smc-border' : 'border-gray-100'}` : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{e.bot_name}</div>
                      <div className={`text-xs capitalize ${mutedCls}`}>{e.exchange}{e.label ? ` — ${e.label}` : ''}</div>
                    </div>
                    <BalanceCell entry={e} />
                  </div>
                  {e.used_by.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {e.used_by.map((u) => (
                        <span
                          key={u.bot_id}
                          title={u.reason || undefined}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                            u.mode === 'auto'
                              ? dark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'
                              : dark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {u.mode === 'auto' ? <Zap size={9} /> : <Pin size={9} />} {u.bot_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className={`text-xs font-semibold mb-1.5 ${mutedCls}`}>Every Trader's Connected Exchanges</div>
            {!data.trader_accounts.length ? (
              <p className={`text-xs ${mutedCls}`}>No trader has connected an exchange yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {data.trader_accounts.map((e, i) => (
                  <div key={e.connection_id} className={`flex items-center justify-between py-1.5 ${i > 0 ? `border-t ${dark ? 'border-smc-border' : 'border-gray-100'}` : ''}`}>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{e.user_name || e.user_email || 'Unknown trader'}</div>
                      <div className={`text-xs capitalize ${mutedCls}`}>{e.exchange}{e.label ? ` — ${e.label}` : ''}</div>
                    </div>
                    <BalanceCell entry={e} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
