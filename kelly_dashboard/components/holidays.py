from __future__ import annotations
import pandas as pd
from dash import html
import kelly_dashboard.theme as theme

_FLAG = {"US": "🇺🇸", "IT": "🇮🇹", "MX": "🇲🇽"}

# Monochrome (EL internal-dashboard style) — all white
_MONTH_COLORS = {
    1: "#FFFFFF", 2: "#FFFFFF", 3: "#FFFFFF", 4: "#FFFFFF",
    5: "#FFFFFF", 6: "#FFFFFF", 7: "#FFFFFF", 8: "#FFFFFF",
    9: "#FFFFFF", 10: "#FFFFFF", 11: "#FFFFFF", 12: "#FFFFFF",
}


def build_holidays_panel(holidays: list[dict]) -> html.Div:
    title = html.Div("UPCOMING HOLIDAYS & FESTIVITIES", className="chart-card-title")

    if not holidays:
        return html.Div([
            title,
            html.Div("No upcoming holidays in the next 30 days.", style={
                "fontSize": "12px", "color": theme.TEXT_DIM, "padding": "12px 0",
            }),
        ], className="chart-card")

    rows = []
    today = pd.Timestamp.today().normalize()
    for h in holidays:
        d: pd.Timestamp = h["date"]
        days_away = (d - today).days
        color = _MONTH_COLORS.get(d.month, theme.ACCENT)
        flag = _FLAG.get(h["country"], "")

        if days_away == 0:
            proximity = "Today"
            prox_color = theme.POSITIVE
        elif days_away == 1:
            proximity = "Tomorrow"
            prox_color = theme.WARN
        else:
            proximity = f"in {days_away}d"
            prox_color = theme.TEXT_DIM

        rows.append(html.Div([
            # Date badge
            html.Div([
                html.Div(d.strftime("%d"), style={
                    "fontSize": "16px", "fontWeight": "700", "color": color,
                    "lineHeight": "1", "fontVariantNumeric": "tabular-nums",
                }),
                html.Div(d.strftime("%b").upper(), style={
                    "fontSize": "9px", "fontWeight": "600", "color": color,
                    "letterSpacing": "1px", "marginTop": "1px",
                }),
            ], style={
                "width": "36px", "textAlign": "center", "flexShrink": "0",
                "borderRight": f"1px solid {theme.BORDER}",
                "paddingRight": "12px", "marginRight": "12px",
            }),
            # Name
            html.Div([
                html.Div([
                    html.Span(flag + " " if flag else "", style={"marginRight": "4px"}),
                    html.Span(h["name"], style={
                        "fontSize": "13px", "color": theme.TEXT, "fontWeight": "500",
                    }),
                ]),
                html.Div(h["name_en"] if h["name_en"] != h["name"] else "", style={
                    "fontSize": "11px", "color": theme.TEXT_DIM, "marginTop": "1px",
                }),
            ], style={"flex": "1"}),
            # Days away
            html.Div(proximity, style={
                "fontSize": "11px", "color": prox_color,
                "fontWeight": "500", "whiteSpace": "nowrap",
            }),
        ], style={
            "display": "flex", "alignItems": "center",
            "padding": "10px 0",
            "borderBottom": f"1px solid {theme.BORDER}",
        }))

    return html.Div([title, html.Div(rows)], className="chart-card")
