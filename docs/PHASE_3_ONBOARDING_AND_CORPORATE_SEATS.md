# This Package — What's New vs. Recreated

**Merge note:** the build environment resets between some turns in
this conversation, so each zip only contains files touched in that
session. This one contains a handful of files RECREATED exactly from
earlier turns (needed as import dependencies for new code) alongside
genuinely NEW files. When you merge zips into one project, if a
recreated file conflicts with an earlier version, diff them — they
should be identical, but treat any difference as a bug to fix, not a
choice to make.

**Recreated (dependencies only, should match earlier zips exactly):**
`app/models/access.py`, `app/models/telegram_link.py`,
`frontend/src/components/RegistrationGateCard.tsx`

**Genuinely new this turn:**

## 1. Corporate seat codes — answers your question directly

`app/services/corporate_codes.py` + `app/routers/corporate.py`

A corporate purchase of N seats generates **N distinct, single-use
codes** (not one shared code redeemed N times) — verified above:
15-seat and 200-seat batches both produced fully unique codes in the
readable `PZM-XXXX-XXXX` format, no ambiguous characters (no 0/O,
1/I/L confusion), valid for 60 days as specified. Each sponsored
individual redeems their OWN code through the same single field every
other code type uses, and gets independent account access — the
sponsoring org can't see who redeemed which seat, only how many of
their N codes are used vs. outstanding.

**Why individual codes over one shared code:** traceable per-seat
redemption, revocable one at a time, and a single leaked code only
exposes one seat instead of the whole batch.

## 2. Payment webhook — closes a real gap

`app/routers/payment_webhooks.py`

Until this, `/payments/checkout` created a PENDING payment and nothing
ever marked it succeeded or granted access — there was no path from
"paid" to "has access." This is that path. Paystack's webhook is
fully wired (signature verification via HMAC-SHA512, idempotent
against duplicate delivery, auto-generates seat codes for corporate
purchases). Stripe's needs the `stripe` SDK wired in alongside its
signature verification — flagged clearly rather than faked.

## 3. Mandatory community gate — corrected per your instruction

`app/routers/onboarding.py` + `frontend/.../CommunityGateStep.tsx`

Earlier builds had community join as optional. This version has NO
skip option — the Continue button is disabled until
`/community/status` confirms Telegram is connected, polled every 3
seconds so the webhook's auto-approval (built earlier) is caught
without a manual refresh. WhatsApp stays alongside as optional,
non-blocking — matches the reference screenshots exactly.

Verified: the onboarding state machine (payment -> community ->
complete) tested correct across every state combination, including
the edge case of community-joined-without-payment, which correctly
still demands payment first.

## 4. Full onboarding flow

`frontend/src/pages/OnboardingPage.tsx` + `StartHereCard.tsx`

Register -> Pay -> Community (mandatory) -> choice of Start Trading or
Explore Site, exactly as specified. State is derived from
`/onboarding/status` on load, not just local component state — closing
the tab mid-flow and coming back resumes at the correct step.

**One gap flagged, not hidden:** the registration form (matching your
reference screenshots) collects name/email/phone only, no password —
but /auth/register requires one. This needs a password field added
before go-live; noted directly in the code rather than papered over
with a fake generated password the user could never log in with again.
