"""Shared Galileo KPI comments, stored in a Unity Catalog Delta table.

One row per comment, scoped by flow ("Category|Sub-category") and market, with
the area as context. The blueprint in server.py is the only caller: it lists a
thread and adds or deletes comments on behalf of the authenticated user.

The table is created once by an admin with comments_table.sql; the app never
creates or alters it. The hand-authored src/data/content_comments.json stays a
read-only set of published comments shown alongside these.
"""
from __future__ import annotations

import logging
import os
import re
import threading
import time
import uuid
from datetime import datetime, timezone

from shared.db import _IDENTIFIER_PART_RE, _sql_connect_kwargs, _sql_http_path

_log = logging.getLogger(__name__)

MARKETS = frozenset({"REP", "LM"})
AREAS = frozenset({"ALL", "EMEA", "NA", "APAC", "LATAM"})
MAX_TEXT = 2000
MAX_FLOW = 200
_ID_RE = re.compile(r"[0-9a-f]{32}")

_TTL_S = int(os.environ.get("GALILEO_COMMENTS_TTL_S", "30"))
# A stopped warehouse must not hold a gunicorn worker until the 120 s kill.
_SQL_TIMEOUT_S = float(os.environ.get("GALILEO_COMMENTS_SQL_TIMEOUT_S", "20"))

_cache: tuple[float, list[dict]] | None = None
_lock = threading.Lock()


class Unavailable(Exception):
    """The comments table is not configured or cannot be reached."""


def _table() -> str:
    fq = os.environ.get(
        "GALILEO_COMMENTS_TABLE", "sbx-logistics.gli_nexus.galileo_comments"
    )
    parts = fq.split(".")
    if len(parts) != 3 or not all(_IDENTIFIER_PART_RE.fullmatch(p) for p in parts):
        raise Unavailable(f"invalid GALILEO_COMMENTS_TABLE: {fq!r}")
    return ".".join(f"`{p}`" for p in parts)


def _connect():
    http_path = _sql_http_path()
    if not http_path:
        raise Unavailable("no SQL warehouse configured")
    from databricks import sql as dbsql

    kwargs = _sql_connect_kwargs()
    kwargs["_socket_timeout"] = _SQL_TIMEOUT_S
    kwargs["_retry_stop_after_attempts_count"] = 2
    kwargs["_retry_stop_after_attempts_duration"] = _SQL_TIMEOUT_S * 1.5
    return dbsql.connect(http_path=http_path, **kwargs)


def _run(query: str, params: dict | None = None, fetch: bool = False):
    try:
        with _connect() as conn, conn.cursor() as cur:
            cur.execute(query, params or {})
            return cur.fetchall() if fetch else None
    except Unavailable:
        raise
    except Exception as exc:
        _log.exception("galileo comments: query failed")
        raise Unavailable("query failed") from exc


def invalidate() -> None:
    global _cache
    with _lock:
        _cache = None


def _all() -> list[dict]:
    global _cache
    now = time.time()
    with _lock:
        if _cache is not None and now - _cache[0] < _TTL_S:
            return _cache[1]
    rows = _run(
        f"SELECT id, flow, market, area, author_email, text, created_at "
        f"FROM {_table()} ORDER BY created_at DESC",
        fetch=True,
    )
    comments = [
        {
            "id": r[0],
            "flow": r[1],
            "market": r[2],
            "area": r[3],
            "author_email": r[4],
            "text": r[5],
            "created_at": r[6],
        }
        for r in rows
    ]
    with _lock:
        _cache = (now, comments)
    return comments


def list_comments(flow: str, market: str) -> list[dict]:
    return [c for c in _all() if c["flow"] == flow and c["market"] == market]


def validate(body: dict) -> dict:
    """The fields of a new comment, or ValueError naming the first bad one."""
    flow = body.get("flow")
    market = body.get("market")
    area = body.get("area")
    text = body.get("text")
    if not isinstance(flow, str) or "|" not in flow or not 3 <= len(flow) <= MAX_FLOW or "\n" in flow:
        raise ValueError("flow")
    if market not in MARKETS:
        raise ValueError("market")
    if area not in AREAS:
        raise ValueError("area")
    if not isinstance(text, str) or not text.strip() or len(text) > MAX_TEXT:
        raise ValueError("text")
    return {"flow": flow, "market": market, "area": area, "text": text.strip()}


def add_comment(flow: str, market: str, area: str, text: str, author_email: str) -> dict:
    comment = {
        "id": uuid.uuid4().hex,
        "flow": flow,
        "market": market,
        "area": area,
        "author_email": author_email,
        "text": text,
    }
    _run(
        f"INSERT INTO {_table()} (id, flow, market, area, author_email, text, created_at) "
        f"VALUES (:id, :flow, :market, :area, :author_email, :text, current_timestamp())",
        comment,
    )
    invalidate()
    return {**comment, "created_at": datetime.now(timezone.utc)}


def delete_comment(comment_id: str, author_email: str) -> None:
    """Delete one of the caller's own comments.

    LookupError when it does not exist, PermissionError when someone else wrote it.
    """
    if not _ID_RE.fullmatch(comment_id):
        raise LookupError(comment_id)
    rows = _run(
        f"SELECT author_email FROM {_table()} WHERE id = :id",
        {"id": comment_id},
        fetch=True,
    )
    if not rows:
        raise LookupError(comment_id)
    if rows[0][0] != author_email:
        raise PermissionError(comment_id)
    _run(
        f"DELETE FROM {_table()} WHERE id = :id AND author_email = :author_email",
        {"id": comment_id, "author_email": author_email},
    )
    invalidate()


def display_name(email: str | None) -> str:
    """Display name from an email: matteo.mamino@luxottica.com -> Matteo Mamino."""
    if not email:
        return "Unknown"
    words = [w for w in re.split(r"[._\-]+", email.split("@", 1)[0]) if w]
    return " ".join(w.capitalize() for w in words) or email


def public(comment: dict, me: str | None) -> dict:
    """The client shape: the KpiComment fields plus `mine`; never the email."""
    created = comment["created_at"]
    return {
        "id": comment["id"],
        "flow": comment["flow"],
        "market": comment["market"],
        "area": comment["area"],
        "author": display_name(comment["author_email"]),
        "date": created.date().isoformat() if hasattr(created, "date") else str(created)[:10],
        "text": comment["text"],
        "mine": me is not None and comment["author_email"] == me,
    }
