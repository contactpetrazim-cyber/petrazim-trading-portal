import { useEffect, useState } from 'react';
import { Link2, Plus, RefreshCw, Trash2, CheckCircle2, XCircle, Clock, Ban, Bot, Percent, CreditCard, Coins } from 'lucide-react';
import { FoldedCard } from '../components/FoldedCard';
import { exchangeConnectionsApi, feesApi } from '../services/api';
import { ExchangeInfo, TraderBrokerConnection, AvailableBot, TraderBotSubscription, MyFeesResponse, FeeCheckoutProvider } from '../types';
import { useThemeStore } from '../hooks/useTheme';
import { rememberPendingFeeCheckout, readPendingFeeCheckout, clearPendingFeeCheckout } from '../lib/pendingFeeCheckout';

/**
 * ConnectExchangePage — "Connect Your Exchange", the trader-facing
 * half of the exchange-onboarding system. By direct request: "guess
 * they can give us an API for the selected account....we give them
 * our IP to add to their exchange ... create an onboarding page or
 * system ... trade manually and using our bots on their accounts in
 * select exchanges ... How do we invite them? How do we set them up to
 * use our portal to trade either manually or using our bot."
 *
 * How a trader gets here: an existing account (Manager+ invites a new
 * Trader via /roster's own, already-built invite flow — unchanged by
 * this page) is all that's needed; connecting an exchange is
 * something any already-onboarded trader does themselves, self-
 * service, from here. No separate "invite to connect" step exists.
 *
 * What connecting actually does: the trader's key/secret is stored
 * encrypted (never shown back in full — only a masked preview) and,
 * once genuinely tested (POST .../test — a real signed balance/ticker
 * call, not just "the form was submitted"), execution_engine.py routes
 * their own manual orders (and any bot they subscribe to below) to
 * THIS connection's exchange instead of the platform's own pooled
 * account — see that file's own _get_broker_client docstring for the
 * exact routing priority.
 *
 * A subscribed bot's signal now genuinely fans out to this connection
 * (see execution_engine.py's own _fan_out_to_subscribers) — the AUTO /
 * MANUAL badge on each subscribed bot below is the "Auto Vs Manual -
 * on Vs off toggle to operate" a trader gets per subscription: AUTO
 * executes a fresh signal immediately with no approval step; MANUAL
 * (the default) drafts it as a pending trade on your own account that
 * you approve yourself, the same way a human-in-the-loop platform bot
 * signal already works.
 */
