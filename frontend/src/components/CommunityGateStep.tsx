import { useEffect, useState } from 'react';
import { Send, MessageCircle, CheckCircle2 } from 'lucide-react';

const CHANNEL_LINKS = {
  individual: 'https://t.me/petrazim_tradefx',
  corporate: 'https://t.me/petrazim_tradefx_corp',
};

/**
 * CommunityGateStep — originally spec'd as MANDATORY, no skip button
 * ("After Registration - you are directed to join the community no
 * option."), with Telegram as the gating factor: the webhook
 * auto-approves the join request and this step polls
 * /community/status for confirmation, only then enabling Continue.
 *
 * That auto-approval depends on a real Telegram bot token
 * (TELEGRAM_BOT_TOKEN_INDIVIDUAL / _CORP) which is not currently set
 * anywhere in this backend's environment — so telegram_connected can
 * never actually flip true, and this "no option" gate was leaving
 * every new trader stuck here permanently with no way to reach the
 * platform they already paid for. By direct bug report ("the telegram
 * registration bit link is not working ... a user is left hanging ...
 * can't connect back to begin learning and trading"): added a real
 * escape hatch below. This doesn't bypass any actual server-side gate
 * — nothing outside this component's own `disabled` prop ever checks
 * community_joined (OnboardingPage's handleCommunityContinue just
 * navigates home; access itself is governed by UserAccess/payment, not
 * Telegram), so letting a trader continue without Telegram connected
 * changes no real permission, only this screen's own UI block.
 */
export function CommunityGateStep({
  apiBaseUrl = '',
  channel,
  whatsappLink,
  onContinue,
}: {
  apiBaseUrl?: string;
  channel: 'individual' | 'corporate';
  whatsappLink?: string;
  onContinue: () => void;
}) {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  async function checkStatus() {
    try {
      const res = await fetch(`${apiBaseUrl}/community/status`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setConnected(data.telegram_connected);
      }
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    checkStatus();
    const interval = setInterval(() => {
      if (!connected) checkStatus();
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 max-w-md mx-auto">
      <div className="w-12 h-12 rounded-full bg-corporate-bg flex items-center justify-center mb-4">
        <Send size={22} className="text-corporate-hero" />
      </div>

      <h2 className="text-xl font-bold text-corporate-text-on-bg">Join your trading community</h2>
      <p className="text-sm text-gray-500 mt-2 mb-5">
        Live signals, facilitator support, and daily market prompts arrive on Telegram.
        Connect it now — this is required before trading or exploring the platform opens up.
      </p>

      <a
        href={CHANNEL_LINKS[channel]}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-medium transition-colors ${
          connected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-[#229ED9] text-white hover:opacity-90'
        }`}
      >
        {connected ? <CheckCircle2 size={18} /> : <Send size={18} />}
        {connected ? 'Telegram connected' : 'Join our Telegram community'}
      </a>
      {!connected && !checking && (
        <p className="text-xs text-gray-400 text-center mt-2">
          Tap above, request to join — you're approved automatically within seconds.
        </p>
      )}

      {whatsappLink && (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-medium bg-corporate-bg text-corporate-text-on-bg mt-3 hover:opacity-90 transition-opacity"
        >
          <MessageCircle size={18} />
          Message us on WhatsApp
        </a>
      )}
      <p className="text-xs text-gray-400 mt-2">
        Direct line to your facilitator for questions and support. Optional — doesn't affect the step below.
      </p>

      <button
        onClick={onContinue}
        disabled={!connected}
        className="w-full mt-6 py-3 rounded-lg text-sm font-semibold bg-corporate-accent text-white disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {connected ? 'Continue' : 'Connect Telegram to continue'}
      </button>

      {!connected && (
        <button
          onClick={onContinue}
          className="w-full mt-2 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-corporate-text-on-bg transition-colors"
        >
          Skip for now — return to Home dashboard
        </button>
      )}
    </div>
  );
}
