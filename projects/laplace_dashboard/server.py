"""Laplace Pipeline Monitor — Flask blueprint.

Serves the customs-pipeline HTML report published by the Laplace Databricks
notebook. The notebook writes the fully assembled page as a date-stamped HTML
file to the Unity Catalog volume `/Volumes/sbx-logistics/gli_nexus/nexus_volume`
(e.g. laplace_pipeline_tutorial_YYYYMMDD.html); this blueprint lists the volume
at request time (short TTL cache) and serves the most recent match, so every
notebook run (manual or scheduled job) refreshes the dashboard with no app
redeploy. Access is gated by the central GLI Nexus access table (project
LAPLACEPIPELINE).
"""
from __future__ import annotations

import logging
import os
import re
import threading
import time

from flask import Blueprint, Response

from shared import auth

_log = logging.getLogger(__name__)

bp = Blueprint("laplace", __name__)

_PROJECT_KEY = "LAPLACEPIPELINE"
_TTL_S = int(os.environ.get("LAPLACE_CACHE_TTL_S", "300"))

# Report source: the latest HTML file published to a Unity Catalog volume, read
# via the Databricks Files API (no /Volumes filesystem mount assumed in the App
# container). The notebook writes a date-stamped file each run; the app lists the
# directory and serves the most recent match — no redeploy, no table.
_HTML_DIR = os.environ.get(
    "LAPLACE_HTML_DIR", "/Volumes/sbx-logistics/gli_nexus/nexus_volume"
).rstrip("/")
_HTML_PREFIX = os.environ.get("LAPLACE_HTML_PREFIX", "laplace_pipeline_tutorial_")

# Flags: Excel download served from the same volume.
_FLAGS_PROJECT_KEY = "FLAGS"
_RUBY_VOLUME_PATH = os.environ.get(
    "RUBY_XLSX_PATH",
    "/Volumes/sbx-logistics/gli_nexus/nexus_volume/package_flags_2026.xlsx",
)
_RUBY_DOWNLOAD_NAME = "package_flags_2026.xlsx"
_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

_cache: tuple[float, dict] | None = None
_lock = threading.Lock()


def _ws_client():
    """Databricks WorkspaceClient. Auth mirrors shared.db (Config across Apps SP
    creds / local PAT / CLI OAuth profile)."""
    from databricks.sdk import WorkspaceClient
    from databricks.sdk.core import Config

    profile = os.environ.get("DATABRICKS_CONFIG_PROFILE")
    cfg = Config(profile=profile) if profile else Config()
    return WorkspaceClient(config=cfg)


def _latest_html_path() -> str | None:
    """Most recent `_HTML_PREFIX*.html` file in the volume dir. Date-stamped
    names sort chronologically, so the lexicographic max is the newest."""
    try:
        w = _ws_client()
        matches: list[str] = []
        for e in w.files.list_directory_contents(_HTML_DIR):
            name, path = e.name, e.path
            if getattr(e, "is_directory", False) or not name or not path:
                continue
            if name.startswith(_HTML_PREFIX) and name.lower().endswith(".html"):
                matches.append(path)
        return max(matches) if matches else None
    except Exception:
        _log.exception("Laplace HTML volume listing failed")
        return None


def _query() -> dict | None:
    path = _latest_html_path()
    if not path:
        return None
    data = _read_volume_file(path)
    if data is None:
        return None
    return {"html": data.decode("utf-8", "replace"), "generated_at": path}


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
    """Read a Unity Catalog volume file via the Databricks Files API."""
    try:
        contents = _ws_client().files.download(path).contents
        return contents.read() if contents is not None else None
    except Exception:
        _log.exception("Volume file read failed: %s", path)
        return None


@bp.route("/flags-download")
def flags_download():
    if not auth.authorized(_FLAGS_PROJECT_KEY):
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
