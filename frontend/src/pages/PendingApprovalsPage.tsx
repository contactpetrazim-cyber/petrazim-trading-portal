
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpRight, ArrowDownRight, Check, Ban, Clock3, RefreshCw, Bot, ChevronDown, ChevronUp, AlertTriangle, X } from 'lucide-react';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { PositionOnChartModal } from '../components/PositionOnChartModal';
import { tradeToChartPosition } from '../components/ChartPanel';
import { useEffectiveChartColors } from '../hooks/useCandleColors';
import { tradesApi } from '../services/api';
import { Trade } from '../types';
import { useThemeStore } from '../hooks/useTheme';
import { formatApiError } from '../lib/apiError';

const POLL_MS = 30_000;

/**
 * PendingApprovalsPage — dedicated page for every trade recommendation
 * awaiting a human decision, by direct request: "Create a 'Pending
 * Approvals' page under the traders dashboard where I can Approve, Not
 * Approve or Defer each trade recommendation ... Each trade
 * recommendation is listed as a card complete with all the details ...
 * The Pending Approval chart should have an 'Approval Chart' exactly
 * like the 'Onchart' ... copy the On Chart with all its tools etc ...
 * even from the Approval Chart." Backed entirely by endpoints that
 * already existed (GET /trades/pending-approvals, POST /trades/approve)
 * plus the new POST /trades/{id}/reanalyze — no new list-fetch logic
 * needed beyond what tradesApi already had.
 *
 * "Defer" has no backend state to persist (there's no real "come back
 * to this later" column on Trade) — it's a pure client-side snooze:
 * the card drops out of THIS view until the next full reload, exactly
 * as PositionOnChartModal's own onDefer docstring already documents
 * for the chart's own Defer button.
 */
