import { useEffect, useState } from 'react';
import { CloudUpload, CloudDownload, Mail, Check, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  BACKUP_KINDS,
  collectSnapshot,
  downloadSnapshot,
  readLocalSnapshot,
  restorePreferences,
  saveLocalSnapshot,
  type Snapshot,
} from '../lib/backupSnapshot';
import {
  getCloudEmail,
  listCloudBackups,
  onCloudAuthChange,
  pullSnapshot,
  pushSnapshot,
  sendBackupLink,
  signOutCloud,
  type CloudRow,
} from '../lib/cloudBackup';

/**
 * CloudBackupCard — the two-layer safety net inside "Backup and
 * Offline": a copy on this device (no extra sign-in) and an optional
 * copy in the built-in Lovable database, unlocked by confirming an
 * email once. Deliberately shows real counts and real timestamps only.
 */
export function CloudBackupCard() {
  const { token } = useAuth();
  const [local, setLocal] = useState<Snapshot | null>(() => readLocalSnapshot());
  const [cloudEmail, setCloudEmail] = useState<string | null>(null);
  const [cloudRows, setCloudRows] = useState<CloudRow[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getCloudEmail().then(setCloudEmail);
    return onCloudAuthChange(setCloudEmail);
  }, []);

  useEffect(() => {
    if (cloudEmail) listCloudBackups().then(setCloudRows);
    else setCloudRows([]);
  }, [cloudEmail]);

  async function backupNow() {
    setBusy('backup');
    setMsg(null);
    try {
      const snapshot = await collectSnapshot(token);
      saveLocalSnapshot(snapshot);
      setLocal(snapshot);
      if (cloudEmail) {
        const error = await pushSnapshot(snapshot);
        if (error) {
          setMsg(`Saved on this device. Cloud copy failed: ${error}`);
          return;
        }
        setCloudRows(await listCloudBackups());
        setMsg('Backed up on this device and to your cloud copy.');
      } else {
        setMsg('Backed up on this device. Confirm an email below to add the cloud copy.');
      }
    } finally {
      setBusy(null);
    }
  }

  async function restoreFromCloud() {
    setBusy('restore');
    setMsg(null);
    try {
      const snapshot = await pullSnapshot();
      if (!snapshot) {
        setMsg('No cloud backup found yet.');
        return;
      }
      saveLocalSnapshot(snapshot);
      setLocal(snapshot);
      const ok = restorePreferences(snapshot);
      downloadSnapshot(snapshot);
      setMsg(
        ok
          ? 'Preferences restored from the cloud copy and the full backup downloaded — reloading…'
          : 'Cloud backup downloaded. It had no saved preferences to restore.',
      );
      if (ok) setTimeout(() => window.location.reload(), 1200);
    } finally {
      setBusy(null);
    }
  }

  async function sendLink() {
    if (!email.trim()) return;
    setBusy('link');
    setMsg(null);
    try {
      const error = await sendBackupLink(email.trim());
      setMsg(error ? `Could not send the link: ${error}` : `Sign-in link sent to ${email.trim()} — open it on this device.`);
    } finally {
      setBusy(null);
    }
  }

  const cloudFor = (kind: string) => cloudRows.find((r) => r.kind === kind);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">
        <CloudUpload size={15} /> Progress, Notes &amp; Settings Backup
      </div>

      {msg && <div className="rounded-xl p-3 text-sm bg-blue-50 text-corporate-hero border border-blue-100 mb-4">{msg}</div>}

      <div className="space-y-2 mb-4">
        {BACKUP_KINDS.map(({ kind, label, note }) => {
          const localCount = local?.kinds?.[kind]?.item_count;
          const cloud = cloudFor(kind);
          return (
            <div key={kind} className="bg-corporate-bg rounded-xl p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-corporate-text-on-bg">{label}</span>
                <span className="text-xs font-semibold text-gray-500">
                  {localCount == null ? 'not backed up yet' : `${localCount} item${localCount === 1 ? '' : 's'} on this device`}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {note}
                {cloud && ` · cloud copy ${new Date(cloud.updated_at).toLocaleString()}`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={backupNow}
          disabled={busy !== null || !token}
          className="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-corporate-hero hover:opacity-90 disabled:opacity-40"
        >
          {busy === 'backup' ? <Loader2 size={15} className="animate-spin" /> : <CloudUpload size={15} />} Back up now
        </button>
        <button
          onClick={restoreFromCloud}
          disabled={busy !== null || !cloudEmail}
          className="flex items-center gap-2 text-sm font-semibold text-corporate-text-on-bg px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-corporate-bg disabled:opacity-40"
        >
          {busy === 'restore' ? <Loader2 size={15} className="animate-spin" /> : <CloudDownload size={15} />} Restore from cloud
        </button>
        {local && (
          <button
            onClick={() => downloadSnapshot(local)}
            className="text-sm font-semibold text-corporate-text-on-bg px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-corporate-bg"
          >
            Download a copy
          </button>
        )}
      </div>

      {!token && (
        <p className="text-xs text-gray-400 mt-3">Sign in to the portal first — progress and notes are read from your account.</p>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100">
        {cloudEmail ? (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
              <Check size={14} /> Cloud backup on for {cloudEmail}
            </span>
            <button
              onClick={() => signOutCloud()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-corporate-text-on-bg"
            >
              <LogOut size={13} /> Turn off on this device
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 leading-relaxed mb-2">
              Add a free cloud copy: confirm your email once and your backup is kept privately against that address, so it
              survives losing this device.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none text-corporate-text-on-bg"
              />
              <button
                onClick={sendLink}
                disabled={busy !== null || !email.trim()}
                className="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl bg-corporate-hero disabled:opacity-40"
              >
                {busy === 'link' ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Send link
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
