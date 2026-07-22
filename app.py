"""GLI Nexus — unified entry point.

Serves the portal front-end at "/" and mounts each sub-project under its own
subpath via a WSGI dispatcher. One process, one Databricks App deployment.

Run locally:
    pip install -r requirements.txt
    gunicorn app:application -b 0.0.0.0:8000      # production-style
    python app.py                                  # quick dev server

Add a new project:
    1. drop it under projects/<name>/ exposing a WSGI `server`
    2. set its URL-prefix env var before importing (mirrors KELLY_URL_PREFIX)
    3. add it to the MOUNTS dict below
"""
from __future__ import annotations

import os
import sys

from flask import Flask, send_file, send_from_directory
from werkzeug.middleware.dispatcher import DispatcherMiddleware

_ROOT = os.path.dirname(os.path.abspath(__file__))
_PORTAL_DIR = os.path.join(_ROOT, "portal")
_PORTAL = os.path.join(_PORTAL_DIR, "index-single.html")

# Make the sub-projects importable as top-level packages
# (e.g. `import kelly_dashboard`), matching each project's own sys.path shim.
# The repo root goes on too, so the cross-cutting `shared` package (shared.auth,
# shared.db) resolves as `import shared`.
_PROJECTS = os.path.join(_ROOT, "projects")
for _p in (_ROOT, _PROJECTS):
    if _p not in sys.path:
        sys.path.insert(0, _p)


# ---- Root app: serves the portal ------------------------------------------
root = Flask(__name__)


@root.route("/")
def portal():
    return send_file(_PORTAL)


# Portal static assets. Explicit prefix routes (not a greedy catch-all) so they
# can't shadow /healthz, /api/*, or the mounted sub-project blueprints.
@root.route("/css/<path:filename>")
def portal_css(filename):
    return send_from_directory(os.path.join(_PORTAL_DIR, "css"), filename)


@root.route("/js/<path:filename>")
def portal_js(filename):
    return send_from_directory(os.path.join(_PORTAL_DIR, "js"), filename)


@root.route("/GLI-Branding/<path:filename>")
def portal_branding(filename):
    return send_from_directory(os.path.join(_PORTAL_DIR, "GLI-Branding"), filename)


@root.route("/healthz")
def healthz():
    return "ok", 200


@root.route("/api/my-access")
def my_access():
    """Project grants of the current user, read from the central access
    table (see shared.auth). The portal uses this to enable or
    restrict its cards. ["*"] = everything; [] = nothing / lookup failed."""
    from shared import auth

    email = auth.get_current_email()
    if email is None:
        # No identity: dev run gets everything, deployed gets nothing.
        projects = ["*"] if not auth._in_databricks_app() else []
    else:
        projects = sorted(auth.get_user_projects(email) or [])
    return {"projects": projects}


# ---- Mount sub-projects ----------------------------------------------------
# Each project's Dash app must be created with a matching *_URL_PREFIX so its
# assets/routes resolve under the subpath. Set the env var BEFORE importing.
os.environ.setdefault("KELLY_URL_PREFIX", "/kelly/")
from kelly_dashboard.app import server as kelly_server  # noqa: E402
from cortana_dashboard.server import bp as cortana_bp  # noqa: E402
from galileo_dashboard.server import bp as galileo_bp  # noqa: E402
from laplace_dashboard.server import bp as laplace_bp  # noqa: E402

root.register_blueprint(cortana_bp, url_prefix="/cortana")
root.register_blueprint(galileo_bp, url_prefix="/galileo")
root.register_blueprint(laplace_bp, url_prefix="/laplace")

MOUNTS = {
    "/kelly": kelly_server,
}

# WSGI callable consumed by gunicorn (`app:application`) and Databricks Apps.
application = DispatcherMiddleware(root, MOUNTS)


if __name__ == "__main__":
    # Dev-only server. Production uses gunicorn (see app.yaml).
    from werkzeug.serving import run_simple

    port = int(os.environ.get("DATABRICKS_APP_PORT", os.environ.get("PORT", 8000)))
    run_simple("0.0.0.0", port, application, use_reloader=False, threaded=True)
