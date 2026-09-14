import { supabase } from '../integrations/supabase/client';
import type { BackupKind, Snapshot } from './backupSnapshot';

/**
 * cloudBackup — the optional second layer. Identity for the portal
 * itself stays with the Render backend; this only needs to know WHOSE
 * backup a row is, so the user confirms their email once with a sign-in
 * link and every row is then locked to that account by row-level
 * security. Free-tier friendly: one small row per data kind per user.
 */

export interface CloudRow {
  kind: string;
  item_count: number;
  updated_at: string;
  payload: unknown;
}

export async function getCloudEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.email ?? null;
}

export function onCloudAuthChange(cb: (email: string | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session?.user.email ?? null));
  return () => data.subscription.unsubscribe();
}

/** Sends a one-time sign-in link. Returns an error message or null. */
export async function sendBackupLink(email: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/` },
  });
  return error ? error.message : null;
}

export async function signOutCloud() {
  await supabase.auth.signOut();
}

export async function pushSnapshot(snapshot: Snapshot): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return 'Confirm your email first to use the cloud backup.';

  const rows = (Object.keys(snapshot.kinds) as BackupKind[]).map((kind) => ({
    user_id: user.id,
    kind,
    payload: snapshot.kinds[kind].payload as never,
    item_count: snapshot.kinds[kind].item_count,
    source_email: user.email ?? null,
  }));

  const { error } = await supabase.from('cloud_backups').upsert(rows, { onConflict: 'user_id,kind' });
  return error ? error.message : null;
}

export async function listCloudBackups(): Promise<CloudRow[]> {
  const { data, error } = await supabase
    .from('cloud_backups')
    .select('kind, item_count, updated_at, payload')
    .order('kind');
  if (error) return [];
  return (data ?? []) as CloudRow[];
}

export async function pullSnapshot(): Promise<Snapshot | null> {
  const rows = await listCloudBackups();
  if (rows.length === 0) return null;
  const kinds = {} as Snapshot['kinds'];
  let takenAt = rows[0].updated_at;
  for (const row of rows) {
    kinds[row.kind as BackupKind] = { payload: row.payload, item_count: row.item_count };
    if (row.updated_at > takenAt) takenAt = row.updated_at;
  }
  return { version: 2, taken_at: takenAt, kinds };
}
