import { apiFetch } from '../components/AccessExpiredGate';

/**
 * backupSnapshot — the data side of the two-layer safety net agreed in
 * Phase 1: a copy on this device (works with no extra sign-in, survives
 * a Render outage for reading) plus an optional copy in the built-in
 * Lovable database (see cloudBackup.ts).
 *
 * Priority order is the owner's own: learning progress, then notes and
 * reflections, then settings, then the trading journal. The journal
 * kind is declared but stays empty until the journal feature exists —
 * it must never invent entries.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const THEME_KEY = 'petrazim-theme';
export const CHART_KEY = 'petrazim-candle-colors';
const LOCAL_SNAPSHOT_KEY = 'petrazim-backup-snapshot';

export const SNAPSHOT_VERSION = 2;

export type BackupKind = 'progress' | 'notes' | 'settings' | 'journal';

export const BACKUP_KINDS: { kind: BackupKind; label: string; note: string }[] = [
  { kind: 'progress', label: 'Learning progress', note: 'Stage completion, mastery, stats and awards' },
  { kind: 'notes', label: 'Notes and reflections', note: 'Lesson notes, reflections and bookmarks' },
  { kind: 'settings', label: 'Settings', note: 'Theme, chart style and trading preferences' },
  { kind: 'journal', label: 'Trading journal', note: 'Empty until the journal feature ships' },
];

export interface Snapshot {
  version: number;
  taken_at: string;
  kinds: Record<BackupKind, { payload: unknown; item_count: number }>;
}

function readLocal(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function getJson(path: string, token: string): Promise<unknown> {
  try {
    const res = await apiFetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function count(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value as object).length;
  return value == null ? 0 : 1;
}

/**
 * Collects everything backupable. Anything the backend refuses or
 * cannot answer comes back as null rather than a fabricated value, so a
 * partial snapshot is honest about what it actually holds.
 */
export async function collectSnapshot(token: string | null): Promise<Snapshot> {
  const [stats, mastery, learningStats, awards, notebook, reflections, bookmarks, tradingSettings] = token
    ? await Promise.all([
        getJson('/curriculum/stats', token),
        getJson('/curriculum/mastery', token),
        getJson('/auth/learning-stats', token),
        getJson('/curriculum/awards', token),
        getJson('/curriculum/notebook', token),
        getJson('/curriculum/reflections', token),
        getJson('/curriculum/bookmarks', token),
        getJson('/manual-trading/settings', token),
      ])
    : [null, null, null, null, null, null, null, null];

  const progress = { stats, mastery, learning_stats: learningStats, awards };
  const notes = { notebook, reflections, bookmarks };
  const settings = {
    [THEME_KEY]: readLocal(THEME_KEY),
    [CHART_KEY]: readLocal(CHART_KEY),
    trading: tradingSettings,
  };

  return {
    version: SNAPSHOT_VERSION,
    taken_at: new Date().toISOString(),
    kinds: {
      progress: { payload: progress, item_count: count(mastery) + count(awards) },
      notes: { payload: notes, item_count: count(notebook) + count(reflections) + count(bookmarks) },
      settings: { payload: settings, item_count: count(settings) },
      journal: { payload: { entries: [] }, item_count: 0 },
    },
  };
}

export function saveLocalSnapshot(snapshot: Snapshot) {
  try {
    localStorage.setItem(LOCAL_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota — the cloud copy is the fallback */
  }
}

export function readLocalSnapshot(): Snapshot | null {
  const value = readLocal(LOCAL_SNAPSHOT_KEY);
  return value && typeof value === 'object' ? (value as Snapshot) : null;
}

/** Restores only what is genuinely local — preferences. Server-owned
 * records are never written back over the live account from here. */
export function restorePreferences(snapshot: Snapshot): boolean {
  const settings = snapshot.kinds?.settings?.payload as Record<string, unknown> | undefined;
  if (!settings) return false;
  if (settings[THEME_KEY]) localStorage.setItem(THEME_KEY, JSON.stringify(settings[THEME_KEY]));
  if (settings[CHART_KEY]) localStorage.setItem(CHART_KEY, JSON.stringify(settings[CHART_KEY]));
  return true;
}

export function downloadSnapshot(snapshot: Snapshot) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `petrazim-backup-${snapshot.taken_at.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
