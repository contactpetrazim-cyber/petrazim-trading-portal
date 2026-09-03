"""Recreated exactly from the v3 Phase 1 build — the unified login
foundation. If merging, diff against your existing copy; should be
byte-identical."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class UserRole(enum.Enum):
    TRADER = "trader"
    FUND_MANAGER = "fund_manager"
    PARTNER = "partner"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class UserStatus(enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    ACCESS_EXPIRED = "access_expired"


ROLE_BADGE_COLOR = {
    UserRole.TRADER: "#3b82f6",
    UserRole.FUND_MANAGER: "#8b5cf6",
    UserRole.PARTNER: "#f59e0b",
    UserRole.ADMIN: "#ef4444",
    UserRole.SUPER_ADMIN: "#111827",
}

ROLE_LANDING_ROUTE = {
    UserRole.TRADER: "/dashboard",
    UserRole.FUND_MANAGER: "/manager",
    UserRole.PARTNER: "/partner",
    UserRole.ADMIN: "/admin",
    UserRole.SUPER_ADMIN: "/admin",
}


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)

    role = Column(Enum(UserRole), nullable=False, default=UserRole.TRADER)
    status = Column(Enum(UserStatus), nullable=False, default=UserStatus.PENDING)

    is_super_admin_seed = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
