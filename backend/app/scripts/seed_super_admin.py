"""
Super Admin Seed Script
==========================

Creates the single Super Admin account for Adekunle Oke. Run ONCE,
manually, after the users table exists:

    python -m app.scripts.seed_super_admin

WHY THIS IS A SCRIPT, NOT A MIGRATION WITH A HARDCODED PASSWORD:
A real password must never live in a SQL file or in this repo, even a
private one. This script reads the initial password from an
environment variable at run time, hashes it before it ever touches the
database, and the env var itself should be deleted from your
environment right after this runs once.

BEFORE RUNNING, set:
    SUPER_ADMIN_EMAIL=<Adekunle's real email>
    SUPER_ADMIN_INITIAL_PASSWORD=<a strong one-time password>

The account is created with is_super_admin_seed=True — this is the
flag every super-admin-only action actually checks (see
core/auth.py:require_super_admin), not just the role field, so this
script is the only place that flag is ever set to True.

FIRST-LOGIN PASSWORD CHANGE: this script does not implement a "must
change password on first login" flow — add one before this goes near
real users, since a one-time password sitting in an env var history is
not something to leave standing indefinitely.
"""

from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import select

from app.core.auth import hash_password
from app.database import AsyncSessionLocal
from app.models.user import User, UserRole, UserStatus


async def seed_super_admin():
    email = os.environ.get("SUPER_ADMIN_EMAIL")
    password = os.environ.get("SUPER_ADMIN_INITIAL_PASSWORD")

    if not email or not password:
        print("ERROR: Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_INITIAL_PASSWORD "
              "environment variables before running this script.")
        sys.exit(1)

    if len(password) < 12:
        print("ERROR: Super Admin password should be at least 12 characters "
              "— this account can create/remove every other account.")
        sys.exit(1)

    async with AsyncSessionLocal() as db:
        existing = (await db.execute(
            select(User).where(User.is_super_admin_seed == True)  # noqa: E712
        )).scalar_one_or_none()
        if existing:
            print(f"A Super Admin already exists: {existing.email}. "
                  "Refusing to create a second one — remove the existing "
                  "flag first if this is intentional.")
            sys.exit(1)

        user = User(
            email=email,
            full_name="Adekunle Oke",
            hashed_password=hash_password(password),
            role=UserRole.SUPER_ADMIN,
            status=UserStatus.ACTIVE,
            is_super_admin_seed=True,
        )
        db.add(user)
        await db.commit()
        print(f"Super Admin created: {email}")
        print("Now unset SUPER_ADMIN_INITIAL_PASSWORD from your environment.")


if __name__ == "__main__":
    asyncio.run(seed_super_admin())
