import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { BotConfig } from '../types';
import { botsApi } from '../services/api';

/**
 * BotStrategyModeControl — Basic vs Intelligent toggle + Basic-mode
 * manual editing of this bot's tunable strategy parameters (see
 * backend app/core/bot_strategies.py's TUNABLE_PARAM_BOUNDS, the
 * declarative guardrail registry every value here is validated
 * against both client-side, for a responsive slider, and again
 * server-side in update_bot_metrics — never trusted from the client
 * alone).
 *
 * Same self-contained {bot, dark, onChanged} shape as
 * BotScheduleControl/BotSleepAndSubAuto/BotBacktestPanel.
 *
 * Intelligent mode's own automated self-tuning job hasn't shipped yet
 * — switching a bot into it here only opts it in for when that job
 * does; this panel says so plainly rather than implying something is
 * already happening in the background.
 */
export function BotStrategyModeControl({ bot, dark, onChanged }: { bot: BotConfig; dark: boolean; onChanged: () => void }) {
  const [params, setParams] = useState<{ key: string; min: number; max: number; default: number; current: number }[]>([]);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    botsApi.getTunableParams(bot.bot_id)
      .then((res) => {
        if (cancelled) return;
        setParams(res.params);
        setDraft(Object.fromEntries(res.params.map((p) => [p.key, p.current])));
      })
      .catch(() => { if (!cancelled) setParams([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bot.bot_id]);

  async function switchStrategyMode() {
    const next = bot.bot_mode === 'intelligent' ? 'basic' : 'intelligent';
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

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const isIntelligent = bot.bot_mode === 'intelligent';
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
        <p className={`text-[11px] ${mutedCls}`}>
          Intelligent mode is opted in. The automated weekly self-tuning job hasn't shipped yet — this bot keeps running with whatever parameters it currently has until that job exists; opting in now just means it will be included once it does.
        </p>
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
