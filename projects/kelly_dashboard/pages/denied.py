"""Access-denied page: blurred page skeleton behind a permission modal.

Contains no dcc.Store, so none of the data callbacks ever fire — nothing
about the plant is loaded behind the blur.
"""
from __future__ import annotations
import dash
from dash import html

from kelly_dashboard.warehouses import get_warehouse


def layout(warehouse_id: str = "") -> html.Div:
    wh = get_warehouse(warehouse_id)
    label = wh["label"] if wh else (warehouse_id.title() or "this plant")

    skeleton = html.Div([
        html.Div(className="sidebar"),
        html.Div([
            html.Div(className="denied-ghost-card sm"),
            html.Div(className="denied-ghost-card"),
            html.Div(className="denied-ghost-card"),
        ], className="main-content"),
    ], className="app-shell denied-skeleton")

    modal = html.Div(
        html.Div([
            html.Div("ACCESS RESTRICTED", className="denied-title"),
            html.Div(
                f"You don't have permission to view {label}.",
                className="denied-msg",
            ),
            html.Div(
                "If you think you should, please contact the admin.",
                className="denied-sub",
            ),
            html.A(
                "← Back to Globe",
                href=dash.get_relative_path("/"),
                className="denied-back",
            ),
        ], className="denied-modal"),
        className="denied-overlay",
    )

    return html.Div([skeleton, modal], className="denied-shell")
