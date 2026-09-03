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
 * Styled to the trader dashboard's own smc-* palette (see RosterPanel's
 * docstring for why) rather than a separate corporate-dark palette.
 *
 * Deliberately doesn't include an "emotions" metric: there's no real
 * data source for trader psychology anywhere in this backend (no
 * journal, no mood log, nothing) — inventing a number for it would be
 * exactly the kind of fabricated stat this codebase's own conventions
 * avoid elsewhere (see e.g. CorporateHomePage's stats grid, built to
 * default to 0 rather than invent a number). A real version of this
 * needs a trade-journal/mood-log feature to read from first.
 */
export function TraderOversightPanel() {
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

  const inputCls = 'w-full mt-1 bg-smc-dark border border-smc-border rounded-lg px-2 py-1.5 text-sm text-white';

  return (
    <div className="bg-smc-card border border-smc-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-smc-accent" />
          <h3 className="text-lg font-bold">Trader Oversight</h3>
        </div>
        <p className="text-xs text-gray-400">Real risk, exposure, and trade activity per Trader</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : roster.length === 0 ? (
        <p className="text-sm text-gray-400">No traders on your roster yet.</p>
      ) : (
        <div className="space-y-2">
          {roster.map((r) => (
            <div key={r.trader_user_id} className="rounded-lg bg-white/5">
              <button
                onClick={() => toggleTrader(r.trader_user_id)}
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <div>
                  <div className="text-sm font-medium">{r.full_name}</div>
                  <div className="text-xs text-gray-400">{r.email}</div>
                </div>
                {expandedId === r.trader_user_id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {expandedId === r.trader_user_id && (
                <div className="px-3 pb-3">
                  {overviewLoading ? (
                    <p className="text-xs text-gray-400">Loading…</p>
                  ) : overview && overview.trader_user_id === r.trader_user_id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 rounded-lg bg-smc-dark">
                          <div className={`text-sm font-bold ${overview.daily_pnl >= 0 ? 'text-smc-success' : 'text-smc-danger'}`}>
                            {overview.daily_pnl >= 0 ? '+' : ''}{overview.daily_pnl.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-gray-400">Today's P&L</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-smc-dark">
                          <div className="text-sm font-bold">{overview.total_active_trades}</div>
                          <div className="text-[10px] text-gray-400">Active trades</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-smc-dark">
                          <div className="text-sm font-bold">{overview.open_risk_exposure_pct.toFixed(1)}%</div>
                          <div className="text-[10px] text-gray-400">Open exposure</div>
                        </div>
                      </div>

                      {overview.bots.length === 0 ? (
                        <p className="text-xs text-gray-400">No bots configured for this trader yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {overview.bots.map((bot) => (
                            <div key={bot.bot_id} className="rounded-lg p-3 bg-smc-dark">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm font-medium">{bot.bot_name}</div>
                                  <div className="text-xs text-gray-400">
                                    {bot.active_trades}/{bot.max_concurrent_trades} concurrent · {bot.trades_today}/{bot.max_daily_trades} today
                                  </div>
                                </div>
                                <button
                                  onClick={() => startEditBot(bot)}
                                  className="text-xs font-medium text-smc-accent px-2.5 py-1 rounded-lg bg-smc-accent/10 hover:bg-smc-accent/20"
                                >
                                  {editingBotId === bot.bot_id ? 'Cancel' : 'Edit'}
                                </button>
                              </div>

                              {editingBotId === bot.bot_id && editing && (
                                <div className="mt-3 pt-3 border-t border-smc-border">
                                  <div className="grid grid-cols-2 gap-2">
                                    <label className="text-xs text-gray-400">
                                      Risk/trade (%)
                                      <input type="number" step="0.1" min="0.1" max="25" value={editing.risk_per_trade}
                                        onChange={(e) => setEditing({ ...editing, risk_per_trade: Number(e.target.value) })}
                                        className={inputCls} />
                                    </label>
                                    <label className="text-xs text-gray-400">
                                      Min R:R
                                      <input type="number" step="0.1" min="0.1" max="20" value={editing.min_rr_ratio}
                                        onChange={(e) => setEditing({ ...editing, min_rr_ratio: Number(e.target.value) })}
                                        className={inputCls} />
                                    </label>
                                    <label className="text-xs text-gray-400">
                                      Max daily trades
                                      <input type="number" step="1" min="1" max="200" value={editing.max_daily_trades}
                                        onChange={(e) => setEditing({ ...editing, max_daily_trades: Number(e.target.value) })}
                                        className={inputCls} />
                                    </label>
                                    <label className="text-xs text-gray-400">
                                      Max concurrent
                                      <input type="number" step="1" min="1" max="50" value={editing.max_concurrent_trades}
                                        onChange={(e) => setEditing({ ...editing, max_concurrent_trades: Number(e.target.value) })}
                                        className={inputCls} />
                                    </label>
                                  </div>
                                  <button
                                    onClick={() => saveBotMetrics(bot.bot_id, r.trader_user_id)}
                                    disabled={saving}
                                    className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-smc-accent text-white rounded-lg text-xs font-medium disabled:opacity-50"
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