export function ConnectExchangePage() {
  const { portalThemes } = useThemeStore();
  const dark = portalThemes.trader === 'dark';

  const [exchanges, setExchanges] = useState<ExchangeInfo[]>([]);
  const [outboundIpVm, setOutboundIpVm] = useState('');
  const [outboundIpFixie, setOutboundIpFixie] = useState('');
  const [connections, setConnections] = useState<TraderBrokerConnection[]>([]);
  const [bots, setBots] = useState<AvailableBot[]>([]);
  const [subscriptions, setSubscriptions] = useState<TraderBotSubscription[]>([]);
  const [fees, setFees] = useState<MyFeesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState<FeeCheckoutProvider | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(readPendingFeeCheckout());

  const [showForm, setShowForm] = useState(false);
  const [formExchange, setFormExchange] = useState('');
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [formLabel, setFormLabel] = useState('');
  const [formMode, setFormMode] = useState<'manual' | 'bot' | 'both'>('manual');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [meta, conns, availableBots, subs, myFees] = await Promise.all([
        exchangeConnectionsApi.listExchanges(),
        exchangeConnectionsApi.list(),
        exchangeConnectionsApi.availableBots(),
        exchangeConnectionsApi.mySubscriptions(),
        feesApi.myLedger(),
      ]);
      setExchanges(meta.exchanges);
      setOutboundIpVm(meta.outbound_ip_vm);
      setOutboundIpFixie(meta.outbound_ip_fixie);
      setConnections(conns);
      setBots(availableBots);
      setSubscriptions(subs);
      setFees(myFees);
    } catch {
      setError('Could not load your exchange connections.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const selectedMeta = exchanges.find((e) => e.exchange === formExchange);

  async function submitConnect() {
    if (!formExchange || !formFields.api_key) {
      setFormError('Pick an exchange and enter at least the API key.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await exchangeConnectionsApi.connect({
        exchange: formExchange,
        api_key: formFields.api_key,
        api_secret: formFields.api_secret,
        account_id: formFields.account_id,
        label: formLabel || undefined,
        mode: formMode,
      });
      setShowForm(false);
      setFormExchange(''); setFormFields({}); setFormLabel(''); setFormMode('manual');
      await load();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || 'Could not save this connection — check your entries and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function testConn(id: string) {
    setBusyId(id);
    try {
      await exchangeConnectionsApi.test(id);
    } finally {
      setBusyId(null);
      await load();
    }
  }

  async function removeConn(id: string) {
    if (!confirm('Remove this exchange connection? Any bot subscriptions using it will stop working.')) return;
    setBusyId(id);
    try {
      await exchangeConnectionsApi.remove(id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(c: TraderBrokerConnection) {
    setBusyId(c.id);
    try {
      await exchangeConnectionsApi.update(c.id, { is_active: !c.is_active });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function subscribe(connectionId: string, botId: string) {
    setBusyId(connectionId + botId);
    try {
      await exchangeConnectionsApi.subscribeBot(connectionId, botId);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function toggleCopyMode(sub: TraderBotSubscription) {
    setBusyId(sub.id);
    try {
      await exchangeConnectionsApi.updateSubscription(sub.id, { copy_mode: sub.copy_mode === 'auto' ? 'manual' : 'auto' });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function unsubscribe(subscriptionId: string) {
    setBusyId(subscriptionId);
    try {
      await exchangeConnectionsApi.unsubscribeBot(subscriptionId);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  // The fee-settlement gate's own checkout — pays off the FULL owed
  // balance in one go (see routers/fees.py's own start_fee_checkout
  // docstring for why it's the full balance, not just the
  // previous-day amount the gate itself blocks on). Paystack or
  // IvoryPay (crypto) — the trader's choice, by direct request ("ADD
  // Ivorypay as the option for crypto payments").
  async function payFees(provider: FeeCheckoutProvider) {
    setPayBusy(provider);
    setPayError(null);
    try {
      const session = await feesApi.checkout(provider);
      rememberPendingFeeCheckout(session.reference, session.provider);
      window.location.href = session.checkout_url;
    } catch (err: any) {
      setPayError(err?.response?.data?.detail || 'Could not start checkout — try again in a moment.');
      setPayBusy(null);
    }
  }

  // Re-checks a still-pending checkout against the real gateway — the
  // only confirmation IvoryPay actually has here (no webhook — see
  // routers/fees.py's own verify_fee_checkout docstring), and a useful
  // backup for Paystack too.
  async function verifyFees() {
    if (!pendingCheckout) return;
    setVerifying(true);
    setPayError(null);
    try {
      const result = await feesApi.verifyCheckout(pendingCheckout.reference);
      if (result.status === 'succeeded') {
        clearPendingFeeCheckout();
        setPendingCheckout(null);
        await load();
      } else if (result.status === 'failed') {
        clearPendingFeeCheckout();
        setPendingCheckout(null);
        setPayError('That payment did not succeed — start a new one below.');
      } else {
        setPayError("Not confirmed yet — if you just paid, this can take a moment. Try again shortly.");
      }
    } catch (err: any) {
      setPayError(err?.response?.data?.detail || 'Could not verify that payment right now — try again in a moment.');
    } finally {
      setVerifying(false);
    }
  }

  const cardCls = dark ? 'bg-smc-panel border-smc-border text-white' : 'bg-white border-corporate-bg text-corporate-text-on-bg';
  const inputCls = `w-full mt-1 border rounded-lg px-2.5 py-1.5 text-sm ${dark ? 'bg-smc-dark border-smc-border text-white' : 'bg-white border-corporate-bg text-corporate-text-on-bg'}`;

  const STATUS_STYLE: Record<string, { icon: JSX.Element; cls: string; label: string }> = {
    verified: { icon: <CheckCircle2 size={13} />, cls: 'bg-emerald-100 text-emerald-700', label: 'Verified' },
    pending: { icon: <Clock size={13} />, cls: 'bg-amber-100 text-amber-700', label: 'Not tested yet' },
    failed: { icon: <XCircle size={13} />, cls: 'bg-red-100 text-red-700', label: 'Failed' },
    suspended: { icon: <Ban size={13} />, cls: 'bg-gray-200 text-gray-600', label: 'Suspended by admin' },
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto px-4 py-6">
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>
          <Link2 size={20} /> Connect Your Exchange
        </h1>
        <p className={`text-sm mt-1 ${dark ? 'text-white/60' : 'text-gray-500'}`}>
          Connect your own exchange account so your trades — placed manually here, or copied from a bot you subscribe to — execute on YOUR account, not a shared pool.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

      {(outboundIpVm || outboundIpFixie) ? (
        <div className="rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm px-3 py-2 space-y-1">
          <p className="font-semibold">Whitelist BOTH of these outbound IPs on your exchange API key:</p>
          {outboundIpVm && <p>Primary (VM): <span className="font-mono font-semibold">{outboundIpVm}</span></p>}
          {outboundIpFixie && <p>Backup (Fixie): <span className="font-mono font-semibold">{outboundIpFixie}</span></p>}
          <p className="text-xs opacity-70">This platform automatically fails over between the two — whitelisting only one risks your trades silently not executing if that path is ever down.</p>
        </div>
      ) : (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2">
          Your admin hasn't published this platform's outbound IP(s) yet — ask them for it before restricting your exchange key by IP (you can still connect without an IP restriction, though it's not recommended).
        </div>
      )}

      {fees && (
        <FoldedCard
          title="Performance Fees"
          summary={
            (fees.enabled || fees.manual_trade_fee_enabled)
              ? `${fees.fee_percent}% of profit${fees.total_owed > 0 ? ` · ${fees.settlement_currency} ${fees.total_owed.toFixed(2)} owed` : ''}`
              : 'Free — no fee currently charged'
          }
          icon={<Percent size={18} />} dark={dark}
        >
          <div className="space-y-2 py-2 text-sm">
            {(fees.enabled || fees.manual_trade_fee_enabled) ? (
              <>
                <p>
                  A {fees.fee_percent}% fee applies to the PROFIT (never a loss, never a Paper/Test
                  trade) on{' '}
                  {fees.enabled && fees.manual_trade_fee_enabled
                    ? 'any trade a bot copies onto your own account AND any manual trade you place yourself'
                    : fees.enabled
                      ? 'any trade a bot copies onto your own account (not on a manual trade you place yourself)'
                      : 'any manual trade you place yourself (not on a bot-copied trade)'}
                  .
                </p>
                {fees.total_owed > 0 && (
                  <div className={`rounded-xl p-3 border ${dark ? 'bg-amber-400/10 border-amber-400/20' : 'bg-amber-50 border-amber-200'}`}>
                    <p className="font-semibold">
                      You currently owe {fees.settlement_currency} {fees.total_owed.toFixed(2)}.
                      {' '}Any fee from a PREVIOUS day pauses new trades until it's settled — pay
                      instantly with Paystack below, or send it directly
                      {fees.crypto_address && <> via crypto (<span className="font-mono">{fees.crypto_address}</span>{fees.crypto_network ? `, ${fees.crypto_network}` : ''})</>}
                      {fees.crypto_address && fees.paystack_account_number && ' or'}
                      {fees.paystack_account_number && <> bank transfer ({fees.paystack_account_name}, {fees.paystack_bank_name} {fees.paystack_account_number}) and let your admin know</>}
                      .
                    </p>
                    {payError && <p className="text-xs text-red-600 mt-2">{payError}</p>}
                    {pendingCheckout && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs opacity-70">Already paid via {pendingCheckout.provider === 'ivorypay' ? 'IvoryPay' : 'Paystack'}?</span>
                        <button
                          onClick={verifyFees}
                          disabled={verifying}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-gray-900 text-white disabled:opacity-50"
                        >
                          <RefreshCw size={11} className={verifying ? 'animate-spin' : ''} /> {verifying ? 'Checking…' : 'Verify now'}
                        </button>
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => payFees('paystack')}
                        disabled={payBusy !== null}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                      >
                        <CreditCard size={13} /> {payBusy === 'paystack' ? 'Starting checkout…' : `Pay ${fees.settlement_currency} ${fees.total_owed.toFixed(2)} with Paystack`}
                      </button>
                      <button
                        onClick={() => payFees('ivorypay')}
                        disabled={payBusy !== null}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-50 ${dark ? 'border-white/20 text-white hover:bg-white/5' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                      >
                        <Coins size={13} /> {payBusy === 'ivorypay' ? 'Starting checkout…' : 'Pay with crypto (IvoryPay)'}
                      </button>
                    </div>
                  </div>
                )}
                {fees.entries.length > 0 && (
                  <div className="pt-2 space-y-1">
                    {fees.entries.slice(0, 10).map((e) => (
                      <div key={e.id} className="flex justify-between text-xs opacity-70">
                        <span>{e.trade_id}</span>
                        <span>${e.fee_amount.toFixed(2)} — {e.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="opacity-70">Trading on your account is free right now — no performance fee is being charged, on bot-copied or manual trades.</p>
            )}
          </div>
        </FoldedCard>
      )}

      <FoldedCard title="Your Connections" summary={`${connections.length} connected account${connections.length === 1 ? '' : 's'}`} icon={<Link2 size={18} />} dark={dark} defaultOpen>
        {loading ? (
          <p className="text-sm opacity-60 py-2">Loading…</p>
        ) : connections.length === 0 ? (
          <p className="text-sm opacity-60 py-2">No exchange connected yet — add one below.</p>
        ) : (
          <div className="space-y-2 py-2">
            {connections.map((c) => {
              const st = STATUS_STYLE[c.status] || STATUS_STYLE.pending;
              const mySubs = subscriptions.filter((s) => s.connection_id === c.id);
              return (
                <div key={c.id} className={`rounded-lg border p-3 ${cardCls}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-semibold text-sm">
                        {exchanges.find((e) => e.exchange === c.exchange)?.label || c.exchange}
                        {c.label && <span className="opacity-60 font-normal"> — {c.label}</span>}
                      </div>
                      <div className="text-xs opacity-60 mt-0.5">Key {c.api_key_preview} · Mode: {c.mode} · {!c.is_active && 'Disabled · '}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${st.cls}`}>{st.icon}{st.label}</span>
                  </div>
                  {c.last_error && <p className="text-xs text-red-600 mt-2">{c.last_error}</p>}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <button onClick={() => testConn(c.id)} disabled={busyId === c.id} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-50">
                      <RefreshCw size={12} className={busyId === c.id ? 'animate-spin' : ''} /> Test connection
                    </button>
                    <button onClick={() => toggleActive(c)} disabled={busyId === c.id} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border disabled:opacity-50">
                      {c.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => removeConn(c.id)} disabled={busyId === c.id} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-red-600 border border-red-200 disabled:opacity-50">
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>

                  {(c.mode === 'bot' || c.mode === 'both') && (
                    <div className="mt-3 pt-3 border-t border-black/10">
                      <div className="text-xs font-semibold opacity-70 mb-1.5 flex items-center gap-1"><Bot size={13} /> Bots copying to this account</div>
                      {mySubs.length === 0 && <p className="text-xs opacity-50 mb-1.5">None yet.</p>}
                      <div className="flex flex-wrap gap-1.5">
                        {mySubs.map((s) => (
                          <span key={s.id} className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                            {bots.find((b) => b.bot_id === s.bot_id)?.bot_name || s.bot_id}
                            <button
                              onClick={() => toggleCopyMode(s)} disabled={busyId === s.id}
                              title={s.copy_mode === 'auto' ? 'Executes immediately, no approval needed — click to switch to Manual' : 'You approve each copied trade yourself — click to switch to Auto'}
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full disabled:opacity-50 ${s.copy_mode === 'auto' ? 'bg-emerald-600 text-white' : 'bg-gray-300 text-gray-700'}`}
                            >
                              {s.copy_mode === 'auto' ? 'AUTO' : 'MANUAL'}
                            </button>
                            <button onClick={() => unsubscribe(s.id)} disabled={busyId === s.id} className="opacity-60 hover:opacity-100">✕</button>
                          </span>
                        ))}
                        {bots.filter((b) => !mySubs.some((s) => s.bot_id === b.bot_id)).map((b) => (
                          <button key={b.bot_id} onClick={() => subscribe(c.id, b.bot_id)} disabled={busyId === c.id + b.bot_id}
                            className="text-[11px] font-medium px-2 py-1 rounded-full border border-dashed opacity-70 hover:opacity-100 disabled:opacity-30">
                            + {b.bot_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </FoldedCard>

      <FoldedCard title="Add an Exchange" summary="Connect another account" icon={<Plus size={18} />} dark={dark} defaultOpen={connections.length === 0}>
        {!showForm ? (
          <button onClick={() => setShowForm(true)} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg bg-blue-600 text-white">
            <Plus size={14} /> Connect an exchange
          </button>
        ) : (
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-semibold opacity-70">Exchange</label>
              <select className={inputCls} value={formExchange} onChange={(e) => { setFormExchange(e.target.value); setFormFields({}); }}>
                <option value="">Select…</option>
                {exchanges.map((e) => <option key={e.exchange} value={e.exchange}>{e.label}</option>)}
              </select>
            </div>
            {selectedMeta && (
              <>
                <p className="text-xs opacity-70">{selectedMeta.instructions}</p>
                {selectedMeta.fields.map((f) => (
                  <div key={f}>
                    <label className="text-xs font-semibold opacity-70">{f === 'api_key' ? (formExchange === 'metatrader' ? 'MetaApi token' : 'API key') : f === 'api_secret' ? 'API secret' : 'Account ID'}</label>
                    <input
                      type={f === 'api_secret' ? 'password' : 'text'} className={inputCls}
                      value={formFields[f] || ''}
                      onChange={(e) => setFormFields((prev) => ({ ...prev, [f]: e.target.value }))}
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-semibold opacity-70">Label (optional)</label>
                  <input className={inputCls} value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="e.g. My BingX main account" />
                </div>
                <div>
                  <label className="text-xs font-semibold opacity-70">Use this connection for</label>
                  <select className={inputCls} value={formMode} onChange={(e) => setFormMode(e.target.value as any)}>
                    <option value="manual">Manual trading only — orders I place myself</option>
                    <option value="bot">Bot copy-trading only — bots I subscribe to</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                {formError && <p className="text-xs text-red-600">{formError}</p>}
                <div className="flex gap-2">
                  <button onClick={submitConnect} disabled={saving} className="text-sm font-semibold px-3 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save connection'}
                  </button>
                  <button onClick={() => { setShowForm(false); setFormError(null); }} className="text-sm font-semibold px-3 py-2 rounded-lg border">Cancel</button>
                </div>
              </>
            )}
          </div>
        )}
      </FoldedCard>
    </div>
  );
}
