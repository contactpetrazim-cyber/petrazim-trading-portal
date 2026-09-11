import { useCallback, useEffect } from 'react';
import { create } from 'zustand';
import { useAuth, type UserRole } from './useAuth';
import { fetchJsonWithRetry, type FetchPhase } from '../lib/resilientFetch';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface AccessStatus {
  has_active_access: boolean;
  tier?: string | null;
  expires_at?: string | null;
  granted_via?: string | null;
}

interface EntitlementState {
  status: AccessStatus | null;
  phase: FetchPhase;
  inFlight: boolean;
  set: (patch: Partial<EntitlementState>) => void;
}

/**
 * Phase 3 entitlement layer — one shared answer to "does this account
 * currently have paid access?", read from the backend's own
 * GET /payments/access-status (the same source require_active_access
 * uses server-side) instead of each screen guessing.
 *
 * Deliberately cached in one store: the premium dashboard banner, the
 * route gate, and the checkout return page all ask the same question,
 * and on a sleeping free-tier backend three separate cold-start
 * requests is exactly the failure the retry ladder exists to avoid.
 *
 * This is UX and packaging only. The real paywall is server-side; a
 * gate here never grants anything the backend would refuse.
 */
const useEntitlementStore = create<EntitlementState>((set) => ({
  status: null,
  phase: 'idle',
  inFlight: false,
  set: (patch) => set(patch),
}));

/** Staff who must never be blocked by a trader-facing paywall. */
const BYPASS_ROLES: UserRole[] = ['partner', 'fund_manager', 'admin', 'super_admin'];

export function useEntitlement(options?: { auto?: boolean }) {
  const { token, user } = useAuth();
  const { status, phase, inFlight, set } = useEntitlementStore();
  const auto = options?.auto !== false;

  const refresh = useCallback(async () => {
    if (!token) return null;
    set({ inFlight: true });
    const data = await fetchJsonWithRetry<AccessStatus>(
      `${API_URL}/payments/access-status`,
      { headers: { Authorization: `Bearer ${token}` } },
      (p) => set({ phase: p }),
    );
    set({ inFlight: false, status: data ?? null });
    return data;
  }, [token, set]);

  useEffect(() => {
    if (auto && token && !status && !inFlight) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, token]);

  const expiresAt = status?.expires_at ? new Date(status.expires_at) : null;
  const msLeft = expiresAt ? expiresAt.getTime() - Date.now() : null;

  return {
    status,
    phase,
    loading: inFlight,
    refresh,
    hasAccess: !!status?.has_active_access,
    /** True until the backend has actually answered — callers fail open
     * rather than locking a paying user out of a page while a cold
     * start is still in flight. */
    unknown: !status,
    tier: status?.tier ?? null,
    expiresAt,
    hoursLeft: msLeft == null ? null : Math.max(0, Math.floor(msLeft / 3_600_000)),
    daysLeft: msLeft == null ? null : Math.max(0, Math.ceil(msLeft / 86_400_000)),
    isStaff: !!user && BYPASS_ROLES.includes(user.role),
  };
}
