import { useEffect, useState } from 'react';
import { Landmark, ExternalLink, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { congressTradesApi } from '../services/api';
import type { CongressTradesResponse, CongressTradeFiling, CongressTradeRow } from '../types';
import { useThemeStore } from '../hooks/useTheme';

function RowLine({ row, dark }: { row: CongressTradeRow; dark: boolean }) {
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const bullish = row.type === 'P';
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs rounded-lg px-2 py-1.5 ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
      <span className={`font-semibold ${bullish ? 'text-green-400' : 'text-red-400'}`}>{row.type_name}</span>
      <span className="font-medium">{row.asset}</span>
      {row.ticker && <span className={mutedCls}>({row.ticker})</span>}
      <span className={mutedCls}>· {row.amount}</span>
      {row.date && <span className={mutedCls}>· traded {row.date}</span>}
      {row.owner !== '' && <span className={mutedCls}>· {row.owner_name}</span>}
    </div>
  );
}

function FilingCard({ filing, dark }: { filing: CongressTradeFiling; dark: boolean }) {
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const cardCls = `rounded-2xl p-4 border ${dark ? 'bg-corporate-surface-dark border-corporate-border-dark' : 'bg-white border-corporate-bg'}`;
  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Landmark size={16} className={dark ? 'text-white/60' : 'text-corporate-hero'} />
          <span className="text-sm font-semibold">{filing.name}</span>
          <span className={`text-xs ${mutedCls}`}>{filing.district} · filed {filing.filed}</span>
        </div>
        {filing.url && (
          <a href={filing.url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-xs font-medium ${dark ? 'text-white/70' : 'text-corporate-hero'}`}>
            View PDF <ExternalLink size={12} />
          </a>
        )}
      </div>
      {filing.report ? (
        <div className="space-y-1.5">
          {filing.report.rows.map((row, i) => <RowLine key={i} row={row} dark={dark} />)}
          {filing.report.rows.length === 0 && <p className={`text-xs ${mutedCls}`}>No transaction rows could be parsed from this filing — view the PDF directly.</p>}
        </div>
      ) : (
        <p className={`text-xs ${mutedCls}`}>Could not parse this filing's transaction rows — view the PDF directly.</p>
      )}
    </div>
  );
}

/**
 * ExploreCongressTradesPage -- recent House STOCK Act Periodic Transaction
 * Reports (PTRs), by direct request ("Put all in the explore area"). Backed
 * by GET /congress-trades (backend/app/services/congress_trades.py), whose
 * index+PDF parsing logic is ported from the MIT-licensed trader-pelosi
 * skill (github.com/Jakeschincariol/day-trader-skill), reviewed and
 * adapted for this codebase's own async/FastAPI conventions.
 *
 * A PTR is a PUBLIC disclosure, filed 30-45 days after the trade, with
 * amounts given as ranges rather than exact prices -- not inside
 * information. The banner below says this verbatim rather than letting a
 * bare list of "Congress trade" rows imply otherwise.
 */
export function ExploreCongressTradesPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const [data, setData] = useState<CongressTradesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticker, setTicker] = useState('');
  const [member, setMember] = useState('');

  function load(params: { ticker?: string; member?: string } = {}) {
    setLoading(true);
    setError(null);
    congressTradesApi.recent({ ...params, limit: 20 })
      .then(setData)
      .catch((e) => setError(e?.response?.data?.detail || 'Could not load congressional trade filings right now.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const inputCls = `px-3 py-2 rounded-lg text-sm border ${dark ? 'bg-white/5 text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'}`;

  return (
    <div>
      <PageHeader
        title="Congressional Trades"
        subtitle="Recent House STOCK Act disclosures (Periodic Transaction Reports) — a public, delayed, range-only signal."
      />

      <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 mb-4 text-xs ${dark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          Members of the House must disclose a trade within 30 days of learning of it, and no later than 45 days
          after it happened — so this arrives days or weeks after the fact, and amounts are dollar RANGES, never
          exact prices. This is public information, read quickly; it is not inside information.
        </span>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); load({ ticker: ticker || undefined, member: member || undefined }); }}
        className="flex flex-wrap gap-2 mb-4"
      >
        <input
          value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Filter by ticker (e.g. NVDA)" className={inputCls}
        />
        <input
          value={member} onChange={(e) => setMember(e.target.value)}
          placeholder="Filter by member (e.g. Pelosi)" className={inputCls}
        />
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-corporate-hero">
          Search
        </button>
      </form>

      {loading && <p className={`text-sm ${mutedCls}`}>Fetching the House Clerk's disclosure index…</p>}
      {!loading && error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && data && (
        <>
          <p className={`text-xs mb-3 ${mutedCls}`}>{data.filings.length} filing{data.filings.length === 1 ? '' : 's'} · {data.year} index</p>
          <div className="space-y-3">
            {data.filings.map((f) => <FilingCard key={f.doc_id} filing={f} dark={dark} />)}
            {data.filings.length === 0 && <p className={`text-sm ${mutedCls}`}>No matching filings found.</p>}
          </div>
        </>
      )}
    </div>
  );
}
