import { useEffect, useState } from 'react';
import { Percent, CheckCircle2, Ban, Wallet } from 'lucide-react';
import { FoldedCard } from '../components/FoldedCard';
import { adminFeesApi } from '../services/api';
import { FeeSettings, FeeLedgerEntry } from '../types';
import { useThemeStore } from '../hooks/useTheme';

/**
 * AdminFeeSettingsPage — the Fee/Free toggle, percentage, and payout
 * destination for subscriber copy-trades, by direct request
 * ("introduce a fee base or a share of the profit - on a success
 * basis... Create a fee vs free toggle... include in Admin portal...
 * form for Admin to enter Account to receive the benefit... Crypto
 * address and/or bank account - Paystack?"). Mounted at
 * /admin/fees.
 *
 * Honest scope (see backend/app/models/fee_settings.py's own
 * docstring): this computes and RECORDS what a trader owes on a
 * profitable copy-trade close — it never moves money. "Mark Paid"
 * below is the admin's own record that a real transfer (a crypto send
 * the trader made, or a bank/Paystack transfer the admin confirmed)
 * happened OUTSIDE this app; there's no live payment integration here.
 */
export function AdminFeeSettingsPage() {
  const { portalThemes } = useThemeStore();
  const dark = portalThemes.admin === 'dark';

  const [settings, setSettings] = useState<FeeSettings | null>(null);
  const [draft, setDraft] = useState<Partial<FeeSettings>>({});
  const [ledger, setLedger] = useState<FeeLedgerEntry[]>([]);
  const [ledgerFilter, setLedgerFilter] = useState<'owed' | 'paid' | 'waived' | undefined>('owed');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, l] = await Promise.all([adminFeesApi.getSettings(), adminFeesApi.listLedger(ledgerFilter)]);
      setSettings(s);
      setDraft(s);
      setLedger(l);
    } catch {
      setError('Could not load fee settings.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [ledgerFilter]);

  async function save() {
    setSaving(true);
    try {
      const s = await adminFeesApi.updateSettings({
        enabled: draft.enabled, fee_percent: draft.fee_percent, payout_method: draft.payout_method,
        crypto_address: draft.crypto_address ?? undefined, crypto_network: draft.crypto_network ?? undefined,
        paystack_account_name: draft.paystack_account_name ?? undefined, paystack_account_number: draft.paystack_account_number ?? undefined,
        paystack_bank_name: draft.paystack_bank_name ?? undefined, paystack_bank_code: draft.paystack_bank_code ?? undefined,
        notes: draft.notes ?? undefined,
      });
      setSettings(s);
      setDraft(s);
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(entry: FeeLedgerEntry) {
    const note = window.prompt('Optional note (e.g. tx hash or bank reference):') || undefined;
    setBusyId(entry.id);
    try {
      await adminFeesApi.markPaid(entry.id, note);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function waive(entry: FeeLedgerEntry) {
    if (!confirm(`Waive the $${entry.fee_amount.toFixed(2)} fee on trade ${entry.trade_id}?`)) return;
    setBusyId(entry.id);
    try {
      await adminFeesApi.waive(entry.id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const inputCls = `w-full mt-1 border rounded-lg px-2.5 py-1.5 text-sm ${dark ? 'bg-smc-dark border-smc-border text-white' : 'bg-white border-corporate-bg text-corporate-text-on-bg'}`;
  const totalOwed = ledger.filter((e) => e.status === 'owed').reduce((sum, e) => sum + e.fee_amount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
          <Percent size={20} /> Performance Fees
        </h1>
        <p className={`text-sm mt-1 ${dark ? 'text-white/60' : 'text-gray-500'}`}>
          A share of the PROFIT on a subscriber's bot-copied trades only — never on a manual trade, never on a loss.
          This calculates and records what's owed; it doesn't collect payment automatically.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

      <FoldedCard title="Fee Settings" summary={loading ? 'Loading…' : (settings?.enabled ? `On — ${settings.fee_percent}%` : 'Off — free')} icon={<Percent size={18} />} dark={dark} defaultOpen>
        {loading ? <p className="text-sm opacity-60 py-2">Loading…</p> : (
          <div className="space-y-3 py-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={!!draft.enabled} onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))} />
              Charge a performance fee on profitable copy-trades
            </label>

            <div>
              <label className="text-xs font-semibold opacity-70">Fee percent of profit</label>
              <input type="number" min={0} max={100} step={0.5} className={inputCls}
                value={draft.fee_percent ?? 0} onChange={(e) => setDraft((d) => ({ ...d, fee_percent: parseFloat(e.target.value) || 0 }))} />
            </div>

            <div>
              <label className="text-xs font-semibold opacity-70">Payout method</label>
              <select className={inputCls} value={draft.payout_method || 'crypto'} onChange={(e) => setDraft((d) => ({ ...d, payout_method: e.target.value as any }))}>
                <option value="crypto">Crypto address only</option>
                <option value="paystack">Bank account (Paystack) only</option>
                <option value="both">Both</option>
              </select>
            </div>

            {(draft.payout_method === 'crypto' || draft.payout_method === 'both') && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold opacity-70">Crypto address</label>
                  <input className={inputCls} value={draft.crypto_address || ''} onChange={(e) => setDraft((d) => ({ ...d, crypto_address: e.target.value }))} placeholder="0x… / T… / bc1…" />
                </div>
                <div>
                  <label className="text-xs font-semibold opacity-70">Network</label>
                  <input className={inputCls} value={draft.crypto_network || ''} onChange={(e) => setDraft((d) => ({ ...d, crypto_network: e.target.value }))} placeholder="e.g. USDT (TRC20)" />
                </div>
              </div>
            )}

            {(draft.payout_method === 'paystack' || draft.payout_method === 'both') && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold opacity-70">Account name</label>
                  <input className={inputCls} value={draft.paystack_account_name || ''} onChange={(e) => setDraft((d) => ({ ...d, paystack_account_name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold opacity-70">Account number</label>
                  <input className={inputCls} value={draft.paystack_account_number || ''} onChange={(e) => setDraft((d) => ({ ...d, paystack_account_number: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold opacity-70">Bank name</label>
                  <input className={inputCls} value={draft.paystack_bank_name || ''} onChange={(e) => setDraft((d) => ({ ...d, paystack_bank_name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold opacity-70">Bank code</label>
                  <input className={inputCls} value={draft.paystack_bank_code || ''} onChange={(e) => setDraft((d) => ({ ...d, paystack_bank_code: e.target.value }))} placeholder="Paystack bank code" />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold opacity-70">Notes (shown to admins only)</label>
              <textarea className={inputCls} rows={2} value={draft.notes || ''} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
            </div>

            <button onClick={save} disabled={saving} className="text-sm font-semibold px-3 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50">
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        )}
      </FoldedCard>

      <FoldedCard title="Fee Ledger" summary={`$${totalOwed.toFixed(2)} currently owed`} icon={<Wallet size={18} />} dark={dark} defaultOpen>
        <div className="flex gap-2 py-2">
          {(['owed', 'paid', 'waived', undefined] as const).map((s) => (
            <button key={s ?? 'all'} onClick={() => setLedgerFilter(s)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ledgerFilter === s ? 'bg-gray-900 text-white' : 'bg-black/5'}`}>
              {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>
        {loading ? <p className="text-sm opacity-60 py-2">Loading…</p> : ledger.length === 0 ? (
          <p className="text-sm opacity-60 py-2">No fee entries for this filter.</p>
        ) : (
          <div className="overflow-x-auto py-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left opacity-60 text-xs">
                  <th className="pb-2 pr-3">Trader</th>
                  <th className="pb-2 pr-3">Trade</th>
                  <th className="pb-2 pr-3">Profit</th>
                  <th className="pb-2 pr-3">Fee</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e) => (
                  <tr key={e.id} className="border-t border-black/10 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{e.trader_name || '—'}</div>
                      <div className="text-xs opacity-60">{e.trader_email}</div>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{e.trade_id}</td>
                    <td className="py-2 pr-3">${e.pnl_amount.toFixed(2)}</td>
                    <td className="py-2 pr-3 font-semibold">${e.fee_amount.toFixed(2)} <span className="opacity-50 font-normal">({e.fee_percent_applied}%)</span></td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${
                        e.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : e.status === 'waived' ? 'bg-gray-200 text-gray-600' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {e.status === 'paid' && <CheckCircle2 size={12} />}
                        {e.status === 'waived' && <Ban size={12} />}
                        {e.status[0].toUpperCase() + e.status.slice(1)}
                      </span>
                      {e.paid_note && <div className="text-[11px] opacity-60 mt-1 max-w-[180px]">{e.paid_note}</div>}
                    </td>
                    <td className="py-2 pr-3 text-xs opacity-70">{new Date(e.created_at).toLocaleDateString()}</td>
                    <td className="py-2">
                      {e.status === 'owed' && (
                        <div className="flex gap-2">
                          <button onClick={() => markPaid(e)} disabled={busyId === e.id} className="text-xs font-semibold px-2 py-1 rounded-lg bg-emerald-600 text-white disabled:opacity-50">
                            Mark Paid
                          </button>
                          <button onClick={() => waive(e)} disabled={busyId === e.id} className="text-xs font-semibold px-2 py-1 rounded-lg border disabled:opacity-50">
                            Waive
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FoldedCard>
    </div>
  );
}
