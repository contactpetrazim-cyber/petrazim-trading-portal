import { Link } from 'react-router-dom';
import { ShieldCheck, Clock, Ticket } from 'lucide-react';
import { useEntitlement } from '../hooks/useEntitlement';

/**
 * One honest line about the account's paid access — active tier and
 * time remaining, or a direct route to buy it. Reads the same shared
 * entitlement answer the route gate uses, so the two can never
 * disagree.
 */
export function AccessStatusBanner({ dark }: { dark?: boolean }) {
  const { status, hasAccess, unknown, tier, expiresAt, daysLeft, hoursLeft, isStaff } = useEntitlement();

  if (unknown && !isStaff) return null;

  if (isStaff && !status?.has_active_access) {
    return (
      <div className={`rounded-2xl border p-4 ${dark ? 'bg-white/5 border-corporate-border-dark' : 'bg-white border-[#dcdce8]'}`}>
        <p className={`flex items-center gap-2 text-sm font-medium ${dark ? 'text-white/70' : 'text-gray-600'}`}>
          <ShieldCheck size={16} style={{ color: '#005FB8' }} /> Staff access — premium screens are open to you without a pass.
        </p>
      </div>
    );
  }

  if (hasAccess) {
    const expiringSoon = daysLeft != null && daysLeft <= 3;
    return (
      <div className={`rounded-2xl border p-4 ${
        expiringSoon
          ? dark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'
          : dark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`flex items-center gap-2 text-sm font-medium ${
            expiringSoon ? (dark ? 'text-amber-300' : 'text-amber-700') : (dark ? 'text-emerald-300' : 'text-emerald-700')
          }`}>
            {expiringSoon ? <Clock size={16} /> : <ShieldCheck size={16} />}
            {tier ? `${tier} access` : 'Access'} active
            {expiresAt && ` until ${expiresAt.toLocaleString()}`}
            {hoursLeft != null && hoursLeft < 48 && ` — ${hoursLeft}h left`}
          </p>
          {expiringSoon && (
            <Link to="/payments" className="text-sm font-semibold underline">Extend now</Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-4 ${dark ? 'bg-white/5 border-corporate-border-dark' : 'bg-white border-[#dcdce8]'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm font-medium ${dark ? 'text-white/70' : 'text-gray-600'}`}>
          No active access — live trading, premium analytics and tools are locked.
        </p>
        <Link to="/payments" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: '#005FB8' }}>
          <Ticket size={15} /> Get access
        </Link>
      </div>
    </div>
  );
}
