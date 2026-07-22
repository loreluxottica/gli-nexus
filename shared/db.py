"""Databricks SQL connection helpers, shared across all GLI Nexus projects.

Runtime-neutral: they read only environment variables and build the kwargs the
`databricks-sql-connector` needs to reach a SQL warehouse — no project-specific
knowledge. Every project (auth, Kelly data loading, Cortana/Laplace report
queries) imports these instead of re-implementing the connection dance.
"""
from __future__ import annotations
import os
import re


def _sql_http_path() -> str | None:
    explicit = os.environ.get("KELLY_SQL_HTTP_PATH")
    if explicit:
        return explicit
    wh_id = os.environ.get("DATABRICKS_WAREHOUSE_ID")
    return f"/sql/1.0/warehouses/{wh_id}" if wh_id else None


# Identifiers can't be bound as query parameters, so name parts coming from
# the environment are validated and backtick-quoted before interpolation
# (catalog names like "sbx-logistics" contain hyphens).
_IDENTIFIER_PART_RE = re.compile(r"[A-Za-z0-9_-]+")


def _sql_connect_kwargs() -> dict:
    """Auth for databricks-sql-connector across runtimes: Databricks Apps
    (service-principal env creds), local PAT, or local CLI OAuth profile."""
    from databricks.sdk.core import Config, oauth_service_principal

    profile = os.environ.get("DATABRICKS_CONFIG_PROFILE")
    cfg = Config(profile=profile) if profile else Config()
    kwargs = {"server_hostname": cfg.host.removeprefix("https://")}
    if cfg.client_id and cfg.client_secret:
        kwargs["credentials_provider"] = lambda: oauth_service_principal(cfg)
    elif cfg.token:
        kwargs["access_token"] = cfg.token
    else:
        kwargs["credentials_provider"] = lambda: cfg.authenticate
    return kwargs
