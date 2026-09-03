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

import os
from dataclasses import dataclass
from typing import Literal, Optional, Protocol


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

    def create_checkout(
        self, amount: float, currency: str, description: str, customer_email: str
    ) -> CheckoutSession:
        raise NotImplementedError(
            "Wire this to Paystack's /transaction/initialize REST endpoint "
            "(httpx.post, already in requirements.txt) once PAYSTACK_SECRET_KEY is set."
        )

    def verify_payment(self, reference: str) -> bool:
        raise NotImplementedError("Wire to Paystack's /transaction/verify/{reference} endpoint.")


def get_payment_client(provider: Literal["stripe", "paystack"]) -> PaymentProviderClient:
    """Currency routing, matching the Academy pattern: Paystack handles both
    NGN and USD; Stripe is USD-only. Route NGN to Paystack automatically."""
    if provider == "stripe":
        return StripeClient()
    if provider == "paystack":
        return PaystackClient()
    raise ValueError(f"Unknown payment provider: {provider}")


def recommend_provider(currency: str) -> Literal["stripe", "paystack"]:
    """NGN can only go through Paystack; USD can go through either — default
    to Paystack for USD too when the customer is likely Nigeria-based, since
    it's cheaper there, but this is a router-level decision, not hardcoded here."""
    if currency.upper() == "NGN":
        return "paystack"
    return "stripe"
