import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Trophy, ArrowLeft, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface EmpireOutcome { label: string; probability: number; metricDeltas: Record<string, number> }
export interface EmpireOption { label: string; outcomes: EmpireOutcome[] }
export interface EmpireRound { id: string; prompt: string; options: EmpireOption[] }
export interface EmpireSimConfig {
  theme: string;
  startingMetrics: Record<string, number>;
  metricLabels: Record<string, { label: string; format: 'currency' | 'percent' | 'number' }>;
  primaryMetric: string;
  rounds: EmpireRound[];
}

const TEAM_COLORS = ['#0891b2', '#f59e0b', '#8b5cf6', '#22c55e', '#ec4899'];

function fmt(value: number, format: 'currency' | 'percent' | 'number'): string {
  if (format === 'currency') return `$${Math.round(value).toLocaleString()}`;
  if (format === 'percent') return `${value.toFixed(1)}%`;
  return Math.round(value).toLocaleString();
}

/** Weighted-random resolution — never deterministic, but the option's
 * own outcome probabilities (better-aligned choices skew toward
 * better outcomes when the config author sets them up that way) drive
 * it, per Section 10b's "weighted-random outcome resolution". */
function resolveOutcome(outcomes: EmpireOutcome[]): EmpireOutcome {
  const total = outcomes.reduce((s, o) => s + o.probability, 0);
  let r = Math.random() * total;
  for (const o of outcomes) {
    r -= o.probability;
    if (r <= 0) return o;
  }
  return outcomes[outcomes.length - 1];
}

interface Team {
  name: string;
  metrics: Record<string, number>;
  trajectory: Record<string, number>[]; // metrics snapshot after each round
  log: { round: string; choice: string; outcome: string }[];
}

/**
 * EmpireSimEngine — Section 10b: "4-5 teams, same-screen pass-and-play,
 * weighted-random outcome resolution ..., live headline metrics +
 * trajectory chart + scoreboard sidebar, ending in a comparative
 * debrief." One shared engine + per-scenario configs, exactly as the
 * spec calls for here (unlike Section 10a's solo games, which
 * explicitly want distinct components — Team Empire Sims are spec'd
 * the other way).
 */
