"""
Feature Access Grants — per-user, per-feature invite list.

Backs the "Admin or invitee (set up in the Admin portal)" gate requested
for the Day Trader Skill live-Claude page: Admin/Super Admin always pass
(see app.core.feature_access.require_feature_access), everyone else needs
an explicit grant row here. Deliberately separate from AccessCode/
UserAccess (app/models/access.py) -- those grant a *tier* of access to
the whole portal; this grants one *feature* to one *user*, independent
of their subscription tier.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class FeatureAccessGrant(Base):
    __tablename__ = "feature_access_grants"
    __table_args__ = (UniqueConstraint("user_id", "feature_key", name="uq_feature_access_user_feature"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    feature_key = Column(String(100), nullable=False, index=True)
    granted_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
