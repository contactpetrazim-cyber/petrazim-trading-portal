import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';
import { LoadingIndicator } from './LoadingIndicator';
import { CoinFlipSimulator } from './CoinFlipSimulator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ScenarioSet {
  kind: string;
  items: Record<string, unknown>[];
  summary?: string | null;
}

/**
 * ScenarioDrillPanel — the actual interactive materials a Practice
 * Drill's own prompt promises ("given five signal cards (provided in
 * Practise), ..."). By direct bug report: these prompts only ever
 * rendered as plain TEXT, with whatever cards/sequences/logs/tool they
 * referred to never built — "only the summary shows", not the real
 * exercise. Fetches the real PracticeScenarioSet for this lesson (see
 * routers/practise.py) and renders it with the generic sub-renderer
 * matching its `kind` — no fabricated content, every item authored
 * directly against the lesson's own real prompt (see
 * scripts/seed_practice_scenarios.py).
 *
 * Lazily fetched — only called once a drill is expanded, not for
 * every drill on the page up front, since most lessons don't have one
 * yet (this is the first wave; the rest is the SMC Academy overhaul).
 */
export function ScenarioDrillPanel({ lessonId, dark }: { lessonId: string; dark: boolean }) {
  const { token } = useAuth();
  const [set, setSet] = useState<ScenarioSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<FetchPhase>('idle');

  useEffect(() => {
    if (!token) return;
    fetchJsonWithRetry<ScenarioSet | null>(
      `${API_URL}/practise/drills/${lessonId}/scenario-set`,
      { headers: { Authorization: `Bearer ${token}` } },
      setPhase,
    ).then((r) => {
      if (r) setSet(r);
      else setError('Could not load the interactive materials for this drill right now.');
    });
  }, [lessonId, token]);

  if (!set && !error) return <div className="mt-3"><LoadingIndicator phase={phase} dark={dark} /></div>;
  if (error || !set) return <p className={`mt-3 text-xs ${dark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>;

  return (
    <div className={`mt-3 rounded-xl border p-4 ${dark ? 'bg-white/5 border-white/10' : 'bg-corporate-bg border-gray-100'}`}>
      {set.kind === 'coin_flip' && <CoinFlipSimulator dark={dark} />}
      {set.kind === 'numeric_calc' && <NumericCalcDrill items={set.items as unknown as NumericItem[]} summary={set.summary} dark={dark} />}
      {set.kind === 'swing_sequence' && <SwingSequenceDrill items={set.items as unknown as SwingItem[]} dark={dark} />}
      {set.kind === 'signal_cards' && <SignalCardsDrill items={set.items as unknown as SignalCardItem[]} dark={dark} />}
      {set.kind === 'chart_reflection' && <ChartReflectionDrill items={set.items as unknown as ReflectionItem[]} dark={dark} />}
      {set.kind === 'classify' && <ClassifyDrill items={set.items as unknown as ClassifyItem[]} dark={dark} />}
      {set.kind === 'multi_calc' && <MultiCalcDrill items={set.items as unknown as MultiCalcItem[]} dark={dark} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// numeric_calc — e.g. ORIENT-02's three trade logs: compute one value,
// check it against the authored correct_value within tolerance.
// ---------------------------------------------------------------------------
interface NumericItem {
  label: string; trades: number[]; ask: string; correct_value: number; tolerance: number; unit: string; explanation: string;
}
function NumericCalcDrill({ items, summary, dark }: { items: NumericItem[]; summary?: string | null; dark: boolean }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const mutedCls = dark ? 'text-white/70' : 'text-gray-600';
  const allChecked = items.every((_, i) => checked[i]);

  return (
    <div className="space-y-4">
      {items.map((item, i) => {
        const value = parseFloat(answers[i] ?? '');
        const correct = checked[i] && !isNaN(value) && Math.abs(value - item.correct_value) <= item.tolerance;
        return (
          <div key={i} className={`rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-white'}`}>
            <div className={`text-xs font-semibold mb-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{item.label}</div>
            <div className={`text-xs mb-2 font-mono ${mutedCls}`}>
              Trades: {item.trades.map((t) => (t >= 0 ? `+${t}` : `${t}`)).join(', ')}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className={`text-xs ${mutedCls}`}>{item.ask}</label>
              <input
                type="number"
                value={answers[i] ?? ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                className={`w-24 px-2 py-1 rounded-md text-xs font-mono border ${dark ? 'bg-white/10 border-white/10 text-white' : 'bg-white border-gray-200'}`}
              />
              <span className={`text-xs ${mutedCls}`}>{item.unit}</span>
              <button
                onClick={() => setChecked((prev) => ({ ...prev, [i]: true }))}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-corporate-hero text-white"
              >
                Check
              </button>
              {checked[i] && (correct ? <CheckCircle2 size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-red-500" />)}
            </div>
            {checked[i] && <p className={`text-xs mt-2 leading-relaxed ${mutedCls}`}>{item.explanation}</p>}
          </div>
        );
      })}
      {allChecked && summary && (
        <div className={`rounded-lg p-3 text-xs leading-relaxed font-medium ${dark ? 'bg-corporate-hero/20 text-white' : 'bg-corporate-hero/10 text-corporate-hero'}`}>
          {summary}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// swing_sequence — e.g. C2-01's four 6-point sequences: a lightweight
// SVG zigzag (not full CandleChart — this is price points, not OHLCV)
// plus a 3-way multiple-choice classification.
// ---------------------------------------------------------------------------
interface SwingPoint { type: 'high' | 'low'; price: number }
interface SwingItem { points: SwingPoint[]; options: string[]; correct_index: number; explanation: string }
function SwingSequenceDrill({ items, dark }: { items: SwingItem[]; dark: boolean }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const mutedCls = dark ? 'text-white/70' : 'text-gray-600';

  return (
    <div className="space-y-5">
      {items.map((item, i) => {
        const prices = item.points.map((p) => p.price);
        const maxP = Math.max(...prices), minP = Math.min(...prices);
        const pad = (maxP - minP) * 0.1 || 1;
        const w = 220, h = 90;
        const toX = (idx: number) => (idx / (item.points.length - 1)) * (w - 20) + 10;
        const toY = (price: number) => h - ((price - (minP - pad)) / (maxP - minP + pad * 2)) * h;
        const pathD = item.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(idx)} ${toY(p.price)}`).join(' ');

        return (
          <div key={i} className={`rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-white'}`}>
            <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block mb-2">
              <path d={pathD} fill="none" stroke={dark ? '#60a5fa' : '#005FB8'} strokeWidth={1.5} />
              {item.points.map((p, idx) => (
                <circle key={idx} cx={toX(idx)} cy={toY(p.price)} r={3} fill={p.type === 'high' ? '#10b981' : '#ef4444'} />
              ))}
            </svg>
            <div className="flex gap-2 flex-wrap mb-2">
              {item.options.map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => setPicked((prev) => ({ ...prev, [i]: oi }))}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                    picked[i] === oi
                      ? oi === item.correct_index ? 'bg-emerald-500/20 text-emerald-600' : 'bg-red-500/20 text-red-600'
                      : dark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {picked[i] != null && <p className={`text-xs leading-relaxed ${mutedCls}`}>{item.explanation}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// signal_cards — e.g. BOT1-01's 5 bot signal cards: show every card's
// fields, then a single "which one is X?" multiple-choice question.
// ---------------------------------------------------------------------------
interface SignalCard {
  symbol: string; timeframes: string; rr: string; label: string;
  // Optional extra fields a lesson's own prompt asks the learner to
  // key off instead of (or alongside) timeframes/R:R — e.g. BOT4-01's
  // "volume divergence and range structure" or BOT5-01's "confidence/
  // setup-quality values". Omitted entirely for cards where the real
  // bot's analyze() doesn't produce that field (see
  // seed_practice_scenarios_bots.py for which bot each value is traced
  // against), rather than filled with an invented placeholder.
  confidence?: number;
  setup_quality?: number;
  pattern?: string;
  volume_divergence?: string;
  reasoning_snippet?: string;
}
interface SignalCardItem { prompt: string; cards: SignalCard[]; correct_index: number; explanation: string }
function SignalCardsDrill({ items, dark }: { items: SignalCardItem[]; dark: boolean }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const mutedCls = dark ? 'text-white/70' : 'text-gray-600';

  return (
    <div className="space-y-5">
      {items.map((item, i) => (
        <div key={i}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {item.cards.map((c, ci) => (
              <div key={ci} className={`rounded-lg p-2.5 text-xs ${dark ? 'bg-white/5' : 'bg-white border border-gray-100'}`}>
                <div className={`font-semibold mb-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{c.label}</div>
                <div className={mutedCls}>Symbol: <span className="font-mono">{c.symbol}</span></div>
                <div className={mutedCls}>Timeframes: <span className="font-mono">{c.timeframes}</span></div>
                <div className={mutedCls}>R:R: <span className="font-mono">{c.rr}</span></div>
                {c.confidence != null && <div className={mutedCls}>Confidence: <span className="font-mono">{c.confidence}</span></div>}
                {c.setup_quality != null && <div className={mutedCls}>Setup quality: <span className="font-mono">{c.setup_quality}</span></div>}
                {c.pattern && <div className={mutedCls}>Pattern: <span className="font-mono">{c.pattern}</span></div>}
                {c.volume_divergence && <div className={mutedCls}>Volume divergence: <span className="font-mono">{c.volume_divergence}</span></div>}
                {c.reasoning_snippet && <div className={`${mutedCls} mt-1 italic`}>&ldquo;{c.reasoning_snippet}&rdquo;</div>}
              </div>
            ))}
          </div>
          <p className={`text-xs font-medium mb-2 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{item.prompt}</p>
          <div className="flex gap-2 flex-wrap mb-2">
            {item.cards.map((c, ci) => (
              <button
                key={ci}
                onClick={() => setPicked((prev) => ({ ...prev, [i]: ci }))}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                  picked[i] === ci
                    ? ci === item.correct_index ? 'bg-emerald-500/20 text-emerald-600' : 'bg-red-500/20 text-red-600'
                    : dark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {picked[i] != null && <p className={`text-xs leading-relaxed ${mutedCls}`}>{item.explanation}</p>}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// chart_reflection — e.g. ORIENT-01's three chart screenshots: an open,
// self-graded exercise (write your own two sentences, then reveal a
// sample pair to compare against) — matches this module's own
// deliberately self-graded design (see routers/practise.py docstring).
// ---------------------------------------------------------------------------
interface ReflectionItem { description: string; sample_observation: string; sample_label: string }
function ChartReflectionDrill({ items, dark }: { items: ReflectionItem[]; dark: boolean }) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const mutedCls = dark ? 'text-white/70' : 'text-gray-600';

  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={i} className={`rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-white'}`}>
          <p className={`text-xs leading-relaxed mb-2 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
            Chart {i + 1}: {item.description}
          </p>
          <p className={`text-xs mb-2 italic ${mutedCls}`}>
            Write your own two sentences — (1) a purely observational description, (2) the SMC label — then compare.
          </p>
          <button
            onClick={() => setRevealed((prev) => ({ ...prev, [i]: !prev[i] }))}
            className="text-xs font-semibold px-3 py-1 rounded-lg bg-corporate-hero text-white"
          >
            {revealed[i] ? 'Hide sample answer' : 'Reveal sample answer'}
          </button>
          {revealed[i] && (
            <div className={`mt-2 text-xs leading-relaxed space-y-1 ${mutedCls}`}>
              <p><span className="font-semibold">Observation:</span> {item.sample_observation}</p>
              <p><span className="font-semibold">SMC label:</span> {item.sample_label}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// classify — a generic N-items-into-M-categories multiple choice, with an
// optional pair of real code snippets shown above the options (e.g.
// BOT7-01's "is this pair of Bot 3 / Bot 7 snippets shared logic or one of
// the two real differences?"). Deliberately generalized rather than a
// one-off "snippet_compare" kind: the same shape covers a lesson with no
// code at all (e.g. C2-02's uptrend/downtrend/range classification, OF-10's
// "match this SMC concept to its order-flow equivalent") by simply omitting
// `snippets`. Reuses the same button-grid multiple-choice pattern already
// used by swing_sequence and signal_cards above, rather than inventing a
// third slightly-different one.
// ---------------------------------------------------------------------------
interface ClassifySnippet { label: string; code: string }
interface ClassifyItem {
  prompt: string;
  snippets?: ClassifySnippet[];
  options: string[];
  correct_index: number;
  explanation: string;
}
function ClassifyDrill({ items, dark }: { items: ClassifyItem[]; dark: boolean }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const mutedCls = dark ? 'text-white/70' : 'text-gray-600';

  return (
    <div className="space-y-5">
      {items.map((item, i) => (
        <div key={i} className={`rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-white'}`}>
          {item.snippets && item.snippets.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              {item.snippets.map((s, si) => (
                <div key={si} className={`rounded-lg p-2 ${dark ? 'bg-black/30' : 'bg-gray-50 border border-gray-100'}`}>
                  <div className={`text-xs font-semibold mb-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{s.label}</div>
                  <pre className={`text-[11px] font-mono whitespace-pre-wrap leading-snug ${mutedCls}`}>{s.code}</pre>
                </div>
              ))}
            </div>
          )}
          <p className={`text-xs font-medium mb-2 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{item.prompt}</p>
          <div className="flex gap-2 flex-wrap mb-2">
            {item.options.map((opt, oi) => (
              <button
                key={oi}
                onClick={() => setPicked((prev) => ({ ...prev, [i]: oi }))}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg text-left ${
                  picked[i] === oi
                    ? oi === item.correct_index ? 'bg-emerald-500/20 text-emerald-600' : 'bg-red-500/20 text-red-600'
                    : dark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          {picked[i] != null && <p className={`text-xs leading-relaxed ${mutedCls}`}>{item.explanation}</p>}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// multi_calc — a lesson needing SEVERAL linked numeric answers per scenario
// (e.g. BOT1-07: stop distance AND position size AND target price, each
// derived from the last in sequence) rather than numeric_calc's single
// value. Each item carries its own ordered list of {label, ask, unit,
// correct_value, tolerance}; checking is per-field so an early mistake
// doesn't block checking a later field computed from the authored correct
// upstream value.
// ---------------------------------------------------------------------------
interface MultiCalcField { label: string; ask: string; unit: string; correct_value: number; tolerance: number }
interface MultiCalcItem { title: string; given: string; fields: MultiCalcField[]; explanation: string }
function MultiCalcDrill({ items, dark }: { items: MultiCalcItem[]; dark: boolean }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const mutedCls = dark ? 'text-white/70' : 'text-gray-600';

  return (
    <div className="space-y-5">
      {items.map((item, i) => {
        const allChecked = item.fields.every((_, fi) => checked[`${i}-${fi}`]);
        return (
          <div key={i} className={`rounded-lg p-3 ${dark ? 'bg-white/5' : 'bg-white'}`}>
            <div className={`text-xs font-semibold mb-1 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{item.title}</div>
            <div className={`text-xs mb-3 whitespace-pre-line ${mutedCls}`}>{item.given}</div>
            <div className="space-y-2">
              {item.fields.map((f, fi) => {
                const key = `${i}-${fi}`;
                const value = parseFloat(answers[key] ?? '');
                const correct = checked[key] && !isNaN(value) && Math.abs(value - f.correct_value) <= f.tolerance;
                return (
                  <div key={fi} className="flex items-center gap-2 flex-wrap">
                    <label className={`text-xs ${mutedCls}`}>{f.ask}</label>
                    <input
                      type="number"
                      value={answers[key] ?? ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [key]: e.target.value }))}
                      className={`w-24 px-2 py-1 rounded-md text-xs font-mono border ${dark ? 'bg-white/10 border-white/10 text-white' : 'bg-white border-gray-200'}`}
                    />
                    <span className={`text-xs ${mutedCls}`}>{f.unit}</span>
                    <button
                      onClick={() => setChecked((prev) => ({ ...prev, [key]: true }))}
                      className="text-xs font-semibold px-3 py-1 rounded-lg bg-corporate-hero text-white"
                    >
                      Check
                    </button>
                    {checked[key] && (correct ? <CheckCircle2 size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-red-500" />)}
                  </div>
                );
              })}
            </div>
            {allChecked && <p className={`text-xs mt-2 leading-relaxed ${mutedCls}`}>{item.explanation}</p>}
          </div>
        );
      })}
    </div>
  );
}
