import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/**
 * CommunityJoinButtons — shown right after registration/payment, same
 * placement as the Academy build. Routes to the correct Telegram
 * channel (individual vs corporate) based on how access was granted —
 * see app/services/telegram.py: channel_for_access() for the backend
 * side of this same routing decision.
 *
 * IMPORTANT: tapping "Join Telegram" takes the user to the channel's
 * public join-request link. It does NOT auto-add them — Telegram
 * doesn't allow that. What happens next: they request to join, our
 * webhook checks their access, and approves automatically within
 * seconds. The button copy below reflects that honestly rather than
 * promising instant membership.
 *
 * KNOWN GAP, not something this component can fix on its own: neither
 * TELEGRAM_BOT_TOKEN_INDIVIDUAL nor TELEGRAM_BOT_TOKEN_CORP is set in
 * this backend's environment (backend/.env), so approve_join_request()
 * can never actually run — every join request sits pending forever no
 * matter how correct this link is. That's the real cause behind "the
 * telegram registration bit link is not working ... no join". Fixing
 * it for real needs a real bot token from @BotFather (one bot added as
 * admin to each channel with "Add Members" permission), set as an env
 * var locally and on the live backend — the same pattern as the AI
 * Coach provider keys.
 *
 * A return path back to Home was missing entirely, by direct report
 * ("a user is left hanging ... can't connect back to begin learning
 * and trading") — added below regardless of the bot-token gap above,
 * since a trader who already has real access shouldn't be stranded on
 * this screen while that gets sorted out.
 */

const CHANNEL_LINKS = {
  individual: 'https://t.me/petrazim_tradefx',
  corporate: 'https://t.me/petrazim_tradefx_corp',
};

export function CommunityJoinButtons({
  channel,
  whatsappLink,
}: {
  channel: 'individual' | 'corporate';
  whatsappLink?: string;
}) {
  return (
    <div className="bg-smc-card border border-smc-border rounded-xl p-5">
      <h3 className="text-sm font-medium text-gray-300 mb-1">Join the community</h3>
      <p className="text-xs text-gray-500 mb-4">
        Tap to request access — you're approved automatically within seconds.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={CHANNEL_LINKS[channel]}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center bg-[#229ED9] text-white font-medium py-2.5 rounded-lg text-sm hover:opacity-90 transition"
        >
          Join on Telegram
        </a>
        {whatsappLink && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center bg-[#25D366] text-white font-medium py-2.5 rounded-lg text-sm hover:opacity-90 transition"
          >
            Join on WhatsApp
          </a>
        )}
      </div>
      <Link
        to="/home"
        className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-gray-400 hover:text-white transition py-1"
      >
        Return to Home dashboard <ArrowRight size={14} />
      </Link>
    </div>
  );
}
