"""
Payment Service — Stripe (USD) + Paystack (NGN/USD), test mode
==================================================================

Same abstraction pattern as the Academy build: one interface, two
providers, so the router/frontend never care which one is running
underneath. Both clients read their API keys from environment
variables and will raise clearly if those aren't set — no silent
fallback to a fake "always succeeds" mode, since that's the kind of
bug that's invisible until real money is involved.

TEST MODE ONLY until you explicitly say otherwise: both provider
clients below default to test/sandbox key prefixes and refuse to
proceed if a live-looking key is detected, as a guardrail against
accidentally taking real payments before this has been reviewed.
"""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass
from typing import Literal, Optional, Protocol

import httpx


@dataclass
class CheckoutSession:
    provider: str
    checkout_url: str
    reference: str
    amount: float
    currency: str


class PaymentProviderClient(Protocol):
    def create_checkout(
        self, amount: float, currency: str, description: str, customer_email: str
    ) -> CheckoutSession: ...

    def verify_payment(self, reference: str) -> bool: ...


class StripeClient:
    def __init__(self):
        self.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
        if not self.api_key:
            raise RuntimeError(
                "STRIPE_SECRET_KEY not set. Get a test-mode key from your Stripe "
                "dashboard (starts with sk_test_) before using this client."
            )
        if self.api_key.startswith("sk_live_"):
            raise RuntimeError(
                "A LIVE Stripe key was detected (sk_live_...). This client is "
                "restricted to test mode (sk_test_...) until payments have been "
                "reviewed and explicitly approved for production."
            )

    def create_checkout(
        self, amount: float, currency: str, description: str, customer_email: str
    ) -> CheckoutSession:
        # Real integration: stripe.checkout.Session.create(...) via the stripe SDK.
        # Left as an explicit call-out rather than faked, since a placeholder
        # "success" response here would be indistinguishable from a real
        # integration bug once this is actually wired up.
        raise NotImplementedError(
            "Wire this to stripe.checkout.Session.create() using the `stripe` "
            "Python package once STRIPE_SECRET_KEY is set. Kept as a stub so "
            "nothing here can be mistaken for a working payment flow."
        )

    def verify_payment(self, reference: str) -> bool:
        raise NotImplementedError("Wire to stripe.checkout.Session.retrieve() + status check.")


class PaystackClient:
    def __init__(self):
        self.api_key = os.environ.get("PAYSTACK_SECRET_KEY", "")
        if not self.api_key:
            raise RuntimeError(
                "PAYSTACK_SECRET_KEY not set. Get a test-mode key from your "
                "Paystack dashboard (starts with sk_test_) before using this client."
            )
        if self.api_key.startswith("sk_live_"):
            raise RuntimeError(
                "A LIVE Paystack key was detected. This client is restricted to "
                "test mode until payments have been reviewed and approved."
            )

    BASE_URL = "https://api.paystack.co"

    def create_checkout(
        self, amount: float, currency: str, description: str, customer_email: str
    ) -> CheckoutSession:
        # Paystack amounts are in the currency's smallest unit (kobo for
        # NGN, cents for USD) — hence * 100.
        response = httpx.post(
            f"{self.BASE_URL}/transaction/initialize",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "email": customer_email,
                "amount": round(amount * 100),
                "currency": currency.upper(),
            },
            timeout=30.0,
        )
        data = response.json()
        if not data.get("status"):
            raise RuntimeError(f"Paystack checkout initialization failed: {data.get('message')}")

        result = data["data"]
        return CheckoutSession(
            provider="paystack",
            checkout_url=result["authorization_url"],
            reference=result["reference"],
            amount=amount,
            currency=currency.upper(),
        )

    def verify_payment(self, reference: str) -> bool:
        response = httpx.get(
            f"{self.BASE_URL}/transaction/verify/{reference}",
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=30.0,
        )
        data = response.json()
        return bool(data.get("status")) and data.get("data", {}).get("status") == "success"


