# v3 Phase 2 — Payments, Registration, Telegram Community

## What got built

**Access & payment models** (`backend/app/models/access.py`): AccessTier
(Essential/Professional/Executive), your exact duration-pass catalogue
(One-Day/Half-Day/AM/PM/3-HR Refresh/One Module, NGN+USD), a single
`AccessCode` table handling promo/referral/corporate-seat codes through
one redemption flow, and a `Payment` table.

**Payment service** (`backend/app/services/payments.py`): Stripe +
Paystack abstraction, test-mode only — both clients refuse to run if a
live-looking key is detected. NGN auto-routes to Paystack (Stripe can't
take NGN). The actual checkout-session creation calls are stubs
(`NotImplementedError`) until real test-mode API keys exist — same
honesty pattern as the deployment placeholders: nothing here can be
mistaken for a working payment flow before it actually is one.

**Payments router** (`backend/app/routers/payments.py`): pricing
lookup, checkout start, one redemption endpoint for all three code
types, and an access-status check other parts of the app can query to
gate content.

## Telegram — what's actually possible, and what's built

Telegram's Bot API does not let a bot add an arbitrary user to a
channel — this is a deliberate platform restriction, not a limitation
of this build. What IS possible, and what's built:

1. **`TelegramService`** (`backend/app/services/telegram.py`) — wraps
   the real Bot API: create trackable invite links, send a DM (only
   works after the user has messaged the bot first — also a Telegram
   restriction), and — the actual automation — approve or decline join
   requests.
2. **Webhook router** (`backend/app/routers/telegram_webhook.py`) —
   Telegram calls this when someone requests to join either channel.
   It checks whether that Telegram account is linked to a platform
   account with active paid access, and approves or declines
   automatically. This is the real "add members" flow: user taps
   join → request lands on our server → approved in under a second if
   they're entitled, with zero manual admin action.
3. **Two bots, routed by how access was granted** — individual
   signups go through `@petrazim_tradefx_bot` /
   `t.me/petrazim_tradefx`; corporate-seat grants go through
   `@petrazim_tradefx_corp_bot` / `t.me/petrazim_tradefx_corp`. Same
   sponsor-type routing pattern as the Academy build. Verified in
   isolation: `channel_for_access('corporate_seat')` routes corporate,
   everything else routes individual.

**Setup required before this works live** (not done yet, on purpose):
1. Set both channels to "Approve new members" in Telegram's admin settings.
2. Store both bot tokens as `TELEGRAM_BOT_TOKEN_INDIVIDUAL` /
   `TELEGRAM_BOT_TOKEN_CORP` environment variables — **regenerate both
   via @BotFather first**, since the original tokens were shared in
   this chat and should be treated as exposed.
3. Call `TelegramService.set_webhook()` once per bot after deployment,
   pointing at `/telegram/webhook/individual` and
   `/telegram/webhook/corporate`.
4. Add a webhook secret token (Telegram supports this natively) before
   this goes live — currently unauthenticated, flagged in the file.

## Frontend

`RegistrationGateCard.tsx` (collapsible Name/Email/Phone gate, same
pattern as the Academy) and `CommunityJoinButtons.tsx` (Telegram +
WhatsApp buttons, with honest copy about the approve-on-request flow
rather than implying instant auto-add).

## On the GitHub/Fly.io question

Confirmed accurate: Claude Code (your Pro plan) can drive Fly.io
directly via its bash tool — no MCP needed for that part, just
`flyctl` installed in the environment. GitHub Codespaces in your Fold
6's browser is the right way to get that environment without a
computer. Claude Code (terminal) and this chat don't have a live
bridge to each other; GitHub Actions with `@claude` mentions in an
issue is the real bridge if you want to trigger work remotely without
a terminal open.
