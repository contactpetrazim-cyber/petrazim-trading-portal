import { useEffect, useState } from 'react';
import { Wallet, RefreshCw, AlertTriangle, HelpCircle, Zap, Pin } from 'lucide-react';
import { botsApi } from '../services/api';
import { ExchangeBalancesResponse, BotExchangeBalanceEntry, TraderExchangeBalanceEntry } from '../types';
import { useThemeStore } from '../hooks/useTheme';
import { formatApiError } from '../lib/apiError';

/**
 * ExchangeBalancesPage — "Exchange Balances". By direct request ("Can
 * we retrieve exchange account trading capital or margin capital
 * balance and create a exchange balance page to check such
 * balances"). Two sections:
 *   - Platform bot sub-accounts (BotBrokerCredential) — the real money
 *     backing each strategy's own dedicated exchange account(s), one
 *     row per (bot, exchange). Linked to from each bot card's own
 *     "Exchange Bal" button (Bots.tsx).
 *   - Your own connected exchanges (TraderBrokerConnection) — your
 *     personal account(s), used for manual trading and copy-trading a
 *     subscribed bot. Linked to from the Manual Trading order form's
 *     own balance line.
 * Same live get_balance() read exchange_engine.py's own Auto-mode
 * ranking already makes — a number here is the SAME one the Exchange
 * Engine is deciding against, not a second, possibly-divergent read.
 */
export function ExchangeBalancesPage() {
  const { portalThemes } = useThemeStore();
  const dark = portalThemes.trader === 'dark';
  const [data, setData] = useState<ExchangeBalancesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setData(await botsApi.getExchangeBalances());
    } catch (e: any) {
      setError(formatApiError(e?.response?.data?.detail, 'Could not load exchange balances.'));
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const cardCls = `rounded-xl border p-4 ${dark ? 'bg-smc-card border-smc-border' : 'bg-white border-corporate-bg'}`;
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
        <span className={`flex items-center gap-1 text-xs ${mutedCls}`} title="This broker's balance response isn't in a format this platform normalizes yet — check the exchange's own dashboard directly for now.">
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
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className={dark ? 'text-smc-accent' : 'text-corporate-hero'} size={22} />
          <h1 className="text-xl font-bold">Exchange Balances</h1>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading || refreshing}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 ${dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      <p className={`text-sm ${mutedCls}`}>
        Live trading-capital / margin-capital balance per real exchange account — pulled straight from each
        exchange, the same read the Exchange Engine's own Auto mode uses to decide where a bot trades.
      </p>

      {error && (
        <div className={`rounded-lg px-4 py-3 text-sm ${dark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>{error}</div>
      )}

      {loading ? (
        <p className={`text-sm ${mutedCls}`}>Loading…</p>
      ) : (
        <>
          <div className={cardCls}>
            <h2 className="text-sm font-semibold mb-3">Platform Bot Accounts</h2>
            {!data?.bot_accounts.length ? (
              <p className={`text-sm ${mutedCls}`}>No dedicated bot sub-accounts found.</p>
            ) : (
              <div className="space-y-1.5">
                {data.bot_accounts.map((e, i) => (
                  <div key={`${e.bot_id}-${e.exchange}-${i}`} className={`py-2 ${i > 0 ? `border-t ${dark ? 'border-smc-border' : 'border-corporate-bg'}` : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{e.bot_name}</div>
                        <div className={`text-xs capitalize ${mutedCls}`}>{e.exchange}{e.label ? ` — ${e.label}` : ''}</div>
                      </div>
                      <BalanceCell entry={e} />
                    </div>
                    {/* Which of your bots is CURRENTLY preferring this
                        exact account, and how — by direct request
                        ("exchange balance page should somehow
                        integrate with the preferred exchange and
                        auto"). */}
                    {e.used_by.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {e.used_by.map((u) => (
                          <span
                            key={u.bot_id}
                            title={u.reason || undefined}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              u.mode === 'auto'
                                ? dark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'
                                : dark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                            }`}
                          >
                            {u.mode === 'auto' ? <Zap size={10} /> : <Pin size={10} />} {u.bot_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={cardCls}>
            <h2 className="text-sm font-semibold mb-3">Your Connected Exchanges</h2>
            {!data?.trader_accounts.length ? (
              <p className={`text-sm ${mutedCls}`}>No connected exchange accounts yet — connect one from Exchange Connections.</p>
            ) : (
              <div className="space-y-1.5">
                {data.trader_accounts.map((e, i) => (
                  <div key={e.connection_id} className={`flex items-center justify-between py-2 ${i > 0 ? `border-t ${dark ? 'border-smc-border' : 'border-corporate-bg'}` : ''}`}>
                    <div className="min-w-0">
                      <div className="text-sm font-medium capitalize truncate">{e.exchange}</div>
                      {e.label && <div className={`text-xs ${mutedCls}`}>{e.label}</div>}
                    </div>
                    <BalanceCell entry={e} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
