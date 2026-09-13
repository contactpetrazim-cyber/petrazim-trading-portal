# Used both as this repo's general-purpose backend image and,
# specifically, by the Coolify VM failover deployment (see CLAUDE.md's
# dual-failover architecture — Render primary, this Nube VM backup,
# both pointed at the same Supabase database). Render's own service is
# unaffected: it builds via its own dashboard-configured commands
# (pip install ...; uvicorn ...), never reads this file.
#
# Coolify's nixpacks auto-builder failed here with "pip: command not
# found" — nixpacks generated a Dockerfile that references
# $NIXPACKS_PATH (meant to point at the venv it builds) without ever
# actually defining it when a custom install/start command is
# supplied, so the venv gets built but pip never lands on PATH
# (confirmed directly from two separate failed deployment logs, both
# erroring at the exact same "RUN pip install..." step). A plain,
# explicit Dockerfile sidesteps nixpacks' auto-detection entirely.
#
# Installs BOTH requirement files — requirements-additions.txt (the v2/
# v3 addition packages) was missing from this file's previous version,
# which only installed requirements.txt; Render's own build command
# has always installed both, so this now matches it exactly rather
# than risking an ImportError this image alone would hit at runtime.
FROM python:3.11-slim

WORKDIR /app

# gcc + postgresql-client: kept from this file's previous version —
# some dependency in requirements-additions.txt may need a C build
# step, and postgresql-client is a normal operational tool to have in
# a Postgres-backed image even though asyncpg itself ships as a wheel.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Leverages Docker's layer cache: dependencies only reinstall when
# requirements actually change, not on every code edit.
COPY requirements.txt requirements-additions.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-additions.txt

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# No --reload here (this file's previous version had it): --reload is
# a dev-server convenience that watches the filesystem for edits, not
# something a running production/failover container should do.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
