from __future__ import annotations
from dash import html
import kelly_dashboard.theme as theme


def build_kpi_stat(
    title: str,
    value: str,
    color_class: str = "",  # "", "warn", "danger", "muted"
) -> html.Div:
    return html.Div([
        html.Div(value, className=f"kpi-value {color_class}".strip()),
        html.Div(title, className="kpi-label"),
    ], className="kpi-stat")


def build_kpi_row(stats: list, title: str = "FORECAST OVERVIEW") -> html.Div:
    return html.Div([
        html.Div(title, className="section-label"),
        html.Div(stats, className=f"kpi-row kpi-{len(stats)}"),
    ])
