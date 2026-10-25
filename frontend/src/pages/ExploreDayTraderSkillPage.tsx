import { Puzzle, ShieldCheck, Terminal, ExternalLink } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { FoldedCard } from '../components/FoldedCard';
import { useThemeStore } from '../hooks/useTheme';

const SKILLS = [
  ['trader-scanner', 'Scans thousands of charts for opening-range-breakout setups.'],
  ['trader-news', 'Headlines + SEC 8-K filings per symbol, materiality-flagged.'],
  ['trader-entry', 'Times an entry against a defined setup.'],
  ['trader-exit', 'Plans stop/target and a flat-by time for a day trade.'],
  ['trader-timemachine', 'Replays a strategy across thousands of historical sessions.'],
  ['trader-risk', 'Checks an order against daily-loss and position-size rules.'],
  ['trader-budget', 'Sizes a position from account risk and the stop distance.'],
  ['trader-broker', 'Places an approved order (paper by default, never without an explicit yes).'],
  ['trader-alerts', 'Price/time alerts for an open position.'],
  ['trader-analyst', 'Reads a company’s SEC filings for key metrics.'],
  ['trader-pelosi', 'Congressional STOCK Act trade disclosures — the same data source this portal’s own Congressional Trades page uses.'],
] as const;

/**
 * ExploreDayTraderSkillPage -- an honest pointer to the
 * Jakeschincariol/day-trader-skill Claude Code plugin, by direct request
 * ("you can also add the plug in directly as an Explore area feature").
 *
 * This is NOT a live web feature and can't be made one: the plugin is 11
 * Claude Code skills that run as chat-side Python scripts writing to local
 * files on whoever's running Claude, not a REST API Petrazim's frontend
 * could call. What CAN genuinely live here is an honest description of
 * what it does and how to install it -- plus the two pieces of it that
 * WERE ported into a real Petrazim feature (Congressional Trades, News
 * Monitor), called out explicitly so this doesn't read as a duplicate.
 *
 * Reviewed before linking it: the repo's actual Python was read end to
 * end (no eval/exec/os.system, every outbound call goes to a known public
 * financial data source, the order-execution skill requires three
 * independent gates -- a risk-rules PASS, an explicit recorded user "yes",
 * and a manual Claude permission-card approval -- before any order reaches
 * a broker, and it defaults to paper trading).
 */
export function ExploreDayTraderSkillPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const codeCls = `block rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto ${dark ? 'bg-black/40 text-white/80' : 'bg-gray-900 text-gray-100'}`;

  return (
    <div>
      <PageHeader
        title="Day Trader Skill Pack"
        subtitle="An 11-skill Claude Code plugin for day trading -- installed into Claude itself, not a page on this site."
      />

      <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 mb-4 text-xs ${dark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
        <Terminal size={14} className="mt-0.5 shrink-0" />
        <span>
          This runs inside Claude Code/Claude Desktop, not inside this web app -- it can't be embedded as a page
          here the way the rest of Explore is. Two of its data sources (congressional trade disclosures and
          per-symbol news) were ported into real Petrazim features instead, linked below, so you get them without
          leaving the portal.
        </span>
      </div>

      <div className="space-y-3">
        <FoldedCard
          title="Install" summary="Two commands, run inside Claude Code" icon={<Terminal size={18} />} dark={dark} defaultOpen
        >
          <p className={`text-xs mb-2 ${mutedCls}`}>Run these one at a time, in a Claude Code session:</p>
          <code className={codeCls}>/plugin marketplace add Jakeschincariol/day-trader-skill</code>
          <p className={`text-xs my-2 ${mutedCls}`}>Then, once that finishes:</p>
          <code className={codeCls}>/plugin install day-trader-skill@day-trader-skill</code>
          <a
            href="https://github.com/Jakeschincariol/day-trader-skill" target="_blank" rel="noreferrer"
            className={`inline-flex items-center gap-1 text-xs font-medium mt-2 ${dark ? 'text-white/70' : 'text-corporate-hero'}`}
          >
            View the source on GitHub <ExternalLink size={11} />
          </a>
        </FoldedCard>

        <FoldedCard
          title="Why it's safe to install" summary="What was actually checked before linking this" icon={<ShieldCheck size={18} />} dark={dark}
        >
          <ul className={`text-xs space-y-1.5 list-disc pl-4 ${mutedCls}`}>
            <li>Every Python file was read end to end -- no <code>eval</code>/<code>exec</code>/<code>os.system</code>, no unexplained <code>subprocess</code> calls.</li>
            <li>Every outbound network call goes to a known public financial data source (SEC, Yahoo Finance, stooq, Nasdaq/NYSE, the House disclosures clerk) -- nothing unexplained.</li>
            <li>The order-execution skill (<code>trader-broker</code>) never talks to a broker directly -- it requires a risk-rules PASS, your own explicit recorded "yes" for that one order, and a manual Allow-once on Claude's own permission card, every time. Paper trading by default; it never switches to live on its own.</li>
            <li>MIT licensed, 1,400+ stars, real tests with real data fixtures.</li>
          </ul>
        </FoldedCard>

        <FoldedCard
          title="What's in it" summary="All 11 skills" icon={<Puzzle size={18} />} dark={dark}
        >
          <div className="space-y-1.5">
            {SKILLS.map(([name, desc]) => (
              <div key={name} className={`text-xs rounded-lg px-2.5 py-1.5 ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
                <span className="font-semibold font-mono">{name}</span>
                <span className={mutedCls}> — {desc}</span>
              </div>
            ))}
          </div>
        </FoldedCard>
      </div>
    </div>
  );
}
