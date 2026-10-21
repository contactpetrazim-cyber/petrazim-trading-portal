import { useState } from 'react';
import { ArrowLeft, ArrowRight, ListChecks } from 'lucide-react';
import { BOT_RULES } from '../config/botRules';

/**
 * BotRulesSlide — the "N rules" slide summary (SMC Bot Academy plan
 * item 7): a structured, one-gate-per-step slide deck reusing this
 * app's own stepper convention (step dots + progress bar + Back/Next
 * — the same shape `LessonPage.tsx` already uses for its lesson
 * pages), listing a bot's REAL gating conditions in plain English, in
 * their real checked order, taken directly from the verified
 * `botRules.ts` config (itself sourced from each bot's own BOTx-05/06
 * "Invalidation" curriculum lesson).
 *
 * Deliberately presents the bot's REAL gate count — two for Bot 3,
 * eleven for Bot 4 — rather than padding or trimming to exactly 7.
 */
export function BotRulesSlide({ botId, dark = false }: { botId: string; dark?: boolean }) {
  const [index, setIndex] = useState(0);
  const ruleSet = BOT_RULES[botId];

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const textCls = dark ? 'text-white' : 'text-corporate-text-on-bg';
  const cardCls = `rounded-2xl p-6 border min-h-[220px] ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  const navBtnCls = `inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
    dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-corporate-bg text-corporate-hero hover:bg-corporate-hero/10'
  }`;

  if (!ruleSet) {
    return <p className={`text-sm ${mutedCls}`}>No real gate list found for bot "{botId}".</p>;
  }

  const { rules, botName, lessonRef } = ruleSet;
  const rule = rules[index];
  const isLast = index === rules.length - 1;

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-xs font-semibold flex items-center gap-1.5 ${dark ? 'text-white/70' : 'text-corporate-text-on-bg'}`}>
            <ListChecks size={14} /> {botName} — {rules.length} real gate{rules.length === 1 ? '' : 's'} ({lessonRef})
          </span>
          <span className={`text-xs ${mutedCls}`}>{index + 1} / {rules.length}</span>
        </div>
        <div className={`h-1.5 rounded-full overflow-hidden mb-2 ${dark ? 'bg-white/10' : 'bg-corporate-bg'}`}>
          <div className="h-full rounded-full bg-corporate-hero transition-all" style={{ width: `${((index + 1) / rules.length) * 100}%` }} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {rules.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-current={i === index ? 'step' : undefined}
              className={`w-7 h-7 shrink-0 rounded-lg text-[11px] font-bold flex items-center justify-center transition-colors ${
                i === index
                  ? 'bg-corporate-hero text-white'
                  : dark ? 'bg-white/5 text-white/40 hover:bg-white/10' : 'bg-corporate-bg text-gray-400 hover:bg-corporate-hero/10'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className={cardCls}>
        <div className={`text-[11px] font-bold uppercase tracking-wide mb-2 ${mutedCls}`}>Gate {index + 1}</div>
        <div className={`text-lg font-bold mb-2 ${textCls}`}>{rule.title}</div>
        <p className={`text-sm leading-relaxed ${dark ? 'text-white/80' : 'text-gray-700'}`}>{rule.detail}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className={navBtnCls}>
          <ArrowLeft size={15} /> Back
        </button>
        <button onClick={() => setIndex((i) => Math.min(rules.length - 1, i + 1))} disabled={isLast} className={navBtnCls}>
          Next <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
