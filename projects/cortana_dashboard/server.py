"""Cortana Usage Monitor — Flask blueprint.

Renders cortana.html (a Python str.format template) server-side with data
from `sbx-logistics.gli_nexus.cortana_usage`. Access is gated by the
central GLI Nexus access table (project CORTANA).
"""
from __future__ import annotations
import html as html_mod
import json
import logging
import os
import threading
import time

from flask import Blueprint

from kelly_dashboard import auth
from kelly_dashboard.data_loader import (
    _IDENTIFIER_PART_RE,
    _sql_connect_kwargs,
    _sql_http_path,
)

_log = logging.getLogger(__name__)

bp = Blueprint("cortana", __name__)

_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_KEY = "CORTANA"
_TTL_S = int(os.environ.get("CORTANA_CACHE_TTL_S", "300"))

# Fixed neon palette on near-black; hues assigned to spaces by sorted name so
# a space keeps its color regardless of rank or filtering.
_SPACE_COLORS = ["#00e5ff", "#7c4dff", "#ffd54f", "#ff6e9c",
                 "#69f0ae", "#ff9e40", "#40c4ff", "#c6ff00"]

_cache: tuple[float, dict] | None = None
_lock = threading.Lock()


def _usage_table() -> str | None:
    fq = os.environ.get("CORTANA_USAGE_TABLE", "sbx-logistics.gli_nexus.cortana_usage")
    parts = fq.split(".")
    if len(parts) != 3 or not all(_IDENTIFIER_PART_RE.fullmatch(p) for p in parts):
        _log.warning("Invalid CORTANA_USAGE_TABLE: %r", fq)
        return None
    return ".".join(f"`{p}`" for p in parts)


def _query() -> dict | None:
    table = _usage_table()
    http_path = _sql_http_path()
    if not table or not http_path:
        return None
    try:
        from databricks import sql as dbsql

        with dbsql.connect(
            http_path=http_path, **_sql_connect_kwargs()
        ) as conn, conn.cursor() as cur:
            cur.execute(
                f"SELECT event_date, space_name, user_email, messages, "
                f"queries_executed, conversations, _loaded_at FROM {table}"
            )
            rows = [
                {
                    "date": r[0].isoformat(),
                    "space": r[1],
                    "user": r[2],
                    "messages": int(r[3] or 0),
                    "queries": int(r[4] or 0),
                    "conversations": int(r[5] or 0),
                }
                for r in cur.fetchall()
            ]
            cur.execute(f"SELECT MAX(_loaded_at) FROM {table}")
            loaded = cur.fetchone()[0]
        return {"rows": rows, "loaded_at": loaded}
    except Exception:
        _log.exception("Cortana usage query failed")
        return None


def _get_data() -> dict | None:
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


def _authorized() -> bool:
    email = auth.get_current_email()
    if email is None:
        return not auth._in_databricks_app()  # local dev = allow
    projects = auth.get_user_projects(email)
    return bool(projects) and ("*" in projects or _PROJECT_KEY in projects)


def _space_color(space: str, spaces_sorted: list[str]) -> str:
    return _SPACE_COLORS[spaces_sorted.index(space) % len(_SPACE_COLORS)]


