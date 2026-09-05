import { useEffect, useRef, useState } from 'react';
import { HardDrive, MonitorSmartphone, AlertTriangle, Download, Upload, RotateCcw, X, Wifi, WifiOff } from 'lucide-react';
import { useInstallPromptStore } from '../hooks/useInstallPrompt';
import { DEFAULT_CANDLE_COLORS, DEFAULT_CHART_STYLE, CHART_STYLES } from '../hooks/useCandleColors';

const THEME_KEY = 'petrazim-theme';
const CHART_KEY = 'petrazim-candle-colors';
const BACKUP_VERSION = 1;

function readLocal(key: string): any {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * BackupOfflinePanel — the real thing behind Settings' "Backup and
 * Offline" row, adapted from the reference site's own panel
 * (screenshot supplied directly) to what THIS app can actually back
 * up honestly, by direct request ("adapt for portal").
 *
 * The reference's "Local Record" backs up gamified learning progress
 * (stages, XP, streak, badges) because that reference app keeps that
 * progress in the browser. Petrazim doesn't: mastery/XP/stage
 * completion already live on your account via the real /curriculum/*
 * endpoints (UserLearningStats, StageCompletion — see LearnPage's own
 * docstring), not localStorage. Presenting those numbers here as "the
 * local backup" would be the exact kind of fabricated-number problem
 * this app has consistently avoided elsewhere (TradeAnalytics,
 * RiskPage's Position Size Calculator, etc.) — so this section backs
 * up what's genuinely local instead: your chart color/style
 * (useCandleColorStore, key `petrazim-candle-colors`) and theme
 * (useThemeStore, key `petrazim-theme`) preferences, the only two
 * localStorage-persisted stores anywhere in this app (grepped).
 *
 * "Install & Offline" is real: main.tsx registers /sw.js in
 * production builds, which caches the app shell (pages, styles,
 * icons) so the portal keeps loading on a weak/no connection once
 * you've visited it online at least once — live data (trades,
 * Insights, Ask Coach) still needs the network, same distinction the
 * reference draws.
 *
 * "Reset Everything" only clears the same two local preference keys —
 * your account, trades, and learning progress are server-side and
 * entirely unaffected, unlike the reference's version which really
 * does erase local progress.
 */
export function BackupOfflinePanel({ onClose }: { onClose: () => void }) {
  const { event: installEvent, installed, setEvent } = useInstallPromptStore();
  const [online, setOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const themeValue = readLocal(THEME_KEY);
  const chartValue = readLocal(CHART_KEY);
  const storedBytes = (localStorage.getItem(THEME_KEY)?.length || 0) + (localStorage.getItem(CHART_KEY)?.length || 0);
  const chartStyleId = chartValue?.state?.chartStyle ?? DEFAULT_CHART_STYLE;
  const chartStyleLabel = CHART_STYLES.find((s) => s.id === chartStyleId)?.label ?? 'Candles';
  const themeLabel = themeValue?.state?.theme === 'dark' ? 'Dark' : 'Light';

  function exportBackup() {
    const payload = {
      version: BACKUP_VERSION,
      exported_at: new Date().toISOString(),
      [THEME_KEY]: themeValue,
      [CHART_KEY]: chartValue,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `petrazim-preferences-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data[THEME_KEY]) localStorage.setItem(THEME_KEY, JSON.stringify(data[THEME_KEY]));
        if (data[CHART_KEY]) localStorage.setItem(CHART_KEY, JSON.stringify(data[CHART_KEY]));
        setToast('Backup restored — reloading…');
        setTimeout(() => window.location.reload(), 800);
      } catch {
        setToast('That file could not be read as a Petrazim backup.');
      }
    };
    reader.readAsText(file);
  }

  function resetPreferences() {
    localStorage.removeItem(THEME_KEY);
    localStorage.removeItem(CHART_KEY);
    setToast('Local preferences reset — reloading…');
    setTimeout(() => window.location.reload(), 800);
  }

  async function promptInstall() {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    setEvent(null);
  }

  const cardCls = 'rounded-2xl border border-gray-100 bg-white p-5';
  const tileCls = 'bg-corporate-bg rounded-xl p-4';
  const sectionTitleCls = 'flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500 mb-4';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-corporate-bg rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white rounded-t-3xl sticky top-0">
          <span className="font-bold font-display text-corporate-text-on-bg">Backup and Offline</span>
          <button onClick={onClose} aria-label="Close"><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          {toast && (
            <div className="rounded-xl p-3 text-sm bg-blue-50 text-corporate-hero border border-blue-100">{toast}</div>
          )}

          <div className={cardCls}>
            <div className={sectionTitleCls}><HardDrive size={15} /> Local Record</div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={tileCls}>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Chart style</div>
                <div className="text-lg font-extrabold font-display text-corporate-text-on-bg mt-1">{chartStyleLabel}</div>
              </div>
              <div className={tileCls}>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Theme</div>
                <div className="text-lg font-extrabold font-display text-corporate-text-on-bg mt-1">{themeLabel}</div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Approximately {storedBytes} bytes stored locally on this device — your chart color/style and theme
              preferences only. Your account, trades, and learning progress are already saved to your account and
              don't need a backup.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={exportBackup}
                className="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-corporate-hero hover:opacity-90"
              >
                <Download size={15} /> Export backup
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-sm font-semibold text-corporate-text-on-bg px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-corporate-bg"
              >
                <Upload size={15} /> Import backup
              </button>
              <input
                ref={fileInputRef} type="file" accept="application/json" className="hidden"
                onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])}
              />
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Importing replaces these preferences on this device — export first if you want to keep what's here.
            </p>
          </div>

          <div className={cardCls}>
            <div className={sectionTitleCls}><MonitorSmartphone size={15} /> Install & Offline</div>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              Installed, the portal opens in its own window and the app shell (pages, styles, and icons) is cached
              — so Learn, Practice, and your dashboards keep loading on a weak connection. Live prices, trade data,
              Insights, and Ask Coach still need the network.
            </p>
            {!installed && !installEvent && (
              <p className="text-xs text-gray-400 mb-3">
                Use your browser's "Install app" or "Add to Home Screen" option — some browsers only offer it on
                the published site, not while developing locally.
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full ${online ? 'bg-blue-50 text-corporate-hero' : 'bg-amber-50 text-amber-600'}`}>
                {online ? <Wifi size={14} /> : <WifiOff size={14} />} {online ? 'Online' : 'Offline'}
              </span>
              {installed && (
                <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600">Installed</span>
              )}
              {!installed && installEvent && (
                <button
                  onClick={promptInstall}
                  className="text-sm font-semibold text-white px-4 py-2 rounded-xl bg-corporate-hero hover:opacity-90"
                >
                  Install app
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-600 mb-3">
              <AlertTriangle size={15} /> Reset Everything
            </div>
            <p className="text-sm text-red-700 leading-relaxed mb-3">
              Clears your chart color/style and theme preferences on this device and puts them back to the
              defaults ({CHART_STYLES.find((s) => s.id === DEFAULT_CHART_STYLE)?.label}, {DEFAULT_CANDLE_COLORS.upColor}/
              {DEFAULT_CANDLE_COLORS.downColor}). Your account, trades, and learning progress are not affected —
              those live on your account, not this device.
            </p>
            <button
              onClick={resetPreferences}
              className="flex items-center gap-2 text-sm font-semibold text-red-700 px-4 py-2.5 rounded-xl border border-red-200 bg-white hover:bg-red-100"
            >
              <RotateCcw size={15} /> Reset local preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
