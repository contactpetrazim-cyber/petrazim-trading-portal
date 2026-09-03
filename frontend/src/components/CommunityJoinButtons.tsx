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
    </div>
  );
}