export function EmpireSimEngine({ config, backHref, dark }: { config: EmpireSimConfig; backHref: string; dark: boolean }) {
  const [phase, setPhase] = useState<'setup' | 'playing' | 'debrief'>('setup');
  const [teamNames, setTeamNames] = useState(['Team A', 'Team B', 'Team C', 'Team D']);
  const [teams, setTeams] = useState<Team[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [turnIndex, setTurnIndex] = useState(0);
  const [resolved, setResolved] = useState<EmpireOutcome | null>(null);

  const round = config.rounds[roundIndex];
  const currentTeam = teams[turnIndex];

  function startSim() {
    const cleaned = teamNames.map((n) => n.trim()).filter(Boolean);
    if (cleaned.length < 2) return;
    setTeams(cleaned.map((name) => ({
      name, metrics: { ...config.startingMetrics },
      trajectory: [{ ...config.startingMetrics }], log: [],
    })));
    setRoundIndex(0);
    setTurnIndex(0);
    setResolved(null);
    setPhase('playing');
  }

  function chooseOption(option: EmpireOption) {
    if (resolved) return;
    const outcome = resolveOutcome(option.outcomes);
    setResolved(outcome);
    setTeams((prev) => prev.map((t, i) => {
      if (i !== turnIndex) return t;
      const newMetrics: Record<string, number> = { ...t.metrics };
      for (const [k, delta] of Object.entries(outcome.metricDeltas)) newMetrics[k] = (newMetrics[k] ?? 0) + delta;
      return { ...t, metrics: newMetrics, log: [...t.log, { round: round.prompt, choice: option.label, outcome: outcome.label }] };
    }));
  }

  function nextTurn() {
    setResolved(null);
    if (turnIndex + 1 < teams.length) {
      setTurnIndex((i) => i + 1);
      return;
    }
    // Every team has taken this round — snapshot trajectories, advance round.
    setTeams((prev) => prev.map((t) => ({ ...t, trajectory: [...t.trajectory, { ...t.metrics }] })));
    setTurnIndex(0);
    if (roundIndex + 1 < config.rounds.length) {
      setRoundIndex((r) => r + 1);
    } else {
      setPhase('debrief');
    }
  }

  const cardCls = `rounded-2xl p-6 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';

  if (phase === 'setup') {
    return (
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <Users size={16} className="text-corporate-hero" />
          <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{config.theme} — team setup</span>
        </div>
        <p className={`text-sm mb-4 ${mutedCls}`}>Same-screen pass-and-play — 2 to 5 teams, name them below, then pass the device around each round.</p>
        <div className="space-y-2 mb-4">
          {teamNames.map((name, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TEAM_COLORS[i % TEAM_COLORS.length] }} />
              <input
                value={name}
                onChange={(e) => setTeamNames((p) => p.map((n, idx) => (idx === i ? e.target.value : n)))}
                className={`flex-1 rounded-lg px-3 py-2 text-sm outline-none border ${dark ? 'bg-corporate-nav-dark border-corporate-border-dark text-white' : 'border-gray-200 text-corporate-text-on-bg'}`}
              />
              {teamNames.length > 2 && (
                <button onClick={() => setTeamNames((p) => p.filter((_, idx) => idx !== i))} aria-label="Remove team" className="text-red-400">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        {teamNames.length < 5 && (
          <button
            onClick={() => setTeamNames((p) => [...p, `Team ${String.fromCharCode(65 + p.length)}`])}
            className={`flex items-center gap-1.5 text-xs font-medium mb-4 ${mutedCls}`}
          >
            <Plus size={13} /> Add team
          </button>
        )}
        <button onClick={startSim} className="text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-corporate-hero">
          Start simulation
        </button>
      </div>
    );
  }

  if (phase === 'debrief') {
    const ranked = [...teams].sort((a, b) => (b.metrics[config.primaryMetric] ?? 0) - (a.metrics[config.primaryMetric] ?? 0));
    const primaryLabel = config.metricLabels[config.primaryMetric];
    const chartData = teams[0]?.trajectory.map((_, roundI) => {
      const row: Record<string, number | string> = { round: roundI };
      teams.forEach((t) => { row[t.name] = t.trajectory[roundI]?.[config.primaryMetric] ?? 0; });
      return row;
    }) ?? [];

    return (
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={16} className="text-corporate-hero" />
          <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Comparative debrief</span>
        </div>

        <div className="space-y-2 mb-5">
          {ranked.map((t, i) => (
            <div key={t.name} className={`flex items-center justify-between rounded-xl p-3 ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold w-5 ${mutedCls}`}>#{i + 1}</span>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: TEAM_COLORS[teams.indexOf(t) % TEAM_COLORS.length] }} />
                <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{t.name}</span>
              </div>
              <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
                {fmt(t.metrics[config.primaryMetric] ?? 0, primaryLabel.format)}
              </span>
            </div>
          ))}
        </div>

        <div className={`text-xs font-semibold mb-2 ${mutedCls}`}>{primaryLabel.label} by round — every team</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#1f2937' : '#e5e7eb'} />
            <XAxis dataKey="round" stroke="#6b7280" fontSize={11} />
            <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => fmt(v, primaryLabel.format)} />
            <Tooltip formatter={(v: number) => fmt(v, primaryLabel.format)} contentStyle={{ backgroundColor: dark ? '#111827' : '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {teams.map((t, i) => (
              <Line key={t.name} dataKey={t.name} stroke={TEAM_COLORS[i % TEAM_COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>

        <div className="flex gap-2 justify-center mt-5">
          <button onClick={() => setPhase('setup')} className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-corporate-hero">
            <RotateCcw size={14} /> New simulation
          </button>
          <Link to={backHref} className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-xl ${dark ? 'bg-white/5 text-white' : 'bg-corporate-bg text-corporate-text-on-bg'}`}>
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </div>
    );
  }

  // phase === 'playing'
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-4">
          <span className={`text-xs font-semibold uppercase tracking-wide ${mutedCls}`}>Round {roundIndex + 1} of {config.rounds.length}</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: TEAM_COLORS[turnIndex % TEAM_COLORS.length] }} />
            <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{currentTeam?.name}'s turn</span>
          </div>
        </div>

        <p className={`text-base font-medium mb-5 leading-relaxed ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{round.prompt}</p>

        {!resolved ? (
          <div className="space-y-2">
            {round.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => chooseOption(opt)}
                className={`w-full text-left text-sm px-4 py-3 rounded-xl border transition-colors ${dark ? 'border-corporate-border-dark text-white/80 hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-corporate-bg'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className={`rounded-xl p-4 mb-4 ${dark ? 'bg-white/5' : 'bg-corporate-bg'}`}>
              <div className={`text-sm font-semibold mb-2 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>{resolved.label}</div>
              <div className="flex flex-wrap gap-3">
                {Object.entries(resolved.metricDeltas).map(([k, delta]) => (
                  <span key={k} className={`text-xs font-medium ${delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {config.metricLabels[k]?.label ?? k}: {delta >= 0 ? '+' : ''}{fmt(delta, config.metricLabels[k]?.format ?? 'number')}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={nextTurn} className="text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-corporate-hero">
              {turnIndex + 1 < teams.length ? `Pass to ${teams[turnIndex + 1].name}` : roundIndex + 1 < config.rounds.length ? 'Next round' : 'See debrief'}
            </button>
          </>
        )}
      </div>

      {/* Live scoreboard sidebar */}
      <div className={cardCls}>
        <div className={`text-xs font-semibold uppercase tracking-wide mb-3 ${mutedCls}`}>Live standings</div>
        <div className="space-y-2">
          {[...teams].sort((a, b) => (b.metrics[config.primaryMetric] ?? 0) - (a.metrics[config.primaryMetric] ?? 0)).map((t) => (
            <div key={t.name} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TEAM_COLORS[teams.indexOf(t) % TEAM_COLORS.length] }} />
                <span className={`truncate ${dark ? 'text-white/70' : 'text-gray-600'}`}>{t.name}</span>
              </span>
              <span className={`font-semibold shrink-0 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
                {fmt(t.metrics[config.primaryMetric] ?? 0, config.metricLabels[config.primaryMetric].format)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
