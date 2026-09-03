import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Save, Users } from 'lucide-react';
import api, { rosterApi, botsApi, TraderOverview } from '../services/api';
import { BotMetricsUpdate } from '../types';

interface RosterEntry {
  trader_user_id: string;
  full_name: string;
  email: string;
  status: string;
}

/**
 * TraderOversightPanel — the "more" a Fund Manager console has over a
 * Partner console: real per-trader risk oversight, not just the
 * roster list both share. Backed by GET /roster/{id}/overview (real
 * bots/risk/exposure for that trader) and the same PATCH
 * /bots/{id}/metrics Bots.tsx uses on a Trader's own console — bots.py
 * now allows a Manager/Partner to edit a bot belonging to a Trader on
 * their own roster, not just view it (see user_can_manage_trader).
 *
 * Deliberately doesn't include an "emotions" metric: there's no real
 * data source for trader psychology anywhere in this backend (no
 * journal, no mood log, nothing) — inventing a number for it would be
 * exactly the kind of fabricated stat this codebase's own conventions
 * avoid elsewhere (see e.g. CorporateHomePage's stats grid, built to
 * default to 0 rather than invent a number). A real version of this
 * needs a trade-journal/mood-log feature to read from first.
 */
export function TraderOversightPanel({ dark = false }: { dark?: boolean }) {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [overview, setOverview] = useState<TraderOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [editingBotId, setEditingBotId] = useState<string | null>(null);
  const [editing, setEditing] = useState<BotMetricsUpdate | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<RosterEntry[]>('/roster').then((r) => setRoster(r.data)).finally(() => setLoading(false));
  }, []);

  async function toggleTrader(traderId: string) {
    if (expandedId === traderId) {
      setExpandedId(null);
      setOverview(null);
      return;
    }
    setExpandedId(traderId);
    setOverviewLoading(true);
    try {
      setOverview(await rosterApi.getOverview(traderId));
    } finally {
      setOverviewLoading(false);
    }
  }

  function startEditBot(bot: TraderOverview['bots'][number]) {
    if (editingBotId === bot.bot_id) {
      setEditingBotId(null);
      setEditing(null);
      return;
    }
    setEditingBotId(bot.bot_id);
    setEditing({
      risk_per_trade: bot.risk_per_trade,
      max_daily_trades: bot.max_daily_trades,
      max_concurrent_trades: bot.max_concurrent_trades,
      max_portfolio_exposure: bot.max_portfolio_exposure,
      min_rr_ratio: bot.min_rr_ratio,
    });
  }

  async function saveBotMetrics(botId: string, traderId: string) {
    if (!editing) return;
    setSaving(true);
    try {
      await botsApi.updateMetrics(botId, editing);
      setEditingBotId(null);
      setOverview(await rosterApi.getOverview(traderId));
    } finally {
      setSaving(false);
    }
  }

  const surface = dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg';
  const text = dark ? 'text-white' : 'text-corporate-text-on-bg';
  const muted = dark ? 'text-white/40' : 'text-gray-500';
  const rowBg = dark ? 'bg-corporate-nav-dark' : 'bg-corporate-bg';
  const inputCls = `w-full mt-1 rounded-lg px-2 py-1.5 text-sm ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark text-white' : 'border border-gray-200 text-corporate-text-on-bg'}`;

  return (
    <div className={`rounded-2xl border p-5 ${surface}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-corporate-hero" />
          <h3 className={`font-semibold ${text}`}>Trader Oversight</h3>
        </div>
        <p className={`text-xs ${muted}`}>Real risk, exposure, and trade activity per Trader</p>
      </div>

      {loading ? (
        <p className={`text-sm ${muted}`}>Loading…</p>
      ) : roster.length === 0 ? (
        <p className={`text-sm ${muted}`}>No traders on your roster yet.</p>
      ) : (
        <div className="space-y-2">
          {roster.map((r) => (
            <div key={r.trader_user_id} className={`rounded-lg ${rowBg}`}>
              <button
                onClick={() => toggleTrader(r.trader_user_id)}
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <div>
                  <div className={`text-sm font-medium ${text}`}>{r.full_name}</div>
                  <div className={`text-xs ${muted}`}>{r.email}</div>
                </div>
                {expandedId === r.trader_user_id ? <ChevronUp size={16} className={muted} /> : <ChevronDown size={16} className={muted} />}
              </button>

              {expandedId === r.trader_user_id && (
                <div className="px-3 pb-3">
                  {overviewLoading ? (
                    <p className={`text-xs ${muted}`}>Loading…</p>
                  ) : overview && overview.trader_user_id === r.trader_user_id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className={`text-center p-2 rounded-lg ${dark ? 'bg-corporate-surface-dark' : 'bg-white'}`}>
                          <div className={`text-sm font-bold ${overview.daily_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {overview.daily_pnl >= 0 ? '+' : ''}{overview.daily_pnl.toFixed(2)}
                          </div>
                          <div className={`text-[10px] ${muted}`}>Today's P&L</div>
                        </div>
                        <div className={`text-center p-2 rounded-lg ${dark ? 'bg-corporate-surface-dark' : 'bg-white'}`}>
                          <div className={`text-sm font-bold ${text}`}>{overview.total_active_trades}</div>
                          <div className={`text-[10px] ${muted}`}>Active trades</div>
                        </div>
                        <div className={`text-center p-2 rounded-lg ${dark ? 'bg-corporate-surface-dark' : 'bg-white'}`}>
                          <div className={`text-sm font-bold ${text}`}>{overview.open_risk_exposure_pct.toFixed(1)}%</div>
                          <div className={`text-[10px] ${muted}`}>Open exposure</div>
                        </div>
                      </div>

                      {overview.bots.length === 0 ? (
                        <p className={`text-xs ${muted}`}>No bots configured for this trader yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {overview.bots.map((bot) => (
                            <div key={bot.bot_id} className={`rounded-lg p-3 ${dark ? 'bg-corporate-surface-dark' : 'bg-white'}`}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className={`text-sm font-medium ${text}`}>{bot.bot_name}</div>
                                  <div className={`text-xs ${muted}`}>
                                    {bot.active_trades}/{bot.max_concurrent_trades} concurrent · {bot.trades_today}/{bot.max_daily_trades} today
                                  </div>
                                </div>
                                <button
                                  onClick={() => startEditBot(bot)}
                                  className="text-xs font-medium text-corporate-hero px-2.5 py-1 rounded-lg bg-corporate-hero/10 hover:bg-corporate-hero/20"
                                >
                                  {editingBotId === bot.bot_id ? 'Cancel' : 'Edit'}
                                </button>
                              </div>

                              {editingBotId === bot.bot_id && editing && (
                                <div className="mt-3 pt-3 border-t border-corporate-bg/20">
                                  <div className="grid grid-cols-2 gap-2">
                                    <label className={`text-xs ${muted}`}>
                                      Risk/trade (%)
                                      <input type="number" step="0.1" min="0.1" max="25" value={editing.risk_per_trade}
                                        onChange={(e) => setEditing({ ...editing, risk_per_trade: Number(e.target.value) })}
                                        className={inputCls} />
                                    </label>
                                    <label className={`text-xs ${muted}`}>
                                      Min R:R
                                      <input type="number" step="0.1" min="0.1" max="20" value={editing.min_rr_ratio}
                                        onChange={(e) => setEditing({ ...editing, min_rr_ratio: Number(e.target.value) })}
                                        className={inputCls} />
                                    </label>
                                    <label className={`text-xs ${muted}`}>
                                      Max daily trades
                                      <input type="number" step="1" min="1" max="200" value={editing.max_daily_trades}
                                        onChange={(e) => setEditing({ ...editing, max_daily_trades: Number(e.target.value) })}
                                        className={inputCls} />
                                    </label>
                                    <label className={`text-xs ${muted}`}>
                                      Max concurrent
                                      <input type="number" step="1" min="1" max="50" value={editing.max_concurrent_trades}
                                        onChange={(e) => setEditing({ ...editing, max_concurrent_trades: Number(e.target.value) })}
                                        className={inputCls} />
                                    </label>
                                  </div>
                                  <button
                                    onClick={() => saveBotMetrics(bot.bot_id, r.trader_user_id)}
                                    disabled={saving}
                                    className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-corporate-hero text-white rounded-lg text-xs font-medium disabled:opacity-50"
                                  >
                                    <Save size={12} /> {saving ? 'Saving…' : 'Save'}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
