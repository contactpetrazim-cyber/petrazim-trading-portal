/**
 * Portal Tiers — what each console ADDS over the one below it
 * ================================================================
 *
 * Backs EverythingIncludedPanel.tsx, adapted from the reference
 * training portal's own "Everything included at this level" panel.
 * This app's real hierarchy (see docs/portal-hierarchy-superset and
 * roster.py/admin.py's own role checks) is Trader -> Partner ->
 * Fund Manager -> Admin/Super Admin, each a strict superset of the one
 * before it — not the reference's own Trainee/Trainer/Manager/Admin
 * naming, which doesn't map onto real role names here.
 *
 * The base Trader tier reads its own tool list live from
 * FEATURE_REGISTRY (config/featureRegistry.ts) rather than duplicating
 * it here — every other tier below is deliberately short and static:
 * it's exactly the small, real set of components each console adds
 * (RosterPanel, TraderOversightPanel, ...), which doesn't change often
 * enough to need its own registry the way the much larger Trader nav
 * does.
 */

import {
  Users, KeyRound, CalendarClock, LineChart, ShieldCheck,
  Building2, UserCog, ToggleLeft, Landmark,
} from 'lucide-react';

export interface TierTool {
  icon: typeof Users;
  title: string;
  description: string;
}

export const PARTNER_TOOLS: TierTool[] = [
  { icon: Users, title: 'Roster & Cohort Assignment', description: 'Invite, assign, and detach the Traders sponsored under you' },
  { icon: KeyRound, title: 'Access Codes & Seats', description: 'Issue corporate seats, hold/resume any code you issued' },
  { icon: CalendarClock, title: 'Facilitator Sessions', description: 'See the next seven days booked and set each session\'s topic' },
  { icon: LineChart, title: 'Learning Dashboard', description: 'Roster progress, furthest-along ranking, community joins' },
];

export const FUND_MANAGER_TOOLS: TierTool[] = [
  { icon: ShieldCheck, title: 'Trader Risk Oversight', description: 'View and edit any roster Trader\'s real bot risk settings' },
];

export const ADMIN_TOOLS: TierTool[] = [
  { icon: Building2, title: 'Platform Overview', description: 'Organisations, staff accounts, daily sends, live bookings' },
  { icon: UserCog, title: 'Role Administration', description: 'Promote or demote any account by email (Super Admin)' },
  { icon: Landmark, title: 'Full User Directory', description: 'Every account on the platform, not just your own roster' },
  { icon: ToggleLeft, title: 'Payments Mode & Trading Master Control', description: 'Platform-wide Test/Live and Paper-Trading kill-switch (Super Admin)' },
];
