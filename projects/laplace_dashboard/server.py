"""Laplace Pipeline Monitor — Flask blueprint.

Serves the customs-pipeline HTML report published by the Laplace Databricks
notebook. The notebook's final cell appends the fully assembled page to
`sbx-logistics.gli_nexus.laplace_report` (generated_at TIMESTAMP, html STRING);
this blueprint reads the latest row at request time with a short TTL cache, so
every notebook run (manual or scheduled job) refreshes the dashboard with no
app redeploy. Access is gated by the central GLI Nexus access table (project
LAPLACEPIPELINE). See data_pipeline/publish_to_nexus.py for the notebook-side cell.
"""
from __future__ import annotations

import logging
import os
import re
import threading
import time

from flask import Blueprint, Response

from shared import auth
from shared.db import (
    _IDENTIFIER_PART_RE,
    _sql_connect_kwargs,
    _sql_http_path,
)

_log = logging.getLogger(__name__)

bp = Blueprint("laplace", __name__)

_PROJECT_KEY = "LAPLACEPIPELINE"
_TTL_S = int(os.environ.get("LAPLACE_CACHE_TTL_S", "300"))

# Ruby: Excel download served from a Unity Catalog volume via the Databricks
# Files API (no /Volumes filesystem mount assumed in the App container).
_RUBY_PROJECT_KEY = "RUBY"
_RUBY_VOLUME_PATH = os.environ.get(
    "RUBY_XLSX_PATH",
    "/Volumes/sbx-logistics/gli_nexus/nexus_volume/package_flags_2026.xlsx",
)
_RUBY_DOWNLOAD_NAME = "package_flags_2026.xlsx"
_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

_cache: tuple[float, dict] | None = None
_lock = threading.Lock()


def _report_table() -> str | None:
    fq = os.environ.get("LAPLACE_REPORT_TABLE", "sbx-logistics.gli_nexus.laplace_report")
    parts = fq.split(".")
    if len(parts) != 3 or not all(_IDENTIFIER_PART_RE.fullmatch(p) for p in parts):
        _log.warning("Invalid LAPLACE_REPORT_TABLE: %r", fq)
        return None
    return ".".join(f"`{p}`" for p in parts)


def _query() -> dict | None:
    table = _report_table()
    http_path = _sql_http_path()
    if not table or not http_path:
        return None
    try:
        from databricks import sql as dbsql

        with dbsql.connect(
            http_path=http_path, **_sql_connect_kwargs()
        ) as conn, conn.cursor() as cur:
            cur.execute(
                f"SELECT html, generated_at FROM {table} "
                f"ORDER BY generated_at DESC LIMIT 1"
            )
            row = cur.fetchone()
        if not row or not row[0]:
            return None
        return {"html": row[0], "generated_at": row[1]}
    except Exception:
        _log.exception("Laplace report query failed")
        return None


def _get_report() -> dict | None:
    global _cache
    now = time.time()
    with _lock:
        if _cache is not None and now - _cache[0] < _TTL_S:
            return _cache[1]
    data = _query()
    if data is not None:
        with _lock:
            _cache = (now, data)
    return data


_BACK_LINK = (
    '<a href="../" style="display:inline-block;margin:14px 0 4px 24px;'
    "font-family:'Segoe UI',system-ui,sans-serif;font-size:12px;letter-spacing:1px;"
    "color:#3a6ea8;text-decoration:none;border:1px solid rgba(58,110,168,0.35);"
    'padding:8px 14px;border-radius:8px;">&larr; All Projects</a>'
)

_BODY_TAG_RE = re.compile(r"<body[^>]*>", re.IGNORECASE)


def _page(report_html: str) -> str:
    """Serve the stored report. The notebook may publish either a full HTML
    document or a body fragment (style + markup); handle both and prepend the
    portal back link."""
    head = report_html.lstrip()[:200].lower()
    if head.startswith("<!doctype") or head.startswith("<html"):
        m = _BODY_TAG_RE.search(report_html)
        if m:
            i = m.end()
            return report_html[:i] + _BACK_LINK + report_html[i:]
        return report_html
    return (
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        "<title>Laplace Pipeline Monitor</title>"
        "<style>body{margin:0;background:#eceae3;padding:0 0 26px;}</style></head>"
        f"<body>{_BACK_LINK}{report_html}</body></html>"
    )


def _message_page(title: str, message: str) -> str:
    return (
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f"<title>Laplace — {title}</title></head>"
        '<body style="margin:0;background:#eceae3;color:#111;'
        "font-family:'Segoe UI',system-ui,sans-serif;display:flex;min-height:100vh;"
        'align-items:center;justify-content:center;text-align:center;">'
        '<div style="padding:40px;"><div style="font-weight:800;font-size:22px;'
        f'letter-spacing:4px;">{title}</div>'
        f'<p style="color:#666;font-size:15px;margin-top:16px;">{message}</p>'
        '<a href="../" style="display:inline-block;margin-top:22px;color:#3a6ea8;'
        "text-decoration:none;border:1px solid rgba(58,110,168,0.35);padding:8px 16px;"
        'border-radius:8px;">&larr; All Projects</a></div></body></html>'
    )


@bp.route("/")
def page():
    if not auth.authorized(_PROJECT_KEY):
        return _message_page(
            "ACCESS RESTRICTED",
            "You don't have permission to view the Laplace Pipeline Monitor.<br>"
            "If you think you should, please contact the admin.",
        ), 403
    report = _get_report()
    if report is None:
        return _message_page(
            "DATA UNAVAILABLE",
            "The Laplace report could not be loaded. Try again later.",
        ), 503
    return _page(report["html"])


def _read_volume_file(path: str) -> bytes | None:
    """Read a Unity Catalog volume file via the Databricks Files API. Auth
    mirrors shared.db (Config across Apps SP creds / local PAT / CLI OAuth)."""
    try:
        from databricks.sdk import WorkspaceClient
        from databricks.sdk.core import Config

        profile = os.environ.get("DATABRICKS_CONFIG_PROFILE")
        cfg = Config(profile=profile) if profile else Config()
        w = WorkspaceClient(config=cfg)
        return w.files.download(path).contents.read()
    except Exception:
        _log.exception("Ruby download read failed")
        return None


@bp.route("/ruby-download")
def ruby_download():
    if not auth.authorized(_RUBY_PROJECT_KEY):
        return _message_page(
            "ACCESS RESTRICTED",
            "You don't have permission to download this file.<br>"
            "If you think you should, please contact the admin.",
        ), 403
    data = _read_volume_file(_RUBY_VOLUME_PATH)
    if data is None:
        return _message_page(
            "DATA UNAVAILABLE",
            "The Ruby file could not be loaded. Try again later.",
        ), 503
    return Response(
        data,
        mimetype=_XLSX_MIME,
        headers={
            "Content-Disposition": f'attachment; filename="{_RUBY_DOWNLOAD_NAME}"'
        },
    )
