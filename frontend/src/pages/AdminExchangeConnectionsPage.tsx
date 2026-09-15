import { useEffect, useState } from 'react';
import { Link2, Ban, Trash2, CheckCircle2, XCircle, Clock, Globe, RefreshCw } from 'lucide-react';
import { FoldedCard } from '../components/FoldedCard';
import { adminExchangeConnectionsApi } from '../services/api';
import { TraderBrokerConnection } from '../types';
import { useThemeStore } from '../hooks/useTheme';

/**
 * AdminExchangeConnectionsPage — platform-wide management of every
 * trader's connected exchange account, by direct request ("Put the
 * onboarding controls and management in the admin portal - the
 * connection of the portal to their exchanges"). Mounted at
 * /admin/exchange-connections; ConnectExchangePage.tsx is the trader-
 * facing self-service half of the same feature — an admin never enters
 * or edits a trader's own credentials here, only sees a masked preview
 * and can suspend/remove a connection.
 */
export function AdminExchangeConnectionsPage() {
  const { portalThemes } = useThemeStore();
  const dark = portalThemes.admin === 'dark';

  const [connections, setConnections] = useState<TraderBrokerConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [outboundVm, setOutboundVm] = useState('');
  const [outboundFixie, setOutboundFixie] = useState('');
  const [vmSource, setVmSource] = useState<'manual' | 'auto' | ''>('');
  const [fixieSource, setFixieSource] = useState<'manual' | 'auto' | ''>('');
  const [vmDraft, setVmDraft] = useState('');
  const [fixieDraft, setFixieDraft] = useState('');
  const [ipBusy, setIpBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [conns, ips] = await Promise.all([
        adminExchangeConnectionsApi.list(),
        adminExchangeConnectionsApi.getOutboundIps(),
      ]);
      setConnections(conns);
      setOutboundVm(ips.outbound_ip_vm);
      setOutboundFixie(ips.outbound_ip_fixie);
      setVmSource(ips.vm_source);
      setFixieSource(ips.fixie_source);
      setVmDraft(ips.outbound_ip_vm);
      setFixieDraft(ips.outbound_ip_fixie);
    } catch {
      setError('Could not load exchange connections.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function refreshIps() {
    setIpBusy(true);
    try {
      const result = await adminExchangeConnectionsApi.refreshOutboundIps();
      setOutboundVm(result.outbound_ip_vm);
      setOutboundFixie(result.outbound_ip_fixie);
      setVmSource(result.vm_source);
      setFixieSource(result.fixie_source);
      setVmDraft(result.outbound_ip_vm);
      setFixieDraft(result.outbound_ip_fixie);
    } finally {
      setIpBusy(false);
    }
  }

  async function saveIpOverrides() {
    setIpBusy(true);
    try {
      const result = await adminExchangeConnectionsApi.setOutboundIps({ outbound_ip_vm: vmDraft, outbound_ip_fixie: fixieDraft });
      setOutboundVm(result.outbound_ip_vm);
      setOutboundFixie(result.outbound_ip_fixie);
      setVmSource(result.vm_source);
      setFixieSource(result.fixie_source);
    } finally {
      setIpBusy(false);
    }
  }

  async function suspend(c: TraderBrokerConnection) {
    setBusyId(c.id);
    try {
      await adminExchangeConnectionsApi.suspend(c.id, c.status !== 'suspended');
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: TraderBrokerConnection) {
    if (!confirm(`Permanently remove ${c.trader_email || 'this trader'}'s ${c.exchange} connection?`)) return;
    setBusyId(c.id);
    try {
      await adminExchangeConnectionsApi.remove(c.id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const STATUS_STYLE: Record<string, { icon: JSX.Element; cls: string; label: string }> = {
    verified: { icon: <CheckCircle2 size={13} />, cls: 'bg-emerald-100 text-emerald-700', label: 'Verified' },
    pending: { icon: <Clock size={13} />, cls: 'bg-amber-100 text-amber-700', label: 'Not tested' },
    failed: { icon: <XCircle size={13} />, cls: 'bg-red-100 text-red-700', label: 'Failed' },
    suspended: { icon: <Ban size={13} />, cls: 'bg-gray-200 text-gray-600', label: 'Suspended' },
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
          <Link2 size={20} /> Trader Exchange Connections
        </h1>
        <p className={`text-sm mt-1 ${dark ? 'text-white/60' : 'text-gray-500'}`}>
          Every trader's own connected exchange account, platform-wide. Keys are stored encrypted — only a masked preview is ever shown here.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

      <FoldedCard
        title="Outbound IPs"
        summary={`VM: ${outboundVm || '—'} · Fixie: ${outboundFixie || '—'}`}
        icon={<Globe size={18} />} dark={dark} defaultOpen
      >
        <div className="space-y-3 py-2">
          <p className={`text-xs ${dark ? 'text-white/60' : 'text-gray-500'}`}>
            What every trader's "Connect Your Exchange" page tells them to whitelist — TWO separate IPs, since this platform
            automatically fails over between them: the VM (primary — exchange traffic is proxied through it) and Fixie
            (backup, used only if the VM's proxy is unreachable). A background engine auto-detects both every 6 hours and
            keeps them in sync across both backends — no redeploy needed. Typing a value below and saving overrides the
            auto-detected one for that field immediately; clear it to go back to auto-detection.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={`text-xs font-semibold ${dark ? 'text-white/60' : 'text-gray-500'}`}>
                VM (primary) {vmSource && <span className="opacity-60 font-normal">— {vmSource}</span>}
              </label>
              <input
                value={vmDraft} onChange={(e) => setVmDraft(e.target.value)} placeholder="e.g. 51.x.x.x"
                className={`w-full mt-1 border rounded-lg px-2.5 py-1.5 text-sm font-mono ${dark ? 'bg-smc-dark border-smc-border text-white' : 'bg-white border-corporate-bg text-corporate-text-on-bg'}`}
              />
            </div>
            <div>
              <label className={`text-xs font-semibold ${dark ? 'text-white/60' : 'text-gray-500'}`}>
                Fixie (backup) {fixieSource && <span className="opacity-60 font-normal">— {fixieSource}</span>}
              </label>
              <input
                value={fixieDraft} onChange={(e) => setFixieDraft(e.target.value)} placeholder="e.g. 52.x.x.x, 54.x.x.x"
                className={`w-full mt-1 border rounded-lg px-2.5 py-1.5 text-sm font-mono ${dark ? 'bg-smc-dark border-smc-border text-white' : 'bg-white border-corporate-bg text-corporate-text-on-bg'}`}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={saveIpOverrides} disabled={ipBusy} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-50">
              Save overrides
            </button>
            <button onClick={refreshIps} disabled={ipBusy} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border disabled:opacity-50">
              <RefreshCw size={12} className={ipBusy ? 'animate-spin' : ''} /> Detect now
            </button>
          </div>
        </div>
      </FoldedCard>

      <FoldedCard title="All Connections" summary={loading ? 'Loading…' : `${connections.length} connection${connections.length === 1 ? '' : 's'}`} icon={<Link2 size={19} />} dark={dark} defaultOpen>
        {loading ? (
          <p className="text-sm opacity-60 py-2">Loading…</p>
        ) : connections.length === 0 ? (
          <p className="text-sm opacity-60 py-2">No trader has connected an exchange yet.</p>
        ) : (
          <div className="overflow-x-auto py-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left opacity-60 text-xs">
                  <th className="pb-2 pr-3">Trader</th>
                  <th className="pb-2 pr-3">Exchange</th>
                  <th className="pb-2 pr-3">Key</th>
                  <th className="pb-2 pr-3">Mode</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Connected</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((c) => {
                  const st = STATUS_STYLE[c.status] || STATUS_STYLE.pending;
                  return (
                    <tr key={c.id} className="border-t border-black/10 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{c.trader_name || '—'}</div>
                        <div className="text-xs opacity-60">{c.trader_email}</div>
                      </td>
                      <td className="py-2 pr-3">{c.exchange}{c.label && <div className="text-xs opacity-60">{c.label}</div>}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{c.api_key_preview}</td>
                      <td className="py-2 pr-3">{c.mode}{!c.is_active && <div className="text-xs text-amber-600">disabled</div>}</td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${st.cls}`}>{st.icon}{st.label}</span>
                        {c.last_error && <div className="text-[11px] text-red-600 mt-1 max-w-[220px]">{c.last_error}</div>}
                      </td>
                      <td className="py-2 pr-3 text-xs opacity-70">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button onClick={() => suspend(c)} disabled={busyId === c.id} className="text-xs font-semibold px-2 py-1 rounded-lg border disabled:opacity-50">
                            {c.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
                          </button>
                          <button onClick={() => remove(c)} disabled={busyId === c.id} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg text-red-600 border border-red-200 disabled:opacity-50">
                            <Trash2 size={12} /> Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </FoldedCard>
    </div>
  );
}
