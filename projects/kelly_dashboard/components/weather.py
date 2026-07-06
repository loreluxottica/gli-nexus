from __future__ import annotations
import pandas as pd
from dash import html
import kelly_dashboard.theme as theme


def build_weather_strip(df: pd.DataFrame | None) -> html.Div:
    if df is None or df.empty:
        return html.Div("Weather data unavailable", style={
            "fontSize": "11px", "color": theme.TEXT_DIM, "padding": "16px 0",
        })

    days = df.sort_values("date").head(7).to_dict("records")
    today = pd.Timestamp.today().normalize()

    cols = []
    for i, row in enumerate(days):
        date = pd.Timestamp(row["date"])
        is_today = date.normalize() == today
        day_label = "TODAY" if is_today else date.strftime("%a").upper()
        date_label = date.strftime("%d %b")

        temp_max = f"{row['temp_max']:.0f}°C" if pd.notna(row.get("temp_max")) else "—"
        temp_min = f"{row['temp_min']:.0f}°C" if pd.notna(row.get("temp_min")) else "—"
        precip_val = row.get("precipitation") or 0
        precip = f"{precip_val:.1f}mm" if pd.notna(precip_val) else "—"
        is_wet = float(precip_val) > 2
        emoji = row.get("emoji", "🌡")

        day_class = "weather-day today" if is_today else "weather-day"
        precip_class = "weather-precip wet" if is_wet else "weather-precip"

        col = html.Div([
            html.Div(day_label, className="weather-day-name"),
            html.Div(date_label, className="weather-day-date"),
            html.Span(emoji, className="weather-icon"),
            html.Span(temp_max, className="weather-temp-hi"),
            html.Span(temp_min, className="weather-temp-lo"),
            html.Div(precip, className=precip_class),
        ], className=day_class)

        cols.append(col)
        if i < len(days) - 1:
            cols.append(html.Div(className="weather-divider"))

    return html.Div([
        html.Div("7 DAYS WEATHER FORECAST", className="chart-card-title"),
        html.Div(cols, style={"display": "flex", "alignItems": "flex-start", "overflowX": "auto"}),
    ], className="weather-card")
