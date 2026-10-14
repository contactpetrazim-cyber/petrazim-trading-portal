import { useEffect, useState } from 'react';
import { SlidersHorizontal, History as HistoryIcon, Undo2 } from 'lucide-react';
import { BotConfig } from '../types';
import { botsApi } from '../services/api';

type Adjustment = {
  id: string; adjustment_type: string; previous_config: Record<string, number>; new_config: Record<string, number>;
  trigger_metric: string | null; trigger_value: number | null; threshold_value: number | null;
  backtest_results: Record<string, number> | null; created_at: string; applied_at: string | null;
};

/**
 * BotStrategyModeControl — Basic vs Intelligent toggle + Basic-mode
 * manual editing of this bot's tunable strategy parameters (see
 * backend app/core/bot_strategies.py's TUNABLE_PARAM_BOUNDS, the
 * declarative guardrail registry every value here is validated
 * against both client-side, for a responsive slider, and again
 * server-side in update_bot_metrics — never trusted from the client
 * alone), plus Intelligent mode's own auto-tuning audit trail and
 * one-click revert (app/services/intelligent_tuning_worker.py).
 *
 * Same self-contained {bot, dark, onChanged} shape as
 * BotScheduleControl/BotSleepAndSubAuto/BotBacktestPanel.
 *
 * The auto-tuning job itself is real and live-verified, but ships off
 * platform-wide by default (INTELLIGENT_TUNING_ENABLED) — same
 * off-by-default caution as the live-trade partial-exit ladder earlier
 * in this plan, since it changes a bot's own strategy parameters
 * without a human clicking anything each time. This panel says so
 * plainly: opting a bot in here reserves its seat for when the
 * platform operator turns the worker on, it does not itself guarantee
 * anything is tuning in the background yet.
 */
export function BotStrategyModeControl({ bot, dark, onChanged }: { bot: BotConfig; dark: boolean; onChanged: () => void }) {
  const [params, setParams] = useState<{ key: string; min: number; max: number; default: number; current: number }[]>([]);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isIntelligent = bot.bot_mode === 'intelligent';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load = isIntelligent
      ? botsApi.getStrategyAdjustments(bot.bot_id, 5).then((res) => { if (!cancelled) setAdjustments(res); })
      : botsApi.getTunableParams(bot.bot_id).then((res) => {
          if (cancelled) return;
          setParams(res.params);
          setDraft(Object.fromEntries(res.params.map((p) => [p.key, p.current])));
        });
    load.catch(() => { if (!cancelled) { setParams([]); setAdjustments([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bot.bot_id, isIntelligent]);

  async function switchStrategyMode() {
    const next = isIntelligent ? 'basic' : 'intelligent';
    setSwitching(true);
    setError(null);
    try {
      await botsApi.setStrategyMode(bot.bot_id, next);
      onChanged();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not switch strategy mode.');
    } finally {
      setSwitching(false);
    }
  }

  async function saveParams() {
    setSaving(true);
    setError(null);
    try {
      await botsApi.updateMetrics(bot.bot_id, { strategy_params: draft });
      onChanged();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not save strategy parameters.');
    } finally {
      setSaving(false);
    }
  }

  async function revert() {
    setReverting(true);
    setError(null);
    try {
      await botsApi.revertLastAdjustment(bot.bot_id);
      onChanged();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not revert the last adjustment.');
    } finally {
      setReverting(false);
    }
  }

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const dirty = params.some((p) => draft[p.key] !== p.current);

  return (
    <div className={`rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <SlidersHorizontal size={14} className={isIntelligent ? 'text-purple-400' : 'text-gray-400'} />
          Strategy Mode
        </div>
        <button
          onClick={switchStrategyMode}
          disabled={switching}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 ${
            isIntelligent ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20' : dark ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          {isIntelligent ? 'Switch to Basic' : 'Switch to Intelligent'}
        </button>
      </div>

      {isIntelligent ? (
        <div className="space-y-2">
          <p className={`text-[11px] ${mutedCls}`}>
            Intelligent mode is opted in. A periodic job evaluates small, bounded parameter changes against real historical backtests and only applies one that clears a real statistical bar — it only runs when the platform operator has turned the worker on; opting in here just reserves this bot's seat for when it is.
          </p>
          {loading ? (
            <p className={`text-[11px] ${mutedCls}`}>Loading…</p>
          ) : adjustments.length === 0 ? (
            <p className={`text-[11px] ${mutedCls}`}>No auto-tune changes have been applied to this bot yet.</p>
          ) : (
            <div className="space-y-1.5">
              <div className={`flex items-center gap-1 text-[11px] font-medium ${mutedCls}`}>
                <HistoryIcon size={12} /> Auto-tune history
              </div>
              {adjustments.map((a) => (
                <div key={a.id} className={`text-[11px] rounded-lg px-2 py-1.5 ${dark ? 'bg-white/5' : 'bg-white'}`}>
                  <div className={dark ? 'text-white/80' : 'text-gray-700'}>
                    {Object.entries(a.previous_config).map(([k, v]) => `${k}: ${v}`).join(', ') || '(defaults)'}
                    {' -> '}
                    {Object.entries(a.new_config).map(([k, v]) => `${k}: ${v}`).join(', ')}
                  </div>
                  <div className={mutedCls}>
                    {a.trigger_metric} {a.trigger_value}R (needed ≥ {a.threshold_value}R) · {a.applied_at ? new Date(a.applied_at).toLocaleString() : 'pending'}
                  </div>
                </div>
              ))}
              <button
                onClick={revert}
                disabled={reverting}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 ${dark ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                <Undo2 size={12} /> {reverting ? 'Reverting…' : 'Revert Last Change'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <p className={`text-[11px] mb-2 ${mutedCls}`}>
            Basic mode: these values are fixed until you change them by hand. Leaving a field at its default is identical to this bot's original behavior.
          </p>
          {loading ? (
            <p className={`text-[11px] ${mutedCls}`}>Loading…</p>
          ) : params.length === 0 ? (
            <p className={`text-[11px] ${mutedCls}`}>This bot's strategy has no tunable parameters yet.</p>
          ) : (
            <div className="space-y-2">
              {params.map((p) => (
                <div key={p.key} className="flex items-center gap-2">
                  <label className={`text-xs w-20 ${mutedCls}`}>{p.key}</label>
                  <input
                    type="number" min={p.min} max={p.max} step={1}
                    value={draft[p.key] ?? p.current}
                    onChange={(e) => setDraft((d) => ({ ...d, [p.key]: Number(e.target.value) }))}
                    className={`w-20 px-2 py-1 rounded-lg text-xs border ${dark ? 'bg-white/5 text-white border-white/10' : 'bg-white text-gray-700 border-gray-200'}`}
                  />
                  <span className={`text-[10px] ${mutedCls}`}>({p.min}–{p.max}, default {p.default})</span>
                </div>
              ))}
              <button
                onClick={saveParams}
                disabled={saving || !dirty}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 ${dark ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                {saving ? 'Saving…' : 'Save Parameters'}
              </button>
            </div>
          )}
        </>
      )}
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