export function PendingApprovalsPage() {
  const { portalThemes } = useThemeStore();
  const theme = portalThemes.trader;
  const dark = theme === 'dark';
  const { colors } = useEffectiveChartColors();

  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deferredIds, setDeferredIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chartTradeId, setChartTradeId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  // A Re-Analyse that finds the setup no longer valid moves the trade
  // OFF pending (CANCELLED) — which would otherwise make it vanish
  // from this list (and its reasoning with it) the instant `load()`
  // re-fetches, before you ever get to read why. By direct bug report
  // ("the reasoning and context ... disappear after the Re-Analyse -
  // it shouldn't"): keep it visible here, in its own distinct card,
  // until explicitly dismissed.
  const [invalidated, setInvalidated] = useState<Record<string, Trade>>({});

  async function load() {
    try {
      const data = await tradesApi.getPendingApprovals();
      setTrades(data);
      setError(null);
    } catch {
      setError('Could not load pending approvals.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const visible = trades.filter((t) => !deferredIds.has(t.trade_id));
  const chartTrade = chartTradeId
    ? trades.find((t) => t.trade_id === chartTradeId) ?? invalidated[chartTradeId] ?? null
    : null;

  function dismissInvalidated(tradeId: string) {
    setInvalidated((prev) => {
      const next = { ...prev };
      delete next[tradeId];
      return next;
    });
    if (chartTradeId === tradeId) setChartTradeId(null);
  }

  async function handleApprove(tradeId: string) {
    setBusyId(tradeId);
    try {
      await tradesApi.approveTrade(tradeId, true);
      setError(null);
      if (chartTradeId === tradeId) setChartTradeId(null);
      await load();
    } catch (e: any) {
      setError(formatApiError(e?.response?.data?.detail, 'Could not approve — try again in a moment.'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(tradeId: string) {
    setBusyId(tradeId);
    try {
      await tradesApi.approveTrade(tradeId, false);
      setError(null);
      if (chartTradeId === tradeId) setChartTradeId(null);
      await load();
    } catch (e: any) {
      setError(formatApiError(e?.response?.data?.detail, 'Could not reject — try again in a moment.'));
    } finally {
      setBusyId(null);
    }
  }

  function handleDefer(tradeId: string) {
    setDeferredIds((prev) => new Set(prev).add(tradeId));
    if (chartTradeId === tradeId) setChartTradeId(null);
  }

  async function handleReanalyze(tradeId: string) {
    setReanalyzing(true);
    try {
      const updated = await tradesApi.reanalyzeTrade(tradeId);
      setError(null);
      if (updated.status !== 'pending') {
        // No longer valid — keep it visible with its full reasoning
        // (original + the new context note) rather than letting it
        // silently vanish; see `invalidated`'s own comment above.
        setInvalidated((prev) => ({ ...prev, [tradeId]: updated }));
      }
      await load();
    } catch (e: any) {
      setError(formatApiError(e?.response?.data?.detail, 'Could not re-analyse — try again in a moment.'));
    } finally {
      setReanalyzing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Pending Approvals</h2>
        <p className="text-gray-400 text-sm mt-1">
          Every bot recommendation waiting on your decision — nothing here executes until you Approve it.
        </p>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      {loading && trades.length === 0 && (
        <div className="py-2"><LoadingIndicator phase="loading" dark={dark} /></div>
      )}

      {!loading && visible.length === 0 && (
        <div className={`text-center py-12 rounded-xl border ${dark ? 'bg-smc-card border-smc-border text-gray-400' : 'bg-white border-corporate-bg text-gray-500'}`}>
          {trades.length > 0 ? 'Nothing left to review right now — everything deferred is still pending, just out of this view until you reload.' : 'Nothing pending — every bot recommendation has already been decided on.'}
        </div>
      )}

      <div className="space-y-3">
        {visible.map((t) => {
          const isLong = t.direction === 'long';
          const isExpanded = expandedId === t.trade_id;
          const isBusy = busyId === t.trade_id;
          return (
            <div
              key={t.trade_id}
              className={`rounded-xl border overflow-hidden ${dark ? 'bg-smc-card border-smc-border' : 'bg-white border-corporate-bg'}`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-medium ${isLong ? 'bg-smc-long/10 text-smc-long' : 'bg-smc-short/10 text-smc-short'}`}>
                      {isLong ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {t.direction.toUpperCase()}
                    </div>
                    <div>
                      <button onClick={() => setChartTradeId(t.trade_id)} className={`font-bold hover:underline ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
                        {t.symbol}
                      </button>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <Bot size={11} /> {t.bot_name || t.bot_id} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDefer(t.trade_id)}
                      disabled={isBusy}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 ${dark ? 'bg-smc-border text-gray-300 hover:text-white' : 'bg-gray-100 text-gray-600 hover:text-corporate-text-on-bg'}`}
                      title="Decide later — leaves this recommendation pending, unchanged"
                    >
                      <Clock3 size={14} /> Defer
                    </button>
                    <button
                      onClick={() => handleReject(t.trade_id)}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-50"
                    >
                      <Ban size={14} /> Not Approve
                    </button>
                    <button
                      onClick={() => handleApprove(t.trade_id)}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      <Check size={14} /> Approve
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-gray-500">Entry:</span> <span className="ml-1 font-mono">{t.entry_price?.toFixed(2) ?? '—'}</span></div>
                  <div><span className="text-gray-500">SL:</span> <span className="ml-1 font-mono text-red-400">{t.stop_loss.toFixed(2)}</span></div>
                  <div><span className="text-gray-500">TP1:</span> <span className="ml-1 font-mono text-emerald-400">{t.take_profit?.toFixed(2) ?? '—'}</span></div>
                  <div><span className="text-gray-500">Risk:</span> <span className="ml-1 font-mono">{t.risk_percent}%</span></div>
                  {(t.take_profit_2 || t.take_profit_3) && (
                    <>
                      {t.take_profit_2 && <div><span className="text-gray-500">TP2:</span> <span className="ml-1 font-mono text-emerald-400">{t.take_profit_2.toFixed(2)}</span></div>}
                      {t.take_profit_3 && <div><span className="text-gray-500">TP3:</span> <span className="ml-1 font-mono text-emerald-400">{t.take_profit_3.toFixed(2)}</span></div>}
                    </>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => setChartTradeId(t.trade_id)}
                    className={`text-xs font-medium ${dark ? 'text-smc-accent' : 'text-corporate-hero'} hover:underline`}
                  >
                    Open Approval Chart →
                  </button>
                  <button
                    onClick={() => handleReanalyze(t.trade_id)}
                    disabled={reanalyzing}
                    className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-300 disabled:opacity-50"
                    title="Re-run this bot's strategy against current market data"
                  >
                    <RefreshCw size={12} className={reanalyzing ? 'animate-spin' : ''} /> {reanalyzing ? 'Re-Analysing…' : 'Re-Analyse'}
                  </button>
                  {t.reasoning_log && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : t.trade_id)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-400 ml-auto"
                    >
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Reasoning
                    </button>
                  )}
                </div>

                {isExpanded && t.reasoning_log && (
                  <p className={`mt-2 text-xs whitespace-pre-wrap ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{t.reasoning_log}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Re-Analysed as no longer valid — kept visible (not silently
          dropped) with its full reasoning history until dismissed. */}
      {Object.values(invalidated).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-400">No Longer Valid — Re-Analysed</h3>
          {Object.values(invalidated).map((t) => (
            <div key={t.trade_id} className={`rounded-xl border overflow-hidden opacity-75 ${dark ? 'bg-smc-card border-amber-500/30' : 'bg-white border-amber-300'}`}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-medium bg-amber-500/10 text-amber-500">
                      <AlertTriangle size={14} /> No longer valid
                    </span>
                    <div>
                      <div className={`font-bold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{t.symbol}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <Bot size={11} /> {t.bot_name || t.bot_id}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => dismissInvalidated(t.trade_id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${dark ? 'bg-white/5 text-white/60 hover:text-white' : 'bg-gray-100 text-gray-600 hover:text-corporate-text-on-bg'}`}
                  >
                    <X size={13} /> Dismiss
                  </button>
                </div>
                {t.reasoning_log && (
                  <p className={`mt-2 text-xs whitespace-pre-wrap ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{t.reasoning_log}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approval Chart — the On Chart tool, reused verbatim, pre-loaded
          with the selected card's own Entry/SL/TP and its own
          Approve/Not Approve/Defer/Re-Analyse toolbar buttons wired to
          the SAME handlers as the cards above. */}
      {chartTrade && (
        <PositionOnChartModal
          position={tradeToChartPosition(chartTrade)}
          trade={chartTrade}
          symbol={chartTrade.symbol}
          bullColor={colors.upColor}
          bearColor={colors.downColor}
          onClose={() => setChartTradeId(null)}
          onChanged={load}
          // Approve/Reject only make sense while the trade is still
          // genuinely PENDING — a Re-Analyse that just invalidated it
          // (status now CANCELLED) omits both, offering only Dismiss
          // (repurposing Defer) instead of a nonsensical "approve an
          // already-cancelled trade" action.
          onApprove={chartTrade.status === 'pending' ? () => handleApprove(chartTrade.trade_id) : undefined}
          onReject={chartTrade.status === 'pending' ? () => handleReject(chartTrade.trade_id) : undefined}
          onDefer={chartTrade.status === 'pending' ? () => handleDefer(chartTrade.trade_id) : () => dismissInvalidated(chartTrade.trade_id)}
          onReanalyze={chartTrade.status === 'pending' ? () => handleReanalyze(chartTrade.trade_id) : undefined}
          reanalyzing={reanalyzing}
        />
      )}
    </div>
  );
}
