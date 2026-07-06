"""Per-user plant authorization backed by the central GLI Nexus access table.

Table (env GLI_ACCESS_TABLE, default sbx-logistics.gli_nexus.user_access):
    user_email STRING | project STRING | scope STRING
One row per grant, multiple rows per user. project = "kelly", "vde", ... or
"*"; scope = "*" or an uppercase warehouse id (SEDICO, ATLANTA, ...).
Unknown users are denied. Identity comes from the headers the Databricks
Apps proxy injects after authenticating the user.
"""
from __future__ import annotations
import logging
import os
import threading
import time

import flask

from kelly_dashboard.data_loader import (
    _IDENTIFIER_PART_RE,
    _sql_connect_kwargs,
    _sql_http_path,
)

_log = logging.getLogger(__name__)

_TTL_S = int(os.environ.get("KELLY_AUTH_TTL_S", "180"))
_FAIL_TTL_S = 30

# email -> (fetched_at, scopes). scopes None = lookup failed.
_cache: dict[str, tuple[float, frozenset[str] | None]] = {}
_lock = threading.Lock()


def _in_databricks_app() -> bool:
    return bool(
        os.environ.get("DATABRICKS_APP_NAME") or os.environ.get("DATABRICKS_CLIENT_ID")
    )


def get_current_email() -> str | None:
    email = None
    if flask.has_request_context():
        h = flask.request.headers
        email = (
            h.get("X-Forwarded-Email")
            or h.get("X-Forwarded-Preferred-Username")
            or h.get("X-Forwarded-User")
        )
    if not email and not _in_databricks_app():
        # Local-dev only: simulate a user. Ignored when deployed so it can
        # never override the proxy-authenticated identity.
        email = os.environ.get("KELLY_DEV_USER_EMAIL")
    return email.strip().lower() if email else None


def _access_table() -> str | None:
    fq = os.environ.get("GLI_ACCESS_TABLE", "sbx-logistics.gli_nexus.user_access")
    parts = fq.split(".")
    if len(parts) != 3 or not all(_IDENTIFIER_PART_RE.fullmatch(p) for p in parts):
        _log.warning("Invalid GLI_ACCESS_TABLE: %r", fq)
        return None
    return ".".join(f"`{p}`" for p in parts)


def _query_scopes(email: str) -> frozenset[str] | None:
    """Scopes for this user+project. None => lookup FAILED (vs empty = no rows)."""
    table = _access_table()
    http_path = _sql_http_path()
    if not table or not http_path:
        return None
    project = os.environ.get("KELLY_PROJECT_KEY", "kelly").strip().lower()
    try:
        from databricks import sql as dbsql

        with dbsql.connect(
            http_path=http_path, **_sql_connect_kwargs()
        ) as conn, conn.cursor() as cur:
            cur.execute(
                f"SELECT DISTINCT upper(trim(scope)) FROM {table} "
                f"WHERE lower(trim(user_email)) = :email "
                f"AND (lower(trim(project)) = :project OR trim(project) = '*')",
                {"email": email, "project": project},
            )
            return frozenset(r[0] for r in cur.fetchall() if r[0])
    except Exception:
        _log.exception("Scope lookup failed for %s", email)
        return None


def get_user_scopes(email: str) -> frozenset[str] | None:
    email = email.strip().lower()
    now = time.time()
    with _lock:
        hit = _cache.get(email)
    if hit is not None:
        ts, scopes = hit
        if now - ts < (_TTL_S if scopes is not None else _FAIL_TTL_S):
            return scopes
    fresh = _query_scopes(email)
    if fresh is None and hit is not None and hit[1] is not None:
        # Lookup outage: keep serving the last good scopes instead of locking
        # everyone out; the failed attempt is not cached.
        return hit[1]
    with _lock:
        _cache[email] = (now, fresh)
    return fresh


def is_authorized(warehouse_id: str) -> bool:
    email = get_current_email()
    if email is None:
        # No identity locally = dev run, allow. When deployed the proxy always
        # sets the header, so a missing one is deny.
        return not _in_databricks_app()
    scopes = get_user_scopes(email)
    if not scopes:  # None (failure) or empty (unknown user)
        return False
    return "*" in scopes or (warehouse_id or "").strip().upper() in scopes
