import { ShieldAlert, FileText, Lock, RefreshCw, Gavel } from 'lucide-react';
import { FoldedCard } from '../components/FoldedCard';
import { useThemeStore } from '../hooks/useTheme';

/**
 * PoliciesPage — /policies. Reached from the gear-icon Settings panel
 * (see SettingsPanel.tsx's own "Policies" row), by direct request
 * ("Create a policies page and embed in settings etc"). Same shape as
 * SiteMapPage: a plain heading, then one FoldedCard per policy,
 * collapsed by default so the page isn't a wall of legal text on
 * first load.
 *
 * The five sections below are the ones an app with this platform's
 * actual shape genuinely needs — paper AND live trading against a
 * trader's own connected exchange account, tiered paid access
 * (Paystack/crypto per PaymentsPage), bots that place orders
 * automatically once approved, and a community/coaching layer. None
 * of this is placeholder "lorem ipsum" — it's written against what
 * the app actually does — but it is standard platform-policy
 * language, not a substitute for real legal counsel review before
 * this is relied on commercially.
 */
export function PoliciesPage() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';

  const sectionCls = `text-sm leading-relaxed space-y-3 ${dark ? 'text-white/70' : 'text-gray-600'}`;
  const hCls = `font-semibold text-sm mt-4 first:mt-0 mb-1 ${dark ? 'text-white/90' : 'text-corporate-text-on-bg'}`;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className={`text-2xl font-bold mb-2 ${dark ? 'text-white' : 'text-corporate-text-on-bg'}`}>Policies</h1>
      <p className={`text-sm mb-6 ${dark ? 'text-white/40' : 'text-gray-500'}`}>
        The terms, risk disclosures, and privacy and refund policies that govern your use of the Petrazim trading portal. Tap a section to expand it.
      </p>

      <div className="space-y-3">
        <FoldedCard title="Risk Disclosure" summary="Trading involves real risk of loss — read this first" icon={<ShieldAlert size={19} />} dark={dark} accent="#dc2626" defaultOpen>
          <div className={sectionCls}>
            <p>
              Trading foreign exchange, cryptocurrency, metals, and other leveraged instruments carries a high level of risk and
              may not be suitable for every trader. You could sustain a loss of some or all of your invested capital, and past
              performance of any bot, strategy, or trader shown in this portal is not a reliable indicator of future results.
            </p>
            <h3 className={hCls}>Paper vs. live trading</h3>
            <p>
              Paper Trading (is_test trades) simulates order fills, stop-loss and take-profit execution, and P&L using live
              market prices, but no real money or real broker order book is involved — a paper fill can differ from what a real
              exchange would actually give you (slippage, partial fills, and rejected orders are not simulated). Live trades are
              placed against your own connected exchange account (see "Add Exchange" in Settings) using your own API keys, and
              the real exchange enforces your own stop-loss/take-profit as real conditional orders. Petrazim does not hold, and
              never has access to, your funds directly — your exchange account remains under your own control at all times, and
              API keys should be created with trading permissions only, never withdrawal permissions.
            </p>
            <h3 className={hCls}>Automated bots</h3>
            <p>
              Bots configured in this portal generate and, once approved by you (or auto-approved per your own settings), place
              trades on your behalf according to their own rule set. You are responsible for reviewing each bot's configuration,
              risk settings, and approval mode before enabling it — Petrazim is not liable for losses resulting from a bot's
              trading decisions, a misconfigured risk setting, or a delay/outage in signal delivery or order placement.
            </p>
            <p>
              Nothing in this portal — lessons, drills, the Trading Coach, signals, or bot output — constitutes financial,
              investment, or legal advice. You are solely responsible for your own trading decisions.
            </p>
          </div>
        </FoldedCard>

        <FoldedCard title="Terms of Service" summary="The rules for using this platform" icon={<FileText size={19} />} dark={dark} defaultOpen={false}>
          <div className={sectionCls}>
            <h3 className={hCls}>Your account</h3>
            <p>
              You must provide accurate registration details and keep your login credentials confidential. You are responsible
              for all activity under your account, including trades placed by a bot you have configured or approved. Accounts
              are personal to the trader, manager, partner, or admin they were created for and may not be shared or resold.
            </p>
            <h3 className={hCls}>Access tiers and licensing</h3>
            <p>
              Certain tracks, tools, and features are gated behind a paid tier or duration pass (see "Select Access and Pay" in
              Settings). Purchasing access grants you a personal, non-transferable license to use the corresponding features for
              the paid period — it does not transfer ownership of any content, strategy, or software in the portal.
            </p>
            <h3 className={hCls}>Acceptable use</h3>
            <p>
              You agree not to attempt to circumvent access controls or fee gates, scrape or resell portal content, reverse
              engineer bot logic for redistribution, or use the platform for any unlawful purpose. Community spaces (Telegram,
              live sessions) are expected to stay respectful — abusive conduct may result in suspension.
            </p>
            <h3 className={hCls}>Changes and availability</h3>
            <p>
              Features, pricing, and fee structures may change with notice through the portal. Petrazim runs a dual-failover
              backend (a primary service with an automatic backup) to keep the app available, but no uptime guarantee is made —
              trading decisions should never depend on the portal being reachable at any single instant.
            </p>
          </div>
        </FoldedCard>

        <FoldedCard title="Privacy Policy" summary="What we collect and how it's used" icon={<Lock size={19} />} dark={dark} defaultOpen={false}>
          <div className={sectionCls}>
            <h3 className={hCls}>What's collected</h3>
            <p>
              Account details you provide (name, email, role), your trading activity within the portal (trades, bot
              configurations, drill and lesson progress), and, if you connect an exchange, the API key/secret you supply for
              that connection — stored so the portal can place and manage orders on your behalf, never shared with third
              parties beyond the exchange itself.
            </p>
            <h3 className={hCls}>How it's used</h3>
            <p>
              Your data is used to operate your account, execute and track your trades, personalize your Learn progress and
              Insights, and (only where you've opted in) to send you relevant updates. It is not sold to advertisers or data
              brokers.
            </p>
            <h3 className={hCls}>Where it's stored</h3>
            <p>
              Portal data is stored in a single Postgres database (Supabase), with the same data served to whichever backend —
              primary or backup — is currently handling your request. Reasonable technical safeguards (encrypted connections,
              access-scoped API keys) are used, but no online service can guarantee absolute security.
            </p>
            <h3 className={hCls}>Your choices</h3>
            <p>
              You can disconnect an exchange account, request export of your own data, or request account deletion at any time
              through Support — see "Ask Trading Coach" or Facilitator Sessions in Settings to reach the team.
            </p>
          </div>
        </FoldedCard>

        <FoldedCard title="Refund & Cancellation Policy" summary="Subscriptions, duration passes, and fees" icon={<RefreshCw size={19} />} dark={dark} accent="#059669">
          <div className={sectionCls}>
            <p>
              Tier subscriptions and duration passes purchased through "Select Access and Pay" are billed for the period
              selected at checkout. You may cancel future renewal at any time from Settings — cancelling stops the next
              billing cycle but does not refund the current, already-active period, except where required by applicable law or
              where a payment was made in error (duplicate charge, failed activation) — report those to Support as soon as you
              notice them.
            </p>
            <p>
              Performance fees (shown under "Trading Fees" in Settings for Trader accounts) are calculated against your own
              realized trading results and are owed once incurred — they are not refundable once the underlying trade has
              closed, since they reflect performance that has already occurred.
            </p>
            <p>
              Fee payments made via Paystack follow Paystack's own processing terms; fee payments made via crypto are final
              once confirmed on-chain, consistent with how cryptocurrency transactions work.
            </p>
          </div>
        </FoldedCard>

        <FoldedCard title="Acceptable Use & Community Guidelines" summary="Live sessions, Telegram, and the coach" icon={<Gavel size={19} />} dark={dark} accent="#7c3aed">
          <div className={sectionCls}>
            <p>
              Facilitator Sessions, the Telegram community, and the AI Trading Coach are provided to support your learning and
              trading process. Do not use them to solicit unrelated services, share another member's private trade or account
              details, or present bot/coach output as guaranteed investment advice to others.
            </p>
            <p>
              Petrazim reserves the right to suspend access for accounts found to be abusing shared resources (for example,
              excessive automated requests to the Trading Coach, or attempts to disrupt live sessions for other participants).
            </p>
          </div>
        </FoldedCard>
      </div>
    </div>
  );
}