class IvoryPayClient:
    """
    IvoryPay — crypto/fiat payment rails, alternative to Paystack for
    the NGN/crypto side. Written against IvoryPay's documented API
    (https://ivorypay.gitbook.io/ivorypay-api-documentation,
    merchant-endpoints/transactions and transactions/collections
    pages) — not exercised against a live account in this session.

    NOTE: the docs show a full example response for FIAT/API mode
    (bank transfer details) and CRYPTO/API mode (wallet address), but
    not for CHECKOUT mode's response shape specifically. The checkout
    URL field name below (`checkoutUrl`, falling back to a couple of
    likely alternates) needs confirming against a real CHECKOUT-mode
    response before relying on it — the reference/verify flow is
    documented precisely and should be correct as written.
    """

    BASE_URL = "https://api.ivorypay.io/api/v1"

    def __init__(self):
        self.api_key = os.environ.get("IVORYPAY_SECRET_KEY", "")
        if not self.api_key:
            raise RuntimeError(
                "IVORYPAY_SECRET_KEY not set. Get a test-mode key (sk_test_...) "
                "from your IvoryPay dashboard before using this client."
            )
        if self.api_key.startswith("sk_live_"):
            raise RuntimeError(
                "A LIVE IvoryPay key was detected. This client is restricted to "
                "test mode until payments have been reviewed and approved."
            )

    def create_checkout(
        self, amount: float, currency: str, description: str, customer_email: str
    ) -> CheckoutSession:
        reference = str(uuid.uuid4())
        response = httpx.post(
            f"{self.BASE_URL}/transactions",
            headers={"Authorization": self.api_key, "Content-Type": "application/json"},
            json={
                "amount": amount,
                "email": customer_email,
                "type": "FIAT",
                "mode": "CHECKOUT",
                "baseFiat": currency.upper(),
                "crypto": "USDT",
                "reference": reference,
                # IvoryPay validates this as "valid JSON or null" — a
                # bare string like "Smoke test" is rejected (confirmed
                # against their sandbox), so wrap it.
                "metadata": json.dumps({"description": description}),
            },
            timeout=30.0,
        )
        data = response.json()
        if not data.get("success"):
            raise RuntimeError(f"IvoryPay checkout initialization failed: {data.get('message')}")

        result = data["data"]
        # Confirmed against IvoryPay's sandbox: CHECKOUT mode nests the
        # URL under collectionDetails, not at the top level.
        checkout_url = result.get("collectionDetails", {}).get("checkoutUrl")
        if not checkout_url:
            raise RuntimeError(
                "IvoryPay returned no checkout URL field this client recognises "
                f"— raw response: {result}. Their response shape may have changed; "
                "check collectionDetails.checkoutUrl against IvoryPay's current docs."
            )

        return CheckoutSession(
            provider="ivorypay",
            checkout_url=checkout_url,
            reference=result.get("reference", reference),
            amount=amount,
            currency=currency.upper(),
        )

    def verify_payment(self, reference: str) -> bool:
        response = httpx.get(
            f"{self.BASE_URL}/business/transactions/{reference}",
            headers={"Authorization": self.api_key},
            timeout=30.0,
        )
        data = response.json()
        return bool(data.get("success")) and data.get("data", {}).get("status") == "SUCCESS"


class TestPaymentClient:
    """Payments Test mode (see routers/payments.py's GET/PATCH
    /payments/mode) — needs no API key at all, because it never calls
    a real gateway. `create_checkout` points the user at this
    backend's own simulated-checkout page instead of Stripe/Paystack,
    where they can click "Simulate Success" or "Simulate Failure" —
    the second one is what actually lets you test the paywall gate
    (access-status staying false, AccessExpiredGate staying up)
    without needing a real card decline from a real provider.

    `verify_payment` reads the Payment row directly rather than
    calling out anywhere — this IS the source of truth for a
    simulated payment, there's no external system to ask.
    """

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def create_checkout(
        self, amount: float, currency: str, description: str, customer_email: str
    ) -> CheckoutSession:
        reference = f"TEST_{uuid.uuid4().hex[:16]}"
        return CheckoutSession(
            provider="test",
            checkout_url=f"{self.base_url}/payments/test-checkout/{reference}",
            reference=reference,
            amount=amount,
            currency=currency.upper(),
        )

    def verify_payment(self, reference: str) -> bool:
        # Not used in the test-mode flow — routers/payments.py's
        # test-checkout completion endpoint updates the Payment row
        # directly instead of polling this, since there's no external
        # gateway to verify against.
        raise NotImplementedError("Test-mode payments are confirmed via /payments/test-checkout, not verify_payment.")


def get_payment_client(provider: Literal["stripe", "paystack", "ivorypay"]) -> PaymentProviderClient:
    """Currency routing, matching the Academy pattern: Paystack/IvoryPay
    handle both NGN and USD; Stripe is USD-only. Route NGN to Paystack
    automatically."""
    if provider == "stripe":
        return StripeClient()
    if provider == "paystack":
        return PaystackClient()
    if provider == "ivorypay":
        return IvoryPayClient()
    raise ValueError(f"Unknown payment provider: {provider}")


def recommend_provider(currency: str) -> Literal["stripe", "paystack"]:
    """NGN can only go through Paystack (or IvoryPay, via explicit
    override); USD can go through either — default to Paystack for USD
    too when the customer is likely Nigeria-based, since it's cheaper
    there, but this is a router-level decision, not hardcoded here."""
    if currency.upper() == "NGN":
        return "paystack"
    return "stripe"
