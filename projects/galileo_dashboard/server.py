"""Galileo Observatory — Flask blueprint.

Serves the prebuilt Next.js static export (out/) under /galileo. Databricks Apps
runs gunicorn with no Node build step, so the site is built + committed offline
(see data_pipeline/) and this blueprint just streams the static files.

Page navigations are gated by the central GLI Nexus access table (project
GALILEO); static assets (_next/*, images, fonts) are served ungated — they are
meaningless without the page and keep the SPA loading fast.
"""
from __future__ import annotations

import os

from flask import Blueprint, abort, send_from_directory

from kelly_dashboard import auth

bp = Blueprint("galileo", __name__)

_DIR = os.path.dirname(os.path.abspath(__file__))
_OUT = os.path.join(_DIR, "out")
_PROJECT_KEY = "GALILEO"


def _authorized() -> bool:
    email = auth.get_current_email()
    if email is None:
        return not auth._in_databricks_app()  # local dev = allow
    projects = auth.get_user_projects(email)
    return bool(projects) and ("*" in projects or _PROJECT_KEY in projects)


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
    if _is_page(subpath):
        if not _authorized():
            return _denied_page(), 403
        rel = os.path.join(subpath, "index.html") if subpath else "index.html"
    else:
        rel = subpath
    full = os.path.normpath(os.path.join(_OUT, rel))
    if not full.startswith(os.path.normpath(_OUT)) or not os.path.isfile(full):
        abort(404)
    return send_from_directory(_OUT, rel.replace(os.sep, "/"))


@bp.route("/")
def index():
    return _serve("")


@bp.route("/<path:subpath>")
def asset(subpath: str):
    return _serve(subpath)
