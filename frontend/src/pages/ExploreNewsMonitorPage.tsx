import { useState, FormEvent } from 'react';
import { Newspaper, ExternalLink, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { newsMonitorApi } from '../services/api';
import type { NewsMonitorResponse, NewsMonitorItem } from '../types';
import { useThemeStore } from '../hooks/useTheme';

function NewsItemRow({ item, dark }: { item: NewsMonitorItem; dark: boolean }) {
  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  return (
    <a
      href={item.link || undefined} target="_blank" rel="noreferrer"
      className={`block rounded-xl px-3 py-2.5 border transition-colors ${
        item.important
          ? dark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'
          : dark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${mutedCls}`}>{item.source}{item.form ? ` · ${item.form}` : ''}</span>
        {item.important && <span className="text-[10px] font-semibold text-amber-500">Material</span>}
        {item.topics.map((t) => (
          <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded-full ${dark ? 'bg-white/10 text-white/60' : 'bg-white text-gray-500'}`}>{t}</span>
        ))}
      </div>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium">{item.title}</span>
        {item.link && <ExternalLink size={13} className={`mt-0.5 shrink-0 ${mutedCls}`} />}
      </div>
      {item.time && <span className={`text-[11px] ${mutedCls}`}>{new Date(item.time).toLocaleString()}</span>}
    </a>
  );
}

/**
 * ExploreNewsMonitorPage -- per-symbol headlines (Yahoo Finance RSS) + SEC
 * EDGAR 8-K filings, flagged for materiality, by direct request ("Put all
 * in the explore area"). Backed by GET /news-monitor/{symbol} (backend/app/
 * services/news_monitor.py), whose RSS/Atom parsing and 8-K item labels are
 * ported from the MIT-licensed trader-news skill
 * (github.com/Jakeschincariol/day-trader-skill), reviewed and adapted for
 * this codebase's own async/FastAPI conventions.
 */
export function ExploreNewsMonitorPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  const [symbol, setSymbol] = useState('');
  const [data, setData] = useState<NewsMonitorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function search(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = symbol.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    newsMonitorApi.forSymbol(trimmed)
      .then(setData)
      .catch((err) => setError(err?.response?.data?.detail || 'Could not load news for this symbol right now.'))
      .finally(() => setLoading(false));
  }

  const mutedCls = dark ? 'text-white/50' : 'text-gray-500';
  const inputCls = `flex-1 px-3 py-2 rounded-lg text-sm border ${dark ? 'bg-white/5 text-white border-white/10' : 'bg-white text-gray-800 border-gray-200'}`;

  return (
    <div>
      <PageHeader
        title="News Monitor"
        subtitle="Headlines and SEC 8-K filings for a symbol, with material items flagged."
      />

      <form onSubmit={search} className="flex gap-2 mb-4">
        <input
          value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Enter a ticker, e.g. TSLA" className={inputCls}
        />
        <button type="submit" disabled={!symbol.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-corporate-hero disabled:opacity-40">
          Search
        </button>
      </form>

      {!data && !loading && !error && (
        <p className={`text-sm ${mutedCls}`}>Headlines are leads, not facts — open the story before acting on it, and treat nothing here as advice.</p>
      )}

      {loading && <p className={`text-sm ${mutedCls}`}>Fetching headlines and filings…</p>}
      {!loading && error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && data && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Newspaper size={16} className={dark ? 'text-white/60' : 'text-corporate-hero'} />
            <span className="text-sm font-semibold">{data.symbol}</span>
            <span className={`text-xs ${mutedCls}`}>{data.items.length} item{data.items.length === 1 ? '' : 's'}</span>
          </div>

          {data.errors.length > 0 && (
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2 mb-3 text-xs ${dark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{data.errors.join(' · ')}</span>
            </div>
          )}

          <div className="space-y-2">
            {data.items.map((item) => <NewsItemRow key={item.id} item={item} dark={dark} />)}
            {data.items.length === 0 && <p className={`text-sm ${mutedCls}`}>No recent headlines or filings found for {data.symbol}.</p>}
          </div>
        </>
      )}
    </div>
  );
}
