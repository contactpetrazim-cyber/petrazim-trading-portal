import { useCallback, useEffect, useMemo, useState } from 'react';
import { Crosshair, RefreshCw, Sparkles, Lock } from 'lucide-react';
import { botsApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { formatApiError } from '../lib/apiError';
import type { InstrumentFocusPeriod, InstrumentFocusState, InstrumentLimitMode, InstrumentSuggestion } from '../types';

/**
 * InstrumentFocusControl — the Instrument Focus engine's UI, shared by
 * the Bots page, the Risk page and the Admin console (by direct
 * request: "only a max of 3 instrument pairs can be traded using bots
 * at any given time ... choices for the trader per session, daily,
 * weekly, monthly or perpetual ... except if a master switch is
 * switched to custom or to all ... master control in the Admin, and
 * also traders portal, bots and risk page").
 *
 * - Master switch (Max 3 / Custom / All): editable by Super Admin
 *   only; everyone else sees the resolved state read-only.
 * - Period + session pickers drive a live, data-ranked suggestion list
 *   from GET /bots/instrument-selection/suggestions.
 * - The trader ticks up to the cap and saves; when nothing live is
 *   picked, the engine auto-trades its own top picks so bots never
 *   silently stop.
 * Backend enforcement lives in services/market_scanner.py — this
 * component never decides what trades, it only edits the settings.
 */

const PERIOD_LABELS: Record<InstrumentFocusPeriod, string> = {
  session: 'This session', daily: 'Today', weekly: 'This week', monthly: 'This month', perpetual: 'Until I change it',
};

const MODE_LABELS: Record<InstrumentLimitMode['mode'], string> = {
  limited: 'Max 3', custom: 'Custom', all: 'All instruments',
};

function fmtExpiry(iso: string | null | undefined): string {
  if (!iso) return 'no expiry';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  return `until ${d.toUTCString().replace(':00 GMT', ' UTC')}`;
}

export function InstrumentFocusControl({ dark = false, adminView = false }: { dark?: boolean; adminView?: boolean }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isStaff = isSuperAdmin || user?.role === 'admin';

  // Staff manage either the platform's ownerless bots or their own.
  const [owner, setOwner] = useState<string | undefined>(isStaff ? 'platform' : undefined);
  const [state, setState] = useState<InstrumentFocusState | null>(null);
  const [period, setPeriod] = useState<InstrumentFocusPeriod>('daily');
  const [session, setSession] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<InstrumentSuggestion[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [customMax, setCustomMax] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const applyState = useCallback((s: InstrumentFocusState) => {
    setState(s);
    setCustomMax(s.custom_max);
    if (s.selection_live && s.selection) {
      setPicked(s.selection.symbols);
      setPeriod(s.selection.period);
      setSession(s.selection.session);
    } else {
      setPicked(s.effective_symbols ?? []);
      setSession((prev) => prev ?? s.current_session);
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      applyState(await botsApi.getInstrumentSelection(owner));
    } catch (e: any) {
      setError(formatApiError(e?.response?.data?.detail, 'Could not load the instrument focus.'));
    }
  }, [owner, applyState]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    setSuggestions(null);
    botsApi.getInstrumentSuggestions(period, period === 'session' ? session : null, owner)
      .then((r) => { if (!cancelled) setSuggestions(r.suggestions); })
      .catch((e) => { if (!cancelled) setError(formatApiError(e?.response?.data?.detail, 'Could not load suggestions.')); });
    return () => { cancelled = true; };
  }, [period, session, owner, state?.server_time]);

  const cap = state?.effective_max ?? null;
  const atCap = cap !== null && picked.length >= cap;

  const toggle = (symbol: string) => {
    setNotice(null);
    setPicked((cur) => cur.includes(symbol) ? cur.filter((s) => s !== symbol) : (cap !== null && cur.length >= cap ? cur : [...cur, symbol]));
  };

  const useTopPicks = () => {
    if (!suggestions) return;
    const ranked = suggestions.filter((s) => s.score > 0).map((s) => s.symbol);
    setPicked(cap === null ? ranked : ranked.slice(0, cap));
  };

  async function run(fn: () => Promise<InstrumentFocusState | void>, ok: string) {
    setBusy(true); setError(null); setNotice(null);
    try {
      const s = await fn();
      if (s) applyState(s); else await load();
      setNotice(ok);
    } catch (e: any) {
      setError(formatApiError(e?.response?.data?.detail, 'That change could not be saved.'));
    } finally {
      setBusy(false);
    }
  }

  const save = () => run(
    () => botsApi.saveInstrumentSelection({ symbols: picked, period, session: period === 'session' ? session : null, owner }),
    'Instrument focus saved — bots pick it up on their next scan.',
  );
  const clear = () => run(() => botsApi.clearInstrumentSelection(owner), 'Cleared — the engine is auto-picking its top instruments.');
  const setMode = (mode: InstrumentLimitMode['mode']) => run(
    async () => { await botsApi.setInstrumentLimitMode({ mode, custom_max: customMax }); },
    `Master switch set to ${MODE_LABELS[mode]}.`,
  );

  const card = dark ? 'border-smc-border bg-smc-dark/40' : 'border-gray-200 bg-gray-50';
  const chip = (on: boolean) => `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
    on ? (dark ? 'bg-smc-accent text-white border-smc-accent' : 'bg-corporate-hero text-white border-corporate-hero')
       : (dark ? 'border-smc-border text-white/70 hover:bg-smc-card' : 'border-gray-200 text-gray-600 hover:bg-white')}`;

  const maxScore = useMemo(() => Math.max(0.001, ...(suggestions ?? []).map((s) => s.score)), [suggestions]);

  if (!state) {
    return <p className="text-sm text-gray-400">{error ?? 'Loading instrument focus…'}</p>;
  }

  const sourceText = state.effective_source === 'all'
    ? 'All instruments enabled by the master switch — no focus applied.'
    : state.effective_source === 'selection'
      ? `Your pick (${PERIOD_LABELS[state.selection!.period]}${state.selection!.session ? ` · ${state.sessions.find((s) => s.key === state.selection!.session)?.label}` : ''}), ${fmtExpiry(state.selection!.expires_at)}.`
      : 'No live pick — the engine is auto-trading its top-ranked instruments until you choose.';

  return (
    <div className="space-y-4 text-sm">
      {/* Master switch */}
      <div className={`rounded-xl border p-3 ${card}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold">
            {isSuperAdmin ? <Crosshair size={15} /> : <Lock size={14} className="text-gray-400" />}
            Master switch: <span>{MODE_LABELS[state.mode]}{state.mode === 'custom' ? ` (max ${state.custom_max})` : ''}</span>
          </div>
          {isSuperAdmin && (
            <div className="flex flex-wrap items-center gap-1.5">
              {(['limited', 'custom', 'all'] as const).map((m) => (
                <button key={m} type="button" disabled={busy} onClick={() => setMode(m)} className={chip(state.mode === m)}>
                  {MODE_LABELS[m]}
                </button>
              ))}
              <label className="flex items-center gap-1 text-xs text-gray-400">
                Custom max
                <input
                  type="number" min={1} max={50} value={customMax}
                  onChange={(e) => setCustomMax(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  className={`w-14 px-1.5 py-1 rounded border ${dark ? 'bg-smc-dark border-smc-border text-white' : 'bg-white border-gray-200'}`}
                />
              </label>
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {state.mode === 'all'
            ? 'Every bot trades every instrument it is configured for.'
            : `Bots open new trades on at most ${state.effective_max} instrument${state.effective_max === 1 ? '' : 's'} at a time. Open trades are always managed to completion.`}
          {!isSuperAdmin && ' Only a Super Admin can change this.'}
        </p>
      </div>

      {isStaff && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-1">Applies to:</span>
          <button type="button" className={chip(owner === 'platform')} onClick={() => setOwner('platform')}>Platform bots</button>
          <button type="button" className={chip(owner === user?.id)} onClick={() => setOwner(user?.id)}>My bots</button>
        </div>
      )}

      <div className={`rounded-xl border p-3 ${state.effective_source === 'auto' ? (dark ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-200 bg-amber-50') : card}`}>
        <div className="font-semibold">
          Trading now: {state.effective_symbols === null ? 'all configured instruments' : state.effective_symbols.length ? state.effective_symbols.join(', ') : 'none (no bots)'}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{sourceText}</p>
      </div>

      {state.mode !== 'all' && (
        <>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pick for</div>
            <div className="flex flex-wrap gap-1.5">
              {state.periods.map((p) => (
                <button key={p} type="button" onClick={() => setPeriod(p)} className={chip(period === p)}>{PERIOD_LABELS[p]}</button>
              ))}
            </div>
            {period === 'session' && (
              <div className="flex flex-wrap gap-1.5">
                {state.sessions.map((s) => (
                  <button key={s.key} type="button" onClick={() => setSession(s.key)} className={chip(session === s.key)}>
                    {s.label}{state.current_session === s.key ? ' · open now' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Engine's ranking {period === 'session' ? '(trades inside this session only)' : ''}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${atCap ? 'text-amber-500' : 'text-gray-400'}`}>
                  {picked.length}{cap !== null ? ` / ${cap}` : ''} selected
                </span>
                <button type="button" onClick={useTopPicks} disabled={!suggestions} className="flex items-center gap-1 text-xs font-semibold text-emerald-500 hover:text-emerald-400">
                  <Sparkles size={12} /> Use top picks
                </button>
              </div>
            </div>
            {!suggestions && <p className="text-xs text-gray-400">Ranking instruments…</p>}
            {suggestions && suggestions.length === 0 && <p className="text-xs text-gray-400">These bots have no instruments configured.</p>}
            <div className="space-y-1.5">
              {suggestions?.map((s) => {
                const on = picked.includes(s.symbol);
                const disabled = !on && atCap;
                return (
                  <button
                    key={s.symbol} type="button" onClick={() => toggle(s.symbol)} disabled={disabled}
                    className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                      on ? (dark ? 'border-smc-accent bg-smc-accent/10' : 'border-corporate-hero bg-corporate-hero/5')
                         : dark ? 'border-smc-border hover:bg-smc-card/60' : 'border-gray-200 hover:bg-gray-50'
                    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <input type="checkbox" readOnly checked={on} className="pointer-events-none" />
                      <span className="text-xs text-gray-400 w-5">#{s.rank ?? '–'}</span>
                      <span className="font-semibold">{s.symbol}</span>
                      <div className={`flex-1 h-1.5 rounded-full ${dark ? 'bg-smc-border' : 'bg-gray-200'}`}>
                        <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.max(0, (s.score / maxScore) * 100)}%` }} />
                      </div>
                      <span className="text-xs tabular-nums w-24 text-right">
                        {s.n ? `${s.win_rate_pct}% · ${s.avg_r}R` : 'no data'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 ml-7">{s.reason}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button" onClick={save} disabled={busy || picked.length === 0}
              className={`px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 ${dark ? 'bg-smc-accent hover:bg-smc-accent/90' : 'bg-corporate-hero hover:bg-corporate-accent-hover'}`}
            >
              Save focus for {PERIOD_LABELS[period].toLowerCase()}
            </button>
            {state.selection && (
              <button type="button" onClick={clear} disabled={busy} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm border border-gray-300/40 text-gray-400 hover:text-gray-300">
                <RefreshCw size={13} /> Let the engine pick
              </button>
            )}
          </div>
        </>
      )}

      {notice && <p className="text-xs text-emerald-500">{notice}</p>}
      {error && <p className="text-xs text-smc-danger">{error}</p>}
      {adminView && (
        <p className="text-xs text-gray-400">
          Ranking: each instrument scores the sum of its two best bot families' average R × √(trades), blended 60% all-time / 40% recent form
          for the chosen period. Session picks only count trades entered inside that session's UTC hours.
        </p>
      )}
    </div>
  );
}
