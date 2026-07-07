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

from flask import Flask, send_file
from werkzeug.middleware.dispatcher import DispatcherMiddleware

_ROOT = os.path.dirname(os.path.abspath(__file__))
_PORTAL = os.path.join(_ROOT, "portal", "gli_nexus_portal.html")

# Make the sub-projects importable as top-level packages
# (e.g. `import kelly_dashboard`), matching each project's own sys.path shim.
_PROJECTS = os.path.join(_ROOT, "projects")
if _PROJECTS not in sys.path:
    sys.path.insert(0, _PROJECTS)


# ---- Root app: serves the portal ------------------------------------------
root = Flask(__name__)


@root.route("/")
def portal():
    return send_file(_PORTAL)


@root.route("/healthz")
def healthz():
    return "ok", 200


@root.route("/api/my-access")
def my_access():
    """Project grants of the current user, read from the central access
    table (see kelly_dashboard.auth). The portal uses this to enable or
    restrict its cards. ["*"] = everything; [] = nothing / lookup failed."""
    from kelly_dashboard import auth

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

root.register_blueprint(cortana_bp, url_prefix="/cortana")

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
