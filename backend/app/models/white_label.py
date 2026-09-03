"""
White-Label Bot-as-a-Service — Explore Concept #7
=====================================================

A Fund Manager or Partner runs a branded instance of a bot for their
OWN clients — the platform's engine, their branding. This turns the
Fund Manager/Partner roles already built (v3 Phase 1) into an actual
B2B revenue channel, not just a viewing console.

SCOPE: this models the branding/configuration and the client-roster
relationship. It does NOT duplicate bot execution logic — a white
label deployment still runs the same underlying bot; this layer only
controls what the sponsor's own clients see (name, logo, disclosed
risk parameters) and who's allowed to view it.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class WhiteLabelDeployment(Base):
    __tablename__ = "white_label_deployments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sponsor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    underlying_bot_id = Column(String(50), nullable=False)

    brand_name = Column(String(255), nullable=False)
    brand_logo_url = Column(String(500), nullable=True)
    disclosed_risk_summary = Column(Text, nullable=False)

    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class WhiteLabelClient(Base):
    """A sponsor's own client, granted read access to that sponsor's
    branded deployment — NOT a platform User account with trading
    permissions of their own; this is view-only by design, since the
    sponsor (not the client) holds the actual platform relationship."""
    __tablename__ = "white_label_clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deployment_id = Column(UUID(as_uuid=True), ForeignKey("white_label_deployments.id"), nullable=False)

    client_name = Column(String(255), nullable=False)
    client_email = Column(String(255), nullable=False)
    view_only_access_token = Column(String(64), nullable=False, unique=True)

    added_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