def _render(data: dict) -> str:
    rows = data["rows"]
    esc = html_mod.escape

    spaces_sorted = sorted({r["space"] for r in rows})
    color = {s: _space_color(s, spaces_sorted) for s in spaces_sorted}
    days = sorted({r["date"] for r in rows})

    # KPIs
    total_messages = sum(r["messages"] for r in rows)
    total_queries = sum(r["queries"] for r in rows)
    total_users = len({r["user"] for r in rows if r["messages"] > 0})
    total_spaces = len(spaces_sorted)

    # Chart.js: one line per space + dashed total
    def daily(pred):
        by = {d: 0 for d in days}
        for r in rows:
            if pred(r):
                by[r["date"]] += r["messages"]
        return [by[d] for d in days]

    datasets = [
        {
            "label": s,
            "data": daily(lambda r, s=s: r["space"] == s),
            "borderColor": color[s],
            "backgroundColor": color[s],
            "tension": 0.35,
            "pointRadius": 2,
            "borderWidth": 2,
        }
        for s in spaces_sorted
    ]
    if len(spaces_sorted) > 1:
        datasets.append({
            "label": "Total",
            "data": daily(lambda r: True),
            "borderColor": "#ffffff",
            "backgroundColor": "#ffffff",
            "borderDash": [6, 5],
            "tension": 0.35,
            "pointRadius": 0,
            "borderWidth": 1.5,
        })
    chart_json = json.dumps({"labels": days, "datasets": datasets})

    # Space bars (ranked by messages, width relative to busiest)
    msg_by_space = {s: sum(r["messages"] for r in rows if r["space"] == s) for s in spaces_sorted}
    ranked_spaces = sorted(spaces_sorted, key=lambda s: -msg_by_space[s])
    top_msg = max(msg_by_space.values()) if msg_by_space else 1
    space_bars = []
    for s in ranked_spaces:
        pct = 100 * msg_by_space[s] / top_msg if top_msg else 0
        space_bars.append(
            f'<div class="space-row" data-tip="<b>{esc(s)}</b><br>{msg_by_space[s]:,} messages">'
            f'<div class="space-name">{esc(s)}</div>'
            f'<div class="bar-track"><div class="bar-fill" style="width:{pct:.1f}%;'
            f'background:linear-gradient(90deg,{color[s]}66,{color[s]})"></div></div>'
            f'<div class="space-val">{msg_by_space[s]:,}</div></div>'
        )

    legend = "".join(
        f'<div class="legend-item"><span class="dot" style="background:{color[s]}"></span>{esc(s)}</div>'
        for s in spaces_sorted
    )

    # User leaderboard
    by_user: dict[str, dict] = {}
    for r in rows:
        u = by_user.setdefault(r["user"], {"messages": 0, "spaces": {}})
        u["messages"] += r["messages"]
        u["spaces"][r["space"]] = u["spaces"].get(r["space"], 0) + r["messages"]
    ranked_users = sorted(by_user.items(), key=lambda kv: -kv[1]["messages"])
    medal = {0: " gold", 1: " silver", 2: " bronze"}
    user_rows = []
    for i, (email, u) in enumerate(ranked_users):
        if u["messages"] <= 0:
            continue
        segs = "".join(
            f'<div class="seg" style="width:{100 * n / u["messages"]:.1f}%;background:{color[s]}"'
            f' data-tip="<b>{esc(s)}</b><br>{n:,} messages"></div>'
            for s, n in sorted(u["spaces"].items(), key=lambda kv: -kv[1]) if n > 0
        )
        chips = "".join(
            f'<span class="chip" style="color:{color[s]};border-color:{color[s]}66">{esc(s)}: {n:,}</span>'
            for s, n in sorted(u["spaces"].items(), key=lambda kv: -kv[1]) if n > 0
        )
        name = esc(email.split("@")[0])
        user_rows.append(
            f'<div class="user-row{medal.get(i, "")}">'
            f'<div class="rank">{i + 1}</div><div>'
            f'<div class="user-top"><span class="user-name">{name}</span>'
            f'<span class="user-spaces">{len([n for n in u["spaces"].values() if n > 0])} space(s)</span>'
            f'<span class="user-msg">{u["messages"]:,} msg</span></div>'
            f'<div class="seg-track">{segs}</div>'
            f'<div class="chips">{chips}</div>'
            f'</div></div>'
        )

    loaded = data["loaded_at"]
    last_update = loaded.strftime("%d %b %Y %H:%M UTC") if loaded else "—"

    with open(os.path.join(_DIR, "cortana.html"), encoding="utf-8") as f:
        template = f.read()
    body = template.format(
        last_update=last_update,
        total_messages=total_messages,
        total_users=total_users,
        total_queries=total_queries,
        total_spaces=total_spaces,
        chart_json=chart_json,
        space_bars_html="".join(space_bars),
        legend_html=legend,
        user_rows_html="".join(user_rows),
    )
    return _page(body)


def _page(body: str) -> str:
    return (
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        "<title>Cortana Usage Monitor</title>"
        "<style>body{margin:0;background:#000;padding:26px;}"
        ".portal-back{display:inline-block;margin-bottom:14px;font-family:'Segoe UI',sans-serif;"
        "font-size:12px;letter-spacing:1px;color:#7fe8ff;text-decoration:none;"
        "border:1px solid rgba(0,229,255,0.25);padding:8px 14px;border-radius:8px;}"
        ".portal-back:hover{background:rgba(0,229,255,0.08);}</style></head>"
        '<body><a class="portal-back" href="../">&larr; All Projects</a>'
        f"{body}</body></html>"
    )


_DENIED = (
    '<div id="cortana-dash" style="text-align:center;padding:80px 36px;">'
    '<div class="dash-title" style="font-family:Orbitron,sans-serif;font-weight:900;font-size:22px;'
    'letter-spacing:4px;color:#fff;text-shadow:0 0 10px #00e5ff;">ACCESS RESTRICTED</div>'
    '<p style="font-family:Rajdhani,sans-serif;color:#cdeffd;font-size:16px;margin-top:18px;">'
    "You don't have permission to view Cortana Usage Monitor.<br>"
    "If you think you should, please contact the admin.</p></div>"
)

_UNAVAILABLE = _DENIED.replace("ACCESS RESTRICTED", "DATA UNAVAILABLE").replace(
    "You don't have permission to view Cortana Usage Monitor.<br>"
    "If you think you should, please contact the admin.",
    "The usage data could not be loaded. Try again later.",
)


@bp.route("/")
def page():
    if not _authorized():
        return _page(_DENIED), 403
    data = _get_data()
    if data is None:
        return _page(_UNAVAILABLE), 503
    return _render(data)
