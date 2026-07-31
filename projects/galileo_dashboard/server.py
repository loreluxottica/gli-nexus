"""Galileo Observatory — Flask blueprint.

Serves the prebuilt Next.js static export (out/) under /galileo. Databricks Apps
runs gunicorn with no Node build step, so the *site* is built + committed offline
and this blueprint streams those files.

The **data** is not in the export. It is served from /galileo/api/*.json, built
on demand from the Unity Catalog tables by data_service.py, so a new month
reaches the dashboard as soon as the tables are loaded — no rebuild, no commit.

Page navigations and the data API are gated by the central GLI Nexus access
table (project GALILEO). Static assets (_next/*, images, fonts) are served
ungated — they are meaningless without the page and keep the SPA loading fast.
"""
from __future__ import annotations

import logging
import os

from flask import Blueprint, Response, abort, jsonify, request, send_from_directory

from shared import auth

from . import data_service

_log = logging.getLogger(__name__)

bp = Blueprint("galileo", __name__)

_DIR = os.path.dirname(os.path.abspath(__file__))
_OUT = os.path.join(_DIR, "out")
_PROJECT_KEY = "GALILEO"


def _denied_page() -> str:
    return (
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        "<title>Galileo — Access restricted</title></head>"
        '<body style="margin:0;background:#05060a;color:#e8f0ff;'
        "font-family:'Segoe UI',system-ui,sans-serif;display:flex;min-height:100vh;"
        'align-items:center;justify-content:center;text-align:center;">'
        '<div style="padding:40px;"><div style="font-weight:800;font-size:22px;'
        'letter-spacing:4px;">ACCESS RESTRICTED</div>'
        '<p style="color:#9fb2d0;font-size:15px;margin-top:16px;">'
        "You don't have permission to view the Galileo Observatory.<br>"
        "If you think you should, please contact the admin.</p>"
        '<a href="../" style="display:inline-block;margin-top:22px;color:#7fe8ff;'
        "text-decoration:none;border:1px solid rgba(127,232,255,0.3);padding:8px 16px;"
        'border-radius:8px;">&larr; All Projects</a></div></body></html>'
    )


# Portal back link, styled to Galileo's cosmic theme (cyan on translucent dark).
# Fixed top-left so it overlays the SPA; href is the absolute portal root because
# Galileo has nested pages (/galileo/content/, /database/, …) where "../" wouldn't
# reach the root. Injected before </body> at serve time — see _serve().
_BACK_LINK = (
    '<a href="/" style="position:fixed;top:16px;left:16px;z-index:2147483647;'
    "display:inline-flex;align-items:center;gap:6px;"
    "font-family:'Segoe UI',system-ui,sans-serif;font-size:12px;letter-spacing:1px;"
    "color:#7fe8ff;text-decoration:none;background:rgba(5,6,10,0.72);"
    "-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);"
    'border:1px solid rgba(127,232,255,0.3);padding:8px 14px;border-radius:8px;">'
    "&larr; All Projects</a>"
)


def _is_page(subpath: str) -> bool:
    """A page navigation (serve index.html + gate) vs a static asset.
    Assets have a file extension in their last segment; pages don't (or end /)."""
    if subpath == "" or subpath.endswith("/"):
        return True
    last = subpath.rsplit("/", 1)[-1]
    return "." not in last


def _serve(subpath: str):
    if not os.path.isdir(_OUT):
        abort(503)  # site not built yet
    is_page = _is_page(subpath)
    if is_page:
        if not auth.authorized(_PROJECT_KEY):
            return _denied_page(), 403
        rel = os.path.join(subpath, "index.html") if subpath else "index.html"
    else:
        rel = subpath
    full = os.path.normpath(os.path.join(_OUT, rel))
    if not full.startswith(os.path.normpath(_OUT)) or not os.path.isfile(full):
        abort(404)
    if is_page:
        # Patch the prebuilt export at serve time to add the portal back link
        # (no Node build step available). Injected as the last <body> child so
        # React hydration leaves it in place and it survives client-side nav.
        with open(full, encoding="utf-8") as fh:
            html = fh.read()
        i = html.rfind("</body>")
        html = html[:i] + _BACK_LINK + html[i:] if i != -1 else html + _BACK_LINK
        return Response(html, mimetype="text/html")
    return send_from_directory(_OUT, rel.replace(os.sep, "/"))


# ---- Data API --------------------------------------------------------------
# Declared before the catch-all below so the static handler can never shadow it.


@bp.route("/api/<name>.json")
def api_payload(name: str):
    """One built payload, straight from the tables (cached — see data_service)."""
    if not auth.authorized(_PROJECT_KEY):
        abort(403)
    try:
        blob, etag = data_service.get_payload(name)
    except KeyError:
        abort(404)
    except Exception:
        # No cached copy to fall back on: the warehouse is unreachable or the
        # tables changed shape. 503 so the client can retry rather than cache it.
        _log.exception("galileo: could not build payload %r", name)
        abort(503)

    resp = Response(blob, mimetype="application/json")
    resp.set_etag(etag)
    # Short max-age keeps navigation snappy; the ETag is what actually saves the
    # 1.1 MB db.json re-download once the browser holds a copy.
    resp.headers["Cache-Control"] = "private, max-age=60"
    return resp.make_conditional(request)


@bp.route("/api/status")
def api_status():
    if not auth.authorized(_PROJECT_KEY):
        abort(403)
    return jsonify(data_service.status())


@bp.route("/api/refresh", methods=["POST"])
def api_refresh():
    """Drop the cache so the next request rebuilds — for right after a data load."""
    if not auth.authorized(_PROJECT_KEY):
        abort(403)
    data_service.invalidate()
    return jsonify({"invalidated": True})


# ---- Static export ---------------------------------------------------------


@bp.route("/")
def index():
    return _serve("")


@bp.route("/<path:subpath>")
def asset(subpath: str):
    return _serve(subpath)
